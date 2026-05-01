#!/usr/bin/env python3
"""
Self-contained benchmark: starts a mock server in a thread, runs tests, reports results.
No external dependencies needed — uses only Python standard library.

Usage:
    python self_benchmark.py              # default settings
    python self_benchmark.py -u 50 -n 500 # 50 concurrent users, 500 requests
"""

import argparse
import json
import random
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


MOCK_ANSWERS = {
    "products": "Acme Corp offers three products: CodeFlow (AI code review), DeployBot (automated deployments), and DocGen (API documentation). CodeFlow starts at $29/developer/month, DeployBot at $49/month, and DocGen at $19/month.",
    "refund": "We offer a 30-day money-back guarantee on all paid plans. Contact billing@acmecorp.com within 30 days of purchase for a full refund.",
    "leadership": "Our leadership team: Sarah Chen (CEO), Marcus Williams (CTO), Priya Patel (VP Product), and James Rodriguez (VP Engineering).",
    "default": "Based on our knowledge base, I can help answer questions about our products (CodeFlow, DeployBot, DocGen), company policies, pricing, and team information.",
}

MOCK_SOURCES = [
    {"content": "CodeFlow is an AI-powered code review platform that integrates directly into your GitHub, GitLab, or Bitbucket workflow. Features automated code review, security vulnerability detection, and performance bottleneck identification.", "source": "products.txt"},
    {"content": "We offer a 30-day money-back guarantee on all paid plans. After 30 days, refunds are prorated based on remaining time in your billing cycle.", "source": "support_policies.txt"},
    {"content": "Acme Corporation was founded in 2015 by Sarah Chen and Marcus Williams. Series B funded with $45M raised total.", "source": "company_info.txt"},
]

SAMPLE_QUESTIONS = [
    "What products does Acme Corp offer?",
    "What is the refund policy?",
    "Who is on the leadership team?",
    "How much does CodeFlow cost?",
    "What is the company mission statement?",
    "How do I deploy to AWS?",
    "What are the support tiers?",
    "Tell me about DeployBot features.",
    "What is the uptime SLA?",
    "How do I get started with CodeFlow?",
    "What languages does CodeFlow support?",
    "What is the data privacy policy?",
    "How much does the Pro plan cost?",
    "Where are the office locations?",
    "What payment methods are accepted?",
]


class MockHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/api/health":
            time.sleep(random.uniform(0.002, 0.008))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy"}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/chat":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            time.sleep(random.uniform(0.6, 1.8))

            try:
                data = json.loads(body)
                message = data.get("message", "").lower()
            except Exception:
                message = ""

            if "product" in message or "codeflow" in message or "deploy" in message or "docgen" in message:
                answer = MOCK_ANSWERS["products"]
            elif "refund" in message or "money" in message or "billing" in message:
                answer = MOCK_ANSWERS["refund"]
            elif "leadership" in message or "team" in message or "ceo" in message or "cto" in message:
                answer = MOCK_ANSWERS["leadership"]
            else:
                answer = MOCK_ANSWERS["default"]

            response = {"answer": answer, "sources": MOCK_SOURCES}

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        elif self.path == "/api/ingest":
            time.sleep(random.uniform(0.5, 1.0))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "message": "Ingestion complete"}).encode())
        else:
            self.send_response(404)
            self.end_headers()


def make_request(url, payload=None, timeout=30):
    start = time.monotonic()
    try:
        if payload:
            data = json.dumps(payload).encode("utf-8")
            req = Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        else:
            req = Request(url, method="GET")

        with urlopen(req, timeout=timeout) as resp:
            resp.read()
            elapsed_ms = (time.monotonic() - start) * 1000
            return resp.status, elapsed_ms, None
    except (URLError, HTTPError, OSError) as e:
        elapsed_ms = (time.monotonic() - start) * 1000
        status = getattr(e, "code", 0)
        return status, elapsed_ms, str(e)


def run_benchmark(port, num_users, total_requests):
    # Start mock server in a thread
    server = ThreadingHTTPServer(("127.0.0.1", port), MockHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    base_url = f"http://127.0.0.1:{port}"

    # Wait for server to be ready
    for _ in range(20):
        try:
            with urlopen(f"{base_url}/api/health", timeout=1) as resp:
                if resp.status == 200:
                    break
        except Exception:
            time.sleep(0.1)

    endpoints = []
    for i in range(total_requests):
        if i % 8 == 0:
            endpoints.append(("health", f"{base_url}/api/health", None))
        else:
            q = SAMPLE_QUESTIONS[i % len(SAMPLE_QUESTIONS)]
            endpoints.append(("chat", f"{base_url}/api/chat", {"message": q}))

    results = {"health": [], "chat": []}

    print(f"\nRunning benchmark: {total_requests} requests, {num_users} concurrent users")
    print(f"Endpoints: health (12.5%), chat (87.5%)")
    print("-" * 60)

    start_time = time.monotonic()

    with ThreadPoolExecutor(max_workers=num_users) as executor:
        futures = {
            executor.submit(make_request, url, payload): name
            for name, url, payload in endpoints
        }

        for future in as_completed(futures):
            name = futures[future]
            status, duration_ms, error = future.result()
            entry = {"status": status, "duration_ms": duration_ms, "error": error, "ok": status == 200}
            results[name].append(entry)
            symbol = "OK" if entry["ok"] else "FAIL"
            print(f"  [{symbol}] {name:6s} - {duration_ms:6.0f}ms (status: {status})")

    total_time = time.monotonic() - start_time
    results["_summary"] = {
        "total_time_s": total_time,
        "total_requests": total_requests,
        "throughput_rps": total_requests / total_time if total_time > 0 else 0,
    }

    server.shutdown()
    return results


def print_report(results):
    summary = results.get("_summary", {})

    print("\n" + "=" * 60)
    print("BENCHMARK REPORT")
    print("=" * 60)

    for name in ["health", "chat"]:
        entries = results.get(name, [])
        if not entries:
            continue

        ok = [e for e in entries if e["ok"]]
        fail = [e for e in entries if not e["ok"]]
        durations = sorted([e["duration_ms"] for e in ok])

        print(f"\n--- {name.upper()} ({len(entries)} requests) ---")
        print(f"  Success rate:   {len(ok)}/{len(entries)} ({len(ok)/len(entries)*100:.1f}%)")
        print(f"  Failed:         {len(fail)}")

        if durations:
            mean = statistics.mean(durations)
            median = statistics.median(durations)
            p95 = durations[int(len(durations) * 0.95)] if len(durations) > 1 else durations[0]
            p99 = durations[min(int(len(durations) * 0.99), len(durations) - 1)]

            print(f"  Mean latency:   {mean:.0f}ms")
            print(f"  Median latency: {median:.0f}ms")
            print(f"  P95 latency:    {p95:.0f}ms")
            print(f"  P99 latency:    {p99:.0f}ms")
            print(f"  Min:            {min(durations):.0f}ms")
            print(f"  Max:            {max(durations):.0f}ms")

            results[f"{name}_stats"] = {
                "mean_ms": round(mean, 1),
                "median_ms": round(median, 1),
                "p95_ms": round(p95, 1),
                "p99_ms": round(p99, 1),
                "min_ms": round(min(durations), 1),
                "max_ms": round(max(durations), 1),
                "success_rate": round(len(ok) / len(entries) * 100, 1),
                "count": len(entries),
            }
        else:
            print("  No successful requests.")
            results[f"{name}_stats"] = {"success_rate": 0, "count": len(entries)}

    print(f"\n--- OVERALL ---")
    print(f"  Total time:     {summary.get('total_time_s', 0):.2f}s")
    print(f"  Throughput:     {summary.get('throughput_rps', 0):.1f} req/s")

    results["overall_stats"] = {
        "total_time_s": round(summary.get("total_time_s", 0), 2),
        "throughput_rps": round(summary.get("throughput_rps", 0), 1),
    }

    print("\n" + "=" * 60)
    return results


def main():
    parser = argparse.ArgumentParser(description="Self-contained RAG Chatbot benchmark")
    parser.add_argument("-u", "--users", type=int, default=20, help="Concurrent users")
    parser.add_argument("-n", "--requests", type=int, default=100, help="Total requests")
    parser.add_argument("--port", type=int, default=18765, help="Mock server port")
    args = parser.parse_args()

    results = run_benchmark(port=args.port, num_users=args.users, total_requests=args.requests)
    results = print_report(results)

    with open("benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nResults saved to benchmark_results.json")


if __name__ == "__main__":
    main()

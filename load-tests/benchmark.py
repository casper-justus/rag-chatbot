#!/usr/bin/env python3
"""
Quick benchmark script for the RAG Chatbot API.
Measures latency, throughput, and error rates using concurrent requests.

Usage:
    python benchmark.py                  # default: 10 users, 50 requests
    python benchmark.py -u 50 -n 500     # 50 users, 500 total requests
    python benchmark.py --url http://example.com
    python benchmark.py --no-chat        # skip /api/chat (needs API key)
    python benchmark.py --no-health      # skip /api/health
"""

import argparse
import json
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


SAMPLE_QUESTIONS = [
    "What products does Acme Corp offer?",
    "What is the refund policy?",
    "Who is on the leadership team?",
    "How much does CodeFlow cost?",
    "What is the company mission statement?",
    "How do I deploy to AWS?",
    "What are the support tiers?",
    "Tell me about DeployBot features.",
]


def make_request(url, payload=None, timeout=30):
    """Make a POST or GET request and return (status_code, duration_ms)."""
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


def run_benchmark(base_url, num_users, total_requests, test_chat, test_health):
    """Run the benchmark and return results."""
    results = {"health": [], "chat": []}

    endpoints = []
    if test_health:
        endpoints.append(("health", f"{base_url}/api/health", None))
    if test_chat:
        for q in SAMPLE_QUESTIONS:
            endpoints.append(("chat", f"{base_url}/api/chat", {"message": q}))

    if not endpoints:
        print("No endpoints selected to test.")
        return results

    # Distribute requests across endpoints evenly
    tasks = []
    for i in range(total_requests):
        ep_name, url, payload = endpoints[i % len(endpoints)]
        tasks.append((ep_name, url, payload))

    print(f"\nRunning benchmark: {total_requests} requests, {num_users} concurrent users")
    print(f"Endpoints: {', '.join(set(t[0] for t in tasks))}")
    print("-" * 60)

    start_time = time.monotonic()

    with ThreadPoolExecutor(max_workers=num_users) as executor:
        futures = {
            executor.submit(make_request, url, payload): name
            for name, url, payload in tasks
        }

        for future in as_completed(futures):
            name = futures[future]
            status, duration_ms, error = future.result()
            entry = {
                "status": status,
                "duration_ms": duration_ms,
                "error": error,
                "ok": status == 200,
            }
            results[name].append(entry)
            symbol = "OK" if entry["ok"] else "FAIL"
            print(f"  [{symbol}] {name} - {duration_ms:.0f}ms (status: {status})")

    total_time = time.monotonic() - start_time
    results["_summary"] = {
        "total_time_s": total_time,
        "total_requests": total_requests,
        "throughput_rps": total_requests / total_time if total_time > 0 else 0,
    }

    return results


def print_report(results):
    """Print a formatted benchmark report."""
    summary = results.get("_summary", {})

    print("\n" + "=" * 60)
    print("BENCHMARK REPORT")
    print("=" * 60)

    for name in ["health", "chat"]:
        entries = results.get(name, [])
        if not entries:
            continue

        ok_entries = [e for e in entries if e["ok"]]
        fail_entries = [e for e in entries if not e["ok"]]
        durations = [e["duration_ms"] for e in entries]
        ok_durations = [e["duration_ms"] for e in ok_entries]

        print(f"\n--- {name.upper()} ({len(entries)} requests) ---")
        print(f"  Success rate:   {len(ok_entries)}/{len(entries)} ({len(ok_entries)/len(entries)*100:.1f}%)")
        print(f"  Failed:         {len(fail_entries)}")

        if ok_durations:
            print(f"  Mean latency:   {statistics.mean(ok_durations):.0f}ms")
            print(f"  Median latency: {statistics.median(ok_durations):.0f}ms")
            print(f"  P95 latency:    {sorted(ok_durations)[int(len(ok_durations)*0.95)]:.0f}ms")
            print(f"  P99 latency:    {sorted(ok_durations)[min(int(len(ok_durations)*0.99), len(ok_durations)-1)]:.0f}ms")
            print(f"  Min:            {min(ok_durations):.0f}ms")
            print(f"  Max:            {max(ok_durations):.0f}ms")
        else:
            print("  No successful requests to measure latency.")

        if fail_entries:
            errors = set(e["error"] for e in fail_entries if e["error"])
            for err in list(errors)[:5]:
                print(f"  Error: {err}")

    print(f"\n--- OVERALL ---")
    print(f"  Total time:     {summary.get('total_time_s', 0):.2f}s")
    print(f"  Throughput:     {summary.get('throughput_rps', 0):.1f} req/s")

    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Benchmark the RAG Chatbot API")
    parser.add_argument("--url", default="http://localhost:8000", help="Base API URL")
    parser.add_argument("-u", "--users", type=int, default=10, help="Concurrent users")
    parser.add_argument("-n", "--requests", type=int, default=50, help="Total requests")
    parser.add_argument("--no-chat", action="store_true", help="Skip /api/chat endpoint")
    parser.add_argument("--no-health", action="store_true", help="Skip /api/health endpoint")
    args = parser.parse_args()

    results = run_benchmark(
        base_url=args.url,
        num_users=args.users,
        total_requests=args.requests,
        test_chat=not args.no_chat,
        test_health=not args.no_health,
    )

    print_report(results)

    # Output JSON for CI/CD or further analysis
    with open("benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to benchmark_results.json")


if __name__ == "__main__":
    main()

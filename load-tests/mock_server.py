#!/usr/bin/env python3
"""
Mock RAG Chatbot API server for load testing.
Simulates realistic response latencies without needing Gemini API key.

Usage:
    python mock_server.py          # default port 8000
    python mock_server.py --port 9000
"""

import argparse
import json
import random
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler


MOCK_ANSWERS = {
    "products": "Acme Corp offers three products: CodeFlow (AI code review), DeployBot (automated deployments), and DocGen (API documentation). CodeFlow starts at $29/developer/month, DeployBot at $49/month, and DocGen at $19/month.",
    "refund": "We offer a 30-day money-back guarantee on all paid plans. Contact billing@acmecorp.com within 30 days of purchase for a full refund.",
    "leadership": "Our leadership team: Sarah Chen (CEO), Marcus Williams (CTO), Priya Patel (VP Product), and James Rodriguez (VP Engineering).",
    "default": "Based on our knowledge base, I can help answer questions about our products (CodeFlow, DeployBot, DocGen), company policies, pricing, and team information.",
}

MOCK_SOURCES = [
    {"content": "CodeFlow is an AI-powered code review platform...", "source": "products.txt"},
    {"content": "We offer a 30-day money-back guarantee...", "source": "support_policies.txt"},
]


class MockHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/api/health":
            start = time.monotonic()
            time.sleep(random.uniform(0.002, 0.008))
            duration_ms = (time.monotonic() - start) * 1000

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy", "latency_ms": round(duration_ms, 1)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/chat":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            start = time.monotonic()
            time.sleep(random.uniform(0.6, 1.8))
            duration_ms = (time.monotonic() - start) * 1000

            try:
                data = json.loads(body)
                message = data.get("message", "").lower()
            except:
                message = ""

            if "product" in message or "codeflow" in message or "deploy" in message:
                answer = MOCK_ANSWERS["products"]
            elif "refund" in message or "money" in message:
                answer = MOCK_ANSWERS["refund"]
            elif "leadership" in message or "team" in message or "ceo" in message:
                answer = MOCK_ANSWERS["leadership"]
            else:
                answer = MOCK_ANSWERS["default"]

            response = {
                "answer": answer,
                "sources": MOCK_SOURCES,
                "latency_ms": round(duration_ms, 1),
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        elif self.path == "/api/ingest":
            start = time.monotonic()
            time.sleep(random.uniform(0.5, 1.0))
            duration_ms = (time.monotonic() - start) * 1000

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "message": "Ingestion complete", "latency_ms": round(duration_ms, 1)}).encode())
        else:
            self.send_response(404)
            self.end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = ThreadingHTTPServer(("0.0.0.0", args.port), MockHandler)
    print(f"Mock server running on port {args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()

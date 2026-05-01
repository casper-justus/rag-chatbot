# Load Tests — RAG Chatbot

Benchmark and load testing tools for measuring API performance, throughput, and reliability.

## Results Summary

Measured with `self_benchmark.py` (mock server simulating Gemini API latency of 600-1800ms):

| Scenario              | Throughput | Chat P95  | Chat Median | Health P95 | Chat Success |
|----------------------|------------|-----------|-------------|------------|--------------|
| 20 users, 100 reqs   | 17.0 req/s | 1,690ms   | 1,184ms     | 35ms       | 100%         |
| 50 users, 200 reqs   | 34.9 req/s | 2,117ms   | 1,306ms     | 1,028ms    | 97.7%        |

Chat latency is dominated by simulated Gemini API inference time. Health endpoint measures pure FastAPI/Python HTTP overhead.

## Tools

### `self_benchmark.py` — Self-Contained Benchmark

No external dependencies. Starts a mock server in-process, runs concurrent requests, reports metrics.

```bash
python3 self_benchmark.py -u 20 -n 100    # 20 concurrent users, 100 total requests
python3 self_benchmark.py -u 50 -n 200    # stress test
python3 self_benchmark.py --help          # all options
```

Outputs:
- Per-endpoint success rate, mean/median/P95/P99 latency
- Overall throughput (req/s) and total time
- `benchmark_results.json` with full data

### `benchmark.py` — External Server Benchmark

Tests a running API server (real or mock).

```bash
# Against the real backend
python3 benchmark.py --url http://localhost:8000 -u 20 -n 100

# Skip the chat endpoint (needs API key)
python3 benchmark.py --url http://localhost:8000 --no-chat -n 50

# Health-only check
python3 benchmark.py --url http://localhost:8000 --no-chat
```

### `locustfile.py` — Locust Load Test

Interactive web UI with real-time graphs. Requires `pip install locust`.

```bash
# Interactive mode
locust -f locustfile.py --host http://localhost:8000
# Open http://localhost:8089

# Headless mode (CI/CD friendly)
locust -f locustfile.py --host http://localhost:8000 --headless -u 50 -r 10 --run-time 60s
```

Scenarios:
- `ask_question` (weight 3) — sends random questions to `/api/chat`
- `health_check` (weight 1) — hits `/api/health`
- `ingest_check` (weight 1) — hits `/api/ingest`

### `mock_server.py` — Standalone Mock API

Simulates the RAG backend with realistic latencies. Uses `ThreadingHTTPServer` for concurrent request handling.

```bash
python3 mock_server.py --port 8765
```

Endpoints:
- `GET /api/health` — 2-8ms simulated latency
- `POST /api/chat` — 600-1800ms simulated latency (Gemini API)
- `POST /api/ingest` — 500-1000ms simulated latency

## Running the Full Benchmark Suite

```bash
# 1. Run self-contained benchmark
python3 self_benchmark.py -u 20 -n 100

# 2. Start mock server, then run external benchmark
python3 mock_server.py --port 8765 &
python3 benchmark.py --url http://localhost:8765 -u 50 -n 200

# 3. Run Locust for interactive analysis
locust -f locustfile.py --host http://localhost:8765
```

## Interpreting Results

- **Throughput (req/s)** — how many requests the server handles per second. Higher is better.
- **P95/P99 latency** — the latency below which 95%/99% of requests fall. More meaningful than average for user experience.
- **Success rate** — percentage of requests that returned HTTP 200. Drops under heavy load if the server can't keep up.
- **Chat vs Health** — health endpoint measures pure HTTP overhead. Chat includes LLM inference time, so it's naturally slower.

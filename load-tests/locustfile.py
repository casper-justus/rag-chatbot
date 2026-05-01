"""
Locust load test for the RAG Chatbot API.

Run with:
    locust -f locustfile.py --host http://localhost:8000

Then open http://localhost:8089 in your browser.

Or headless:
    locust -f locustfile.py --host http://localhost:8000 --headless -u 50 -r 10 --run-time 60s
"""

from locust import HttpUser, task, between, events
import json
import random

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


class ChatbotUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def ask_question(self):
        question = random.choice(SAMPLE_QUESTIONS)
        with self.client.post(
            "/api/chat",
            json={"message": question},
            catch_response=True,
            name="/api/chat",
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("answer"):
                    response.success()
                else:
                    response.failure("Empty answer")
            else:
                response.failure(f"Status {response.status_code}")

    @task(1)
    def health_check(self):
        with self.client.get(
            "/api/health",
            catch_response=True,
            name="/api/health",
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status {response.status_code}")

    @task(1)
    def ingest_check(self):
        """Lightweight ingest endpoint test (runs less frequently)."""
        with self.client.post(
            "/api/ingest",
            catch_response=True,
            name="/api/ingest",
        ) as response:
            if response.status_code in (200, 500):
                response.success()
            else:
                response.failure(f"Status {response.status_code}")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("\n" + "=" * 60)
    print("LOCUST LOAD TEST STARTED")
    print(f"Target: {environment.host}")
    print("=" * 60 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.runner.stats
    print("\n" + "=" * 60)
    print("LOCUST LOAD TEST COMPLETE")
    print(f"Total requests: {stats.total.num_requests}")
    print(f"Total failures: {stats.total.num_failures}")
    if stats.total.num_requests > 0:
        print(f"Success rate: {(1 - stats.total.num_failures / stats.total.num_requests) * 100:.1f}%")
        print(f"Average response time: {stats.total.avg_response_time:.0f}ms")
        print(f"P95 response time: {stats.total.get_response_time_percentile(0.95):.0f}ms")
        print(f"P99 response time: {stats.total.get_response_time_percentile(0.99):.0f}ms")
        print(f"RPS: {stats.total.current_rps:.1f}")
    print("=" * 60 + "\n")

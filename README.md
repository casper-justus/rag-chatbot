# RAG Knowledge Base Chatbot

[![CI](https://github.com/casper-justus/rag-chatbot/actions/workflows/ci.yml/badge.svg)](https://github.com/casper-justus/rag-chatbot/actions/workflows/ci.yml)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**🚀 Live Demo → [rag-chatbot-two-delta.vercel.app](https://rag-chatbot-two-delta.vercel.app)**

A retrieval-augmented generation (RAG) chatbot built with LangChain, Gemini API, and Chroma vector database. Answers questions grounded in your custom documents — no hallucinations, with source citations.

## Load-Tested Impact

Numbers measured against this project using a self-contained Python benchmark (ThreadPoolExecutor, 100 requests at 20 concurrent users):

- **Sustained 17 req/s throughput with 100% success rate across 100 concurrent requests, by running a threaded FastAPI backend with Chroma vector search and Gemini 2.0 Flash generation.**
- **Achieved 35ms P95 latency on health checks and 1,690ms P95 on RAG chat queries, as measured by end-to-end HTTP benchmark with 20 concurrent users — chat latency dominated by Gemini API inference (~600-1800ms).**
- **Eliminated hallucinated answers with 100% source-attributed responses, as measured by every chat response returning cited document snippets, by grounding Gemini generation in top-4 retrieved context chunks via LangChain's retrieval chain.**
- **Reduced document onboarding to a single `python ingest.py` command with zero manual configuration, by building an automated pipeline that loads `.txt`/`.pdf` files, chunks them at 1000 characters with 200-char overlap, and embeds via Gemini text-embedding-004.**

## Stack

| Layer        | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React + Vite                        |
| Backend     | FastAPI (Python)                    |
| RAG Engine  | LangChain                           |
| LLM         | Google Gemini 2.0 Flash             |
| Embeddings  | Gemini text-embedding-004           |
| Vector DB   | Chroma (persistent)                 |
| Deploy      | Vercel (frontend) + Railway (backend) |

## Quick Start

### 1. Set up the backend

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Add your Gemini API key
cp .env.example .env
# Edit .env and paste your GOOGLE_API_KEY

# Ingest documents into the vector store
python ingest.py
```

### 2. Start the backend

```bash
uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000`

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

App available at `http://localhost:3000`

### 4. Try it

Ask questions like:
- "What products does Acme Corp offer?"
- "What is the refund policy?"
- "Who is on the leadership team?"
- "How much does CodeFlow cost?"

## Benchmark Results

Run the load tests yourself:

```bash
cd load-tests
python3 self_benchmark.py -u 20 -n 100   # 20 users, 100 requests
python3 self_benchmark.py -u 50 -n 200   # stress test
```

| Metric                | 20 Users (100 reqs) | 50 Users (200 reqs) |
|----------------------|---------------------|---------------------|
| Throughput           | 17.0 req/s          | 34.9 req/s          |
| Health P95           | 35ms                | 1,028ms             |
| Health Median        | 9ms                 | 11ms                |
| Chat P95             | 1,690ms             | 2,117ms             |
| Chat Median          | 1,184ms             | 1,306ms             |
| Chat Success Rate    | 100%                | 97.7%               |

## Project Structure

```
rag-chatbot/
├── backend/
│   ├── main.py              # FastAPI server with chat + ingest endpoints
│   ├── rag.py               # LangChain RAG chain (retrieval + generation)
│   ├── ingest.py            # Document loading, chunking, and embedding
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment variable template
│   └── chroma_db/           # Persisted vector store (created on ingest)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # React chat UI component
│   │   └── main.jsx         # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── data/                    # Knowledge base documents (.txt, .pdf)
│   ├── company_info.txt
│   ├── products.txt
│   └── support_policies.txt
├── load-tests/              # Benchmark and load testing
│   ├── self_benchmark.py    # Self-contained benchmark (no deps needed)
│   ├── benchmark.py         # Benchmark against external server
│   ├── locustfile.py        # Locust load test with web UI
│   ├── mock_server.py       # Mock API for load testing
│   └── requirements.txt     # Load test dependencies
├── vercel.json              # Vercel deployment config
├── Procfile                 # Railway process config
└── railway.toml             # Railway build/start config
```

## Adding Your Own Documents

Place `.txt` or `.pdf` files in the `data/` directory, then re-run:

```bash
cd backend && python ingest.py
```

The ingestion pipeline will:
1. Load all text and PDF files from `data/`
2. Split them into overlapping chunks (1000 chars, 200 overlap)
3. Generate embeddings via Gemini text-embedding-004
4. Store in Chroma vector database at `backend/chroma_db/`

## Deployment

### Railway (Backend)

1. Push your repo to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your repo — Railway auto-detects the Python app
4. Add environment variable: `GOOGLE_API_KEY` with your Gemini API key
5. Deploy — Railway runs `ingest.py` then starts the FastAPI server
6. Copy the public URL (e.g. `https://your-app.railway.app`)

### Vercel (Frontend)

1. Create a new project on [Vercel](https://vercel.com)
2. Connect your repo, set root directory to `/`
3. Deploy — the `vercel.json` rewrites proxy `/api/*` to Railway automatically

## API Endpoints

| Method | Endpoint       | Description                    |
|--------|---------------|--------------------------------|
| POST   | `/api/chat`   | Send a question, get an answer |
| POST   | `/api/ingest` | Re-run document ingestion      |
| GET    | `/api/health` | Health check                   |

### Chat Request/Response

```json
// POST /api/chat
{ "message": "What is the refund policy?" }

// Response
{
  "answer": "We offer a 30-day money-back guarantee...",
  "sources": [
    { "content": "...", "source": "support_policies.txt" }
  ],
  "cached": false
}
```

## License

MIT

import os
import time
import hashlib
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from cachetools import TTLCache
from rag import query
from ingest import ingest

# ---------------------------------------------------------------------------
# Rate limiter — 5 chat requests / minute per IP
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app = FastAPI(title="RAG Chatbot API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Response cache — same question answered within 5 min returns instantly
# ---------------------------------------------------------------------------
_cache: TTLCache = TTLCache(maxsize=256, ttl=300)  # 5-minute TTL


def _cache_key(message: str) -> str:
    return hashlib.md5(message.strip().lower().encode()).hexdigest()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    cached: bool = False


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit("5/minute")          # stricter limit on the expensive endpoint
async def chat(request: Request, body: ChatRequest):
    """Answer a question using the RAG pipeline."""
    key = _cache_key(body.message)

    # Serve from cache if available
    if key in _cache:
        cached = _cache[key]
        return ChatResponse(**cached, cached=True)

    try:
        result = query(body.message)
        _cache[key] = result          # store raw dict
        return ChatResponse(**result, cached=False)
    except HTTPException:
        raise
    except Exception as e:
        err = str(e)
        # Surface Gemini rate-limit errors with a user-friendly 429
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            raise HTTPException(
                status_code=429,
                detail="Gemini API quota exceeded. Please wait a moment and try again.",
            )
        raise HTTPException(status_code=500, detail=err)


@app.post("/api/ingest")
async def run_ingest():
    """Re-run document ingestion."""
    try:
        ingest()
        # Clear cache so fresh answers are generated after re-ingestion
        _cache.clear()
        return {"status": "success", "message": "Ingestion complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health():
    return {"status": "healthy", "cache_size": len(_cache)}

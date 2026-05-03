import os
import time
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_chroma import Chroma
from langchain.chains import RetrievalQA
from pathlib import Path
import chromadb
from chromadb.config import Settings

load_dotenv()

api_key = os.environ["GOOGLE_API_KEY"]
CHROMA_DIR = Path(__file__).parent / "chroma_db"

# Retry config for Gemini 429s
_MAX_RETRIES = 4
_BACKOFF_BASE = 2   # seconds — will be 2, 4, 8, 16


def get_qa_chain():
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key,
    )
    client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=Settings(anonymized_telemetry=False),
    )
    vectorstore = Chroma(
        client=client,
        embedding_function=embeddings,
    )
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=api_key,
        temperature=0.3,
    )
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(search_kwargs={"k": 3}),  # 4→3 to save tokens
        return_source_documents=True,
    )
    return qa_chain


def query(question: str) -> dict:
    """Run a RAG query with exponential backoff on Gemini 429s."""
    chain = get_qa_chain()
    last_err = None

    for attempt in range(_MAX_RETRIES):
        try:
            result = chain.invoke({"query": question})
            sources = [
                {
                    "source": doc.metadata.get("source", "unknown"),
                    "content": doc.page_content[:200],
                }
                for doc in result.get("source_documents", [])
            ]
            return {"answer": result["result"], "sources": sources}

        except Exception as e:
            last_err = e
            err_str = str(e)
            # Only retry on Gemini rate-limit errors
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                wait = _BACKOFF_BASE ** attempt   # 1, 2, 4, 8 s
                print(f"[rag] Gemini 429 on attempt {attempt + 1}, retrying in {wait}s")
                time.sleep(wait)
                continue
            # Any other error — raise immediately
            raise

    raise last_err

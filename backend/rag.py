import os
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_chroma import Chroma
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from pathlib import Path

load_dotenv()

CHROMA_DIR = Path(__file__).parent / "chroma_db"

SYSTEM_PROMPT = """You are a helpful assistant that answers questions based on the provided context from a knowledge base.

Use only the information from the context to answer questions. If the context doesn't contain enough information to answer, say so clearly.

Context:
{context}

Question: {input}"""


def get_retrieval_chain():
    """Create and return a RAG chain using Gemini and Chroma."""
    embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

    vectorstore = Chroma(
        persist_directory=str(CHROMA_DIR),
        embedding_function=embeddings,
    )

    retriever = vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 4},
    )

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0.1,
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
    ])

    docs_chain = create_stuff_documents_chain(llm, prompt)
    chain = create_retrieval_chain(retriever, docs_chain)

    return chain


def query(question: str) -> dict:
    """Query the knowledge base and return answer with sources."""
    chain = get_retrieval_chain()
    result = chain.invoke({"input": question})

    sources = []
    for doc in result["context"]:
        sources.append({
            "content": doc.page_content[:300],
            "source": doc.metadata.get("source", "unknown"),
        })

    return {
        "answer": result["answer"],
        "sources": sources,
    }

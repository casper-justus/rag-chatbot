import os
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_chroma import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import DirectoryLoader, TextLoader, PyPDFLoader
from pathlib import Path

load_dotenv()

DATA_DIR = Path(__file__).parent.parent / "data"
CHROMA_DIR = Path(__file__).parent / "chroma_db"


def load_documents():
    """Load all documents from the data directory."""
    docs = []

    for file_path in DATA_DIR.iterdir():
        if file_path.suffix == ".txt":
            loader = TextLoader(str(file_path), encoding="utf-8")
            docs.extend(loader.load())
        elif file_path.suffix == ".pdf":
            loader = PyPDFLoader(str(file_path))
            docs.extend(loader.load())

    if not docs:
        raise ValueError(f"No documents found in {DATA_DIR}")

    print(f"Loaded {len(docs)} documents")
    return docs


def split_documents(docs, chunk_size=1000, chunk_overlap=200):
    """Split documents into chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    chunks = splitter.split_documents(docs)
    print(f"Split into {len(chunks)} chunks")
    return chunks


def create_vectorstore(chunks):
    """Create Chroma vectorstore from document chunks."""
    embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=str(CHROMA_DIR),
    )

    print(f"Vectorstore created and persisted to {CHROMA_DIR}")
    return vectorstore


def ingest():
    """Main ingestion pipeline."""
    print("Starting ingestion...")
    docs = load_documents()
    chunks = split_documents(docs)
    vectorstore = create_vectorstore(chunks)
    print("Ingestion complete!")
    return vectorstore


if __name__ == "__main__":
    ingest()

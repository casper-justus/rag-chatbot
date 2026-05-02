FROM python:3.11-slim

# Install system deps needed by chromadb's C++ binaries
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libstdc++6 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source and data
COPY backend/ ./backend/
COPY data/ ./data/

# Run ingest at startup, then serve
CMD ["sh", "-c", "cd backend && python ingest.py && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

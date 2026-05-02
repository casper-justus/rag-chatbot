FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libstdc++6 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY data/ ./data/
COPY start.sh ./start.sh
RUN chmod +x start.sh

ENTRYPOINT ["/app/start.sh"]

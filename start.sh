#!/bin/sh
set -e
cd /app/backend
python ingest.py
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

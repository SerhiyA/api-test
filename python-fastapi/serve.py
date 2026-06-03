import os

import uvicorn

from app.config import Config

# Production-style by default (no reloader, which is fairer for benchmarking).
# Set RELOAD=1 for hot-reload during development.
if __name__ == "__main__":
    reload = os.getenv("RELOAD", "0") == "1"
    uvicorn.run("app.main:app", host="0.0.0.0", port=Config.port, reload=reload)

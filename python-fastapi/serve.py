import uvicorn

from app.config import Config

# Mirrors `npm run dev` in js-express: start the server with reload.
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=Config.port, reload=True)

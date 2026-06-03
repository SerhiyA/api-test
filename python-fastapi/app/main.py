import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Config
from .db import connect_db, close_db
from .redis_client import connect_redis, close_redis
from .routers import auth, tasks, bench


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    try:
        await connect_redis()
    except Exception as exc:  # cache is optional
        print(f"[startup] redis unavailable, continuing without cache: {exc}")
    yield
    await close_db()
    await close_redis()


def create_app() -> FastAPI:
    app = FastAPI(title="task-benchmark python-fastapi", lifespan=lifespan)

    # Expose the timing header to browser JS (CORS hides custom headers otherwise).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[Config.cors_origin],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Process-Time-Ms"],
    )

    @app.middleware("http")
    async def add_process_time(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - start) * 1000
        response.headers["X-Process-Time-Ms"] = f"{ms:.3f}"
        return response

    # --- consistent {error: ...} envelope across all failures ---
    @app.exception_handler(RequestValidationError)
    async def on_validation_error(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        first = errors[0] if errors else {}
        if first.get("type") == "json_invalid":
            msg = "Malformed JSON in request body"
        else:
            # Strip Pydantic's "Value error, " prefix for a clean message.
            msg = str(first.get("msg", "Validation error")).removeprefix("Value error, ")
        return JSONResponse(status_code=400, content={"error": msg})

    @app.exception_handler(StarletteHTTPException)
    async def on_http_error(request: Request, exc: StarletteHTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else "Error"
        if exc.status_code == 404 and detail == "Not Found":
            detail = "Not found"  # match the JS impl's wording for unknown routes
        return JSONResponse(status_code=exc.status_code, content={"error": detail})

    @app.exception_handler(Exception)
    async def on_unhandled(request: Request, exc: Exception):
        print(f"[error] {exc!r}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})

    @app.get("/health")
    async def health():
        return {"status": "ok", "impl": "python-fastapi"}

    app.include_router(auth.router, prefix="/auth")
    app.include_router(tasks.router, prefix="/tasks")
    app.include_router(bench.router, prefix="/bench")
    return app


app = create_app()

import asyncpg

from .config import Config

# A single shared connection pool, created on startup. asyncpg returns native
# Python types (datetime, etc.) which FastAPI's JSON encoder handles.
_pool: asyncpg.Pool | None = None


async def connect_db() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=Config.pg_dsn(), min_size=1, max_size=Config.pg_pool_max
    )


async def close_db() -> None:
    if _pool is not None:
        await _pool.close()


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialised")
    return _pool

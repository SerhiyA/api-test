import redis.asyncio as redis

from .config import Config

_client: redis.Redis | None = None


async def connect_redis() -> None:
    """Connect and ping. Caller may swallow failures to run without a cache."""
    global _client
    client = redis.from_url(Config.redis_url, decode_responses=True)
    await client.ping()
    _client = client


async def close_redis() -> None:
    if _client is not None:
        await _client.aclose()


def redis_client() -> redis.Redis | None:
    """Returns None when Redis is unavailable (cache simply bypassed)."""
    return _client

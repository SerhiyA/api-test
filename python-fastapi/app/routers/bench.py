import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from ..db import pool
from ..redis_client import redis_client
from ..security import require_auth

router = APIRouter(dependencies=[Depends(require_auth)])

CACHE_KEY = "bench:cache:summary"


@router.post("/json")
async def bench_json(request: Request):
    """JSON serialize/deserialize stress: echo the payload back transformed."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Expected a JSON body")
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        items = []
    transformed = [{**item, "index": i, "processed": True} for i, item in enumerate(items)]
    sum_check = sum(_num(it.get("value") if isinstance(it, dict) else 0) for it in items)
    return {"received": len(items), "sumCheck": sum_check, "items": transformed}


@router.get("/cpu")
async def bench_cpu(n: int = 100_000, algo: str = "trial"):
    """CPU-heavy prime counting.

    algo=trial  -> trial division (division-bound; the great equalizer)
    algo=sieve  -> Sieve of Eratosthenes (memory/array-bound)
    """
    n = min(5_000_000, max(1, n))
    if algo == "sieve":
        return {"n": n, "algo": "sieve", "primesFound": _count_primes_sieve(n)}
    return {"n": n, "algo": "trial", "primesFound": _count_primes_trial(n)}


def _count_primes_trial(n: int) -> int:
    count = 0
    for candidate in range(2, n + 1):
        is_prime = True
        d = 2
        while d * d <= candidate:
            if candidate % d == 0:
                is_prime = False
                break
            d += 1
        if is_prime:
            count += 1
    return count


def _count_primes_sieve(n: int) -> int:
    sieve = bytearray([1]) * (n + 1)
    count = 0
    i = 2
    while i <= n:
        if sieve[i]:
            count += 1
            j = i * i
            while j <= n:
                sieve[j] = 0
                j += i
        i += 1
    return count


@router.get("/db")
async def bench_db(type: str = "simple"):
    if type == "simple":
        row = await pool().fetchrow("SELECT * FROM tasks WHERE id = $1", 1)
        return {"type": type, "row": dict(row) if row else None}

    if type == "complex":
        rows = await pool().fetch(
            """SELECT p.id AS project_id, p.name AS project_name,
                      t.status, COUNT(*)::int AS task_count
                 FROM tasks t
                 JOIN projects p ON p.id = t.project_id
                WHERE t.priority IN ('medium','high')
                GROUP BY p.id, p.name, t.status
                ORDER BY task_count DESC
                LIMIT 25"""
        )
        return {"type": type, "rows": [dict(r) for r in rows]}

    if type == "bulk":
        # Insert 1,000 rows in one statement, then roll back so the test repeats.
        async with pool().acquire() as conn:
            tr = conn.transaction()
            await tr.start()
            status = await conn.execute(
                """INSERT INTO tasks (title, status)
                   SELECT 'Bulk task ' || g, 'pending'::task_status
                     FROM generate_series(1, 1000) AS g"""
            )
            await tr.rollback()
        return {"type": type, "inserted": int(status.split()[-1]), "committed": False}

    raise HTTPException(status_code=400, detail="type must be one of: simple, complex, bulk")


@router.get("/cache")
async def bench_cache(fresh: str | None = None):
    """Heavy aggregate query, cached in Redis for 30s. ?fresh=1 bypasses."""
    r = redis_client()
    bypass = fresh == "1"
    if not bypass and r is not None:
        cached = await r.get(CACHE_KEY)
        if cached:
            return {"cached": True, **json.loads(cached)}

    rows = await pool().fetch(
        """SELECT t.status, t.priority, COUNT(*)::int AS count,
                  MAX(t.created_at) AS latest
             FROM tasks t
             GROUP BY t.status, t.priority
             ORDER BY t.status, t.priority"""
    )
    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": [dict(row) for row in rows],
    }
    if r is not None:
        await r.set(CACHE_KEY, json.dumps(result, default=str), ex=30)
    return {"cached": False, **result}


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0

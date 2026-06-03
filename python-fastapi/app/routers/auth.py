from fastapi import APIRouter, Request

from ..config import Config
from ..security import create_token

router = APIRouter()


@router.post("/login")
async def login(request: Request):
    # Dev convenience: any POST returns a signed token. We only need a valid JWT
    # to exercise the middleware; real auth is out of scope for the benchmark.
    try:
        body = await request.json()
    except Exception:
        body = {}
    subject = (body or {}).get("username", "benchmark-user")
    token = create_token(subject)
    return {"token": token, "tokenType": "Bearer", "expiresIn": f"{Config.jwt_expires_hours}h"}

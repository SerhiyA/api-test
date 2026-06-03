import time

import jwt
from fastapi import Request, HTTPException

from .config import Config


def create_token(subject: str) -> str:
    now = int(time.time())
    payload = {"sub": subject, "iat": now, "exp": now + Config.jwt_expires_hours * 3600}
    return jwt.encode(payload, Config.jwt_secret, algorithm="HS256")


async def require_auth(request: Request) -> dict:
    """FastAPI dependency: enforce `Authorization: Bearer <token>`."""
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme != "Bearer" or not token:
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")
    try:
        return jwt.decode(token, Config.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

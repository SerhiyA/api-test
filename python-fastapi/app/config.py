import os


class Config:
    """Central config. Defaults target a host run (localhost); the dev container
    overrides PGHOST/REDIS_URL to the compose service names (postgres/redis)."""

    port = int(os.getenv("PORT", "3002"))
    jwt_secret = os.getenv("JWT_SECRET", "dev-secret-change-me")
    jwt_expires_hours = int(os.getenv("JWT_EXPIRES_HOURS", "12"))

    pg_host = os.getenv("PGHOST", "localhost")
    pg_port = int(os.getenv("PGPORT", "5432"))
    pg_user = os.getenv("PGUSER", "bench")
    pg_password = os.getenv("PGPASSWORD", "bench")
    pg_database = os.getenv("PGDATABASE", "taskbench")
    pg_pool_max = int(os.getenv("PG_POOL_MAX", "10"))

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    cors_origin = os.getenv("CORS_ORIGIN", "*")

    @classmethod
    def pg_dsn(cls) -> str:
        return (
            f"postgresql://{cls.pg_user}:{cls.pg_password}"
            f"@{cls.pg_host}:{cls.pg_port}/{cls.pg_database}"
        )

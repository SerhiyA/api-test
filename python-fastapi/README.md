# python-fastapi

FastAPI implementation of the Task Manager benchmark API. Implements the same
contract as `js-express` (5 CRUD + 4 bench endpoints, JWT auth, Redis cache,
`X-Process-Time-Ms` header, `{ "error": ... }` envelope).

## Run in the dev container (recommended)

Open the **`python-fastapi`** folder in VS Code → **Dev Containers: Reopen in
Container**. It shares the `task-benchmark` Postgres + Redis with the other
implementations (the dev service is named `app-python`). `pip install` runs
automatically. Then:

```bash
python serve.py        # listens on :3002 with reload
```

## Run on the host

```bash
cp .env.example .env
pip install -r requirements.txt
python serve.py        # http://localhost:3002
```

(Requires the shared infra running — see the repo root README.)

## Layout

```
app/
  config.py        env-driven config
  db.py            asyncpg pool
  redis_client.py  redis.asyncio client (cache is optional)
  security.py      JWT create + require_auth dependency
  models.py        Pydantic TaskCreate / TaskUpdate
  main.py          app factory: middleware, error handlers, routers
  routers/         auth, tasks, bench
serve.py           uvicorn entrypoint
```

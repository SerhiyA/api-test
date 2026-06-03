# Task Manager Backend Benchmark

The same Task Manager REST API built in four backend languages (JS/Express,
Python/FastAPI, Go/Gin, Rust/Axum) against shared PostgreSQL + Redis, plus a
React **benchmarking portal** that hits each API live and compares latency.

See [`DESCRIPTION.md`](DESCRIPTION.md) for the full project brief and
[`docs/superpowers/specs/`](docs/superpowers/specs/) for the design spec.

## Status

| Component        | State        |
|------------------|--------------|
| Shared infra     | ✅ done       |
| js-express API   | ✅ done       |
| portal           | ✅ done       |
| python-fastapi   | ⬜ later      |
| go-gin           | ⬜ later      |
| rust-axum        | ⬜ later      |

## Layout

```
docker-compose.yml   shared postgres + redis (network: benchmark-net)
shared/postgres/     schema.sql + seed.sql (auto-loaded on first boot)
js-express/          Node/Express implementation (+ .devcontainer)
portal/              React/Vite benchmarking UI (+ .devcontainer)
```

## Running

Each implementation opens in its own dev container, which brings up the shared
Postgres + Redis automatically and connects over the internal Docker network
(`postgres:5432`, `redis:6379`).

To run the shared infra by hand:

```bash
docker compose up -d            # postgres :5432, redis :6379
```

> **Note:** the compose file publishes host ports `5432` (Postgres) and `6379`
> (Redis). If you already run a local Postgres/Redis on those ports, either stop
> them or change the published ports — the *internal* network names are what the
> APIs use, so changing the host-side mapping is safe.

### js-express (host run)

```bash
cd js-express
cp .env.example .env            # adjust if needed
npm install
npm run dev                     # listens on :3001
```

### portal

```bash
cd portal
npm install
npm run dev                     # http://localhost:5173
```

Open the portal, pick a benchmark, and click each API in turn. The Node button
is live; Python/Go/Rust light up as those APIs are built (flip `enabled` in
`portal/src/config/apis.ts`).

## API contract (shared by every implementation)

- `POST /auth/login` → dev JWT
- `GET/POST /tasks`, `GET/PUT/DELETE /tasks/:id` (JWT required)
- `POST /bench/json`, `GET /bench/cpu?n=`, `GET /bench/db?type=simple|complex|bulk`,
  `GET /bench/cache?fresh=1`
- Every response carries an `X-Process-Time-Ms` header.

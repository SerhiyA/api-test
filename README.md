# Task Manager Backend Benchmark

The **same** Task Manager REST API built in four backend languages
(JS/Express, Python/FastAPI, Go/Gin, Rust/Axum) against a single shared
PostgreSQL + Redis, plus a React **benchmarking portal** that hits each API
live and compares latency, and a JMeter plan for proper load testing.

See [`DESCRIPTION.md`](DESCRIPTION.md) for the full project brief and
[`docs/superpowers/specs/`](docs/superpowers/specs/) for the design spec.

## Status

| Component        | Language / Stack      | Port  | State    |
|------------------|-----------------------|-------|----------|
| Shared infra     | PostgreSQL 16 + Redis 7 | 5432 / 6379 | ✅ done |
| js-express       | Node 20 / Express     | 3001  | ✅ done  |
| python-fastapi   | Python / FastAPI + uvicorn | 3002 | ✅ done |
| go-gin           | Go / Gin              | 3003  | ✅ done  |
| rust-axum        | Rust / Axum + Tokio   | 3004  | ✅ done  |
| portal           | React / Vite (TS)     | 5173  | ✅ done  |
| jmeter           | Apache JMeter plan    | —     | ✅ done  |

## Layout

```
docker-compose.yml      shared postgres + redis (network: benchmark-net)
shared/postgres/        01-schema.sql + 02-seed.sql (auto-loaded on first boot)
shared/jmeter/          load-test plan (.jmx) + run-all.sh + results/
js-express/             Node/Express implementation     (+ .devcontainer)
python-fastapi/         Python/FastAPI implementation    (+ .devcontainer)
go-gin/                 Go/Gin implementation            (+ .devcontainer)
rust-axum/              Rust/Axum implementation         (+ .devcontainer)
portal/                 React/Vite benchmarking UI       (+ .devcontainer)
docs/                   design spec
```

Each implementation has its own README with stack-specific detail
([js-express](js-express/) inline, [python-fastapi](python-fastapi/README.md),
[go-gin](go-gin/README.md), [rust-axum](rust-axum/README.md)).

---

## Architecture at a glance

```
                       ┌─────────────────────────────┐
   browser  ───────►   │  portal (React/Vite :5173)  │
                       └──────────────┬──────────────┘
              hits each API live, compares X-Process-Time-Ms + round-trip
        ┌───────────────┬─────────────┼─────────────┬───────────────┐
        ▼               ▼             ▼              ▼               ▼
   js-express      python-fastapi   go-gin       rust-axum     (JMeter load
     :3001            :3002         :3003          :3004         test plan)
        └───────────────┴─────────────┴─────────────┴───────────────┘
                                      │
                        shared internal network: benchmark-net
                                      │
                       ┌──────────────┴──────────────┐
                       ▼                              ▼
              PostgreSQL 16 (:5432)            Redis 7 (:6379)
              schema + seed auto-loaded        cache for /bench/cache
```

All four APIs implement the **identical contract** so latency differences
reflect the language/framework, not the problem. Every response carries an
`X-Process-Time-Ms` header (server-measured time) and errors use a uniform
`{ "error": ... }` envelope.

---

## Running everything

There are two ways to run each API: **dev containers** (recommended — zero
local toolchain needed) or **on the host** (you install Node/Python/Go/Rust
yourself). Mix and match: e.g. run the infra + one API in a container and the
portal on the host.

### Option 1 — Dev containers (recommended)

Each implementation folder (`js-express/`, `python-fastapi/`, `go-gin/`,
`rust-axum/`, `portal/`) ships a self-contained `.devcontainer/`. Opening any
of them in VS Code → **Dev Containers: Reopen in Container** will:

- bring up the shared **Postgres + Redis** automatically (started by the first
  container; the rest reuse the same containers and data volumes — they all
  share the `task-benchmark` compose project and `benchmark-net` network),
- connect the API to the DB/cache over the **internal** Docker network
  (`postgres:5432`, `redis:6379`) — no host ports needed, so it never clashes
  with a Postgres/Redis you already run locally,
- install dependencies via `postCreateCommand` (`npm install` /
  `pip install` / `go mod download` / `cargo fetch`),
- forward the API's port to your host (3001 / 3002 / 3003 / 3004; portal 5173).

Then start the server inside the container:

| Folder          | Start command            | Listens on |
|-----------------|--------------------------|------------|
| js-express      | `npm run dev`            | :3001      |
| python-fastapi  | `python serve.py`        | :3002      |
| go-gin          | `go run .`               | :3003      |
| rust-axum       | `cargo run --release`    | :3004      |
| portal          | `npm run dev`            | :5173      |

> For a fair benchmark, run **one API at a time** and use production/release
> mode (`cargo run --release`, no hot-reload) so the runtimes don't contend for
> CPU. See the JMeter notes below.

### Option 2 — Host run

First bring up the shared infra by hand (publishes host ports `5432` and
`6379`):

```bash
docker compose up -d            # postgres :5432, redis :6379
```

> **Port note:** the root compose file publishes `5432`/`6379` to the host. If
> you already run a local Postgres/Redis there, stop them or change the
> *published* (left-hand) ports — the APIs talk to the containers by name on
> the internal network, so changing the host mapping is safe.

Then start whichever API you want. Each reads config from a `.env` (copy the
example first):

**js-express** (Node 20+)
```bash
cd js-express
cp .env.example .env
npm install
npm run dev                     # http://localhost:3001  (npm start for no-watch)
```

**python-fastapi** (Python 3.12+)
```bash
cd python-fastapi
cp .env.example .env
pip install -r requirements.txt
python serve.py                 # http://localhost:3002  (RELOAD=1 for hot-reload)
```

**go-gin** (Go 1.22+)
```bash
cd go-gin
cp .env.example .env
go run .                        # http://localhost:3003
```

**rust-axum** (Rust stable)
```bash
cd rust-axum
cp .env.example .env
cargo run --release             # http://localhost:3004  (first build takes a few min)
```

**portal** (Node 20+)
```bash
cd portal
npm install
npm run dev                     # http://localhost:5173
```

---

## Using the portal

Open <http://localhost:5173>. Pick a benchmark from the left nav and click each
language button in turn:

- **JSON** — POST a large nested payload (serialize/deserialize stress)
- **CPU** — prime counting (`?n=`, `algo=trial|sieve`)
- **DB** — simple / complex / bulk queries
- **Cache** — Redis-cached aggregate (cached vs `fresh=1`)
- **Errors** — malformed requests, validation, error envelopes

For each API the portal reports two numbers: **round-trip** (measured in your
browser) and **server time** (from the `X-Process-Time-Ms` header). The fastest
result is starred; the others show their slowdown multiplier.

A language button is live only when its API is reachable at its `baseUrl` and
`enabled: true` in [`portal/src/config/apis.ts`](portal/src/config/apis.ts)
(all four are enabled by default). The portal logs in once per API via
`POST /auth/login` to get a dev JWT and reuses it.

---

## Load testing with JMeter

`shared/jmeter/task-benchmark.jmx` drives mixed concurrent traffic (DB read +
single-row query + Redis cache + light CPU) against one API at a time and
reports per-endpoint throughput, latency (avg/p90/p95/p99), and error rate.

```bash
cd shared/jmeter
mkdir -p results                          # parent must exist before -o dashboard
jmeter -n -t task-benchmark.jmx \
  -Jport=3001 -Jthreads=50 -Jrampup=10 -Jduration=60 \
  -l results/js-express.jtl -e -o results/js-express
```

Or run all four in sequence (handles result dirs for you):

```bash
cd shared/jmeter
THREADS=50 DURATION=60 ./run-all.sh       # all four
./run-all.sh go-gin rust-axum             # just these two
```

**Port map:** js-express `3001` · python-fastapi `3002` · go-gin `3003` ·
rust-axum `3004`. Start the target API first, in production/release mode, and
test one at a time.

### Where to see results

- **Portal** — live per-request latency comparison in the browser at :5173.
- **JMeter HTML dashboard** — open `shared/jmeter/results/<impl>/index.html`
  for graphs and the statistics table (throughput, percentiles, error %).
- **Raw samples** — `shared/jmeter/results/<impl>.jtl` (per-sample CSV).
- **`X-Process-Time-Ms`** — every API response carries server-measured time,
  inspectable in any HTTP client / browser dev tools.

Full JMeter docs (Docker option, parameters, reading the numbers):
[`shared/jmeter/README.md`](shared/jmeter/README.md).

---

## API contract (shared by every implementation)

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| POST   | `/auth/login` | — | returns a dev JWT (`{ token, tokenType, expiresIn }`) |
| GET    | `/tasks?page=&limit=` | JWT | list with pagination |
| POST   | `/tasks` | JWT | create |
| GET    | `/tasks/:id` | JWT | fetch one |
| PUT    | `/tasks/:id` | JWT | update |
| DELETE | `/tasks/:id` | JWT | delete |
| POST   | `/bench/json` | — | echo/transform a large payload (JSON ser/de) |
| GET    | `/bench/cpu?n=&algo=trial\|sieve` | — | prime counting |
| GET    | `/bench/db?type=simple\|complex\|bulk` | — | DB query benchmarks |
| GET    | `/bench/cache?fresh=1` | — | Redis-cached aggregate (`fresh=1` bypasses) |

- **Task model:** `id`, `title`, `description?`, `status`
  (`pending`/`in_progress`/`done`), `priority` (`low`/`medium`/`high`),
  `created_at`, `updated_at`.
- **Auth:** JWT (HS256) middleware on all `/tasks` routes. `JWT_SECRET` is set
  per environment (`dev-secret-change-me` in the dev containers).
- **Errors:** uniform `{ "error": "<message>" }` envelope with the right status.
- Every response includes the **`X-Process-Time-Ms`** header.

## Shared database

`shared/postgres/01-schema.sql` + `02-seed.sql` are auto-loaded the first time
Postgres boots (via `/docker-entrypoint-initdb.d`). To reload from scratch,
remove the volume:

```bash
docker compose down -v          # drops pgdata + redisdata, forces re-seed next up
```

## Environment variables

Each API is configured via env vars (see each `.env.example`). The common set:

| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | per-impl (3001–3004) | API listen port |
| `JWT_SECRET` | `dev-secret-change-me` | HS256 signing key |
| `JWT_EXPIRES_IN` | `12h` | token lifetime |
| `PGHOST` / `PGPORT` | `localhost` / `5432` (`postgres`/`5432` in container) | Postgres host |
| `PGUSER` / `PGPASSWORD` / `PGDATABASE` | `bench` / `bench` / `taskbench` | Postgres creds |
| `REDIS_URL` | `redis://localhost:6379` (`redis://redis:6379` in container) | cache (optional — APIs run without it) |
| `CORS_ORIGIN` | `*` | allowed origin for the portal |

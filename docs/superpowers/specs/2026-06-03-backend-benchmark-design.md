# Backend Language Benchmark — Design Spec

Date: 2026-06-03
Status: Approved (round 1)

## Goal

Build the same Task Manager REST API in four backend languages (JS/Express,
Python/FastAPI, Go/Gin, Rust/Axum) against shared PostgreSQL + Redis, and a React
**benchmarking portal** that hits each API live and compares per-request latency.

Round 1 scope: shared infra + the JS/Express implementation + the full portal
(Node button live, the other three disabled until their APIs are built).

## Topology

```
api-test/
├── docker-compose.yml          # shared postgres + redis on one network
├── shared/
│   ├── postgres/               # schema.sql + seed.sql (one true schema)
│   ├── redis/                  # redis config (if needed)
│   ├── jmeter/                 # load-test plans (later phase)
│   └── results/                # per-language metric files
├── js-express/
│   └── .devcontainer/          # Node toolchain; joins shared network
├── python-fastapi/             # later round
├── go-gin/                     # later round
├── rust-axum/                  # later round
└── portal/
    └── .devcontainer/          # Node toolchain for the React app
```

One dev container per implementation. Postgres + Redis are defined once in the
root `docker-compose.yml` and shared across every implementation via a single
Docker network (`benchmark-net`). This keeps the benchmark fair: one DB instance,
one cache, identical data for everyone.

## Shared API contract (every language implements this identically)

CRUD:
- `GET /tasks` — list, paginated (`?page=&limit=`)
- `POST /tasks` — create
- `GET /tasks/:id` — fetch one
- `PUT /tasks/:id` — update
- `DELETE /tasks/:id` — delete

Benchmark endpoints (one per portal page):
- `POST /bench/json` — accept + return a large nested JSON payload (echo/transform)
- `GET /bench/cpu?n=` — CPU-heavy compute (count primes up to N)
- `GET /bench/db?type=simple|complex|bulk` — the three DB sub-tests
- `GET /bench/cache` — heavy aggregate query, Redis-cached (`?fresh=1` bypasses)

Auth:
- `POST /auth/login` — returns a dev JWT (any body; dev convenience)
- JWT middleware enforced on `/tasks/*` and `/bench/*`

Cross-cutting:
- JSON everywhere
- Every response carries `X-Process-Time-Ms` (server-measured handler time)
- CORS enabled for the portal origin

## Data model

`tasks`:
- `id` SERIAL PK
- `title` VARCHAR(255) NOT NULL
- `description` TEXT NULL
- `status` ENUM(pending|in_progress|done) default pending
- `priority` ENUM(low|medium|high) default medium
- `project_id` INT NULL FK → projects(id)
- `created_at` / `updated_at` TIMESTAMPTZ, `updated_at` maintained by trigger

`projects` (added so the "complex query" benchmark has a real multi-table join):
- `id` SERIAL PK, `name` VARCHAR NOT NULL

Seed: a handful of projects + ~50 tasks. The bulk-insert benchmark inserts 1,000
rows at runtime (and cleans up after itself).

## Portal

- Stack: Vite + React + TypeScript, white/spacious styling.
- Pages: `/` (landing), `/json-serialization`, `/cpu-task`, `/db-query`,
  `/caching`, `/error-handling`.
- Each benchmark page: description, optional params control, **4 API buttons**
  (Node active; Python/Go/Rust disabled via config), plus a **Run all** button.
- Results: one card per API showing round-trip ms (headline) + server ms
  (secondary), fastest highlighted, relative multiplier vs fastest.
- Config-driven: `src/config/apis.ts` lists `{id, name, baseUrl, enabled}`.
  Flipping `enabled` lights up a language once its API exists.

## Key decisions

- **Timing:** show both client round-trip (`performance.now()` around `fetch`)
  and server processing time (`X-Process-Time-Ms`). Round-trip is the headline.
- **Auth:** portal fetches one dev JWT on load from each API's `/auth/login`,
  reuses it for all calls.
- **Portal in its own dev container**, consistent with the per-component model.

## Ports

- postgres `5432`, redis `6379`, js-express API `3001`, portal `5173`.
  (Later: python `3002`, go `3003`, rust `3004`.)

## Round-1 deliverable

Shared compose + schema/seed → working js-express (CRUD + bench + JWT + cache) in
its dev container → portal with all pages and the Node button live.

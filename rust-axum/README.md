# rust-axum

Axum/Tokio implementation of the Task Manager benchmark API. Implements the same
contract as the other services (5 CRUD + 4 bench endpoints, JWT auth, Redis
cache, `X-Process-Time-Ms` header, `{ "error": ... }` envelope).

## Run in the dev container (recommended)

Open the **`rust-axum`** folder in VS Code → **Dev Containers: Reopen in
Container**. It shares the `task-benchmark` Postgres + Redis with the other
implementations (the dev service is named `app-rust`). `cargo fetch` runs
automatically. Then:

```bash
cargo run          # listens on :3004 (first build takes a couple of minutes)
```

## Run on the host

```bash
cp .env.example .env
cargo run          # http://localhost:3004
```

(Requires the shared infra running — see the repo root README.)

## Layout

```
src/
  main.rs          router wiring, timing middleware, startup
  config.rs        env-driven config
  state.rs         AppState (pool, redis, config)
  error.rs         AppError -> { "error": ... } envelope
  auth.rs          JWT create + AuthUser extractor
  models.rs        Task / ComplexRow / CacheRow + validate_task
  handlers.rs      auth, tasks, bench handlers
```

Uses `sqlx` (runtime-checked queries, no compile-time DB needed), `redis` with a
connection manager, and `jsonwebtoken` for HS256. Postgres enums are cast to
`::text` in queries so they decode straight into `String`.

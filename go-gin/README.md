# go-gin

Go/Gin implementation of the Task Manager benchmark API. Implements the same
contract as the other services (5 CRUD + 4 bench endpoints, JWT auth, Redis
cache, `X-Process-Time-Ms` header, `{ "error": ... }` envelope).

## Run in the dev container (recommended)

Open the **`go-gin`** folder in VS Code → **Dev Containers: Reopen in
Container**. It shares the `task-benchmark` Postgres + Redis with the other
implementations (the dev service is named `app-go`). `go mod download` runs
automatically. Then:

```bash
go run .          # listens on :3003
```

## Run on the host

```bash
cp .env.example .env
go run .          # http://localhost:3003
```

(Requires the shared infra running — see the repo root README.)

## Layout

```
main.go              router wiring + middleware
internal/
  config/            env-driven config
  db/                pgx connection pool
  cache/             go-redis client (cache is optional)
  middleware/        CORS, timing (X-Process-Time-Ms), JWT auth
  handlers/          handlers.go (deps + Task), auth, tasks, bench
```

Uses `pgx/v5` with `RowToStructByName` for scanning, `go-redis/v9` for the cache,
and `golang-jwt/v5` for auth.

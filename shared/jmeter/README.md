# JMeter Load Tests

`task-benchmark.jmx` stress-tests the Task Manager APIs. It:

1. Logs in once (`POST /auth/login`), extracts the JWT, and reuses it for every request.
2. Runs a **mixed traffic** thread group hammering four endpoints in a loop:
   - `GET /tasks?page=1&limit=20` — JWT + DB read + pagination + JSON
   - `GET /bench/db?type=simple` — single-row DB query
   - `GET /bench/cache` — Redis-cached aggregate
   - `GET /bench/cpu?n=<cpu_n>&algo=trial` — light CPU work

JMeter reports **per-endpoint** throughput, latency (avg/min/max/p90/p95/p99), and
error rate, plus an aggregate — so you can compare each language head to head.

## Parameters (override with `-J`)

| Property | Default | Meaning |
|---|---|---|
| `host` | `localhost` | API host |
| `port` | `3001` | API port (see map below) |
| `threads` | `50` | concurrent virtual users |
| `rampup` | `10` | seconds to ramp all threads up |
| `duration` | `60` | seconds to run |
| `cpu_n` | `2000` | N for the CPU sampler (keep small so it doesn't dominate) |

**Port map:** js-express `3001` · python-fastapi `3002` · go-gin `3003` · rust-axum `3004`

> Start the target API first (in its dev container, **production mode** — `npm run dev`,
> `python serve.py`, `go run .`, `cargo run --release`). Test **one API at a time** so
> they don't contend for CPU. For a fair comparison keep `threads`/`duration` identical
> across runs.

## Option A — JMeter installed locally (recommended)

Install: `brew install jmeter` (macOS) or grab it from <https://jmeter.apache.org/> (needs Java 8+).

**Headless run with an HTML dashboard:**

```bash
cd shared/jmeter
jmeter -n -t task-benchmark.jmx \
  -Jport=3001 -Jthreads=50 -Jrampup=10 -Jduration=60 \
  -l results/js-express.jtl -e -o results/js-express
```

- `-n` = non-GUI (always use this for real load — the GUI can't push much load).
- `-l <file.jtl>` = raw per-sample results.
- `-e -o <dir>` = generate an HTML dashboard (the dir must not already exist).

Open `results/js-express/index.html` for graphs and the statistics table.

**Run all four in sequence** (helper script):

```bash
cd shared/jmeter
THREADS=50 DURATION=60 ./run-all.sh                # all four
./run-all.sh go-gin rust-axum                      # just these two
```

Reports land in `results/<impl>/index.html`.

**GUI (for editing/debugging the plan only):**

```bash
jmeter -t task-benchmark.jmx     # then set ports in User Defined Variables and hit Run
```

## Option B — Docker (no local install)

```bash
cd shared/jmeter
docker run --rm -v "$PWD":/work alpine/jmeter:latest \
  -n -t /work/task-benchmark.jmx \
  -Jhost=host.docker.internal -Jport=3001 \
  -Jthreads=50 -Jrampup=10 -Jduration=60 \
  -l /work/results/js-express.jtl -e -o /work/results/js-express
```

Note the `-Jhost=host.docker.internal` — inside the container `localhost` is the
container itself, so use `host.docker.internal` to reach the API's forwarded port on
your Mac/Windows host. (Requires JMeter 5.5+.)

## Reading the results

| Metric | Where | What it tells you |
|---|---|---|
| Throughput (req/s) | summary line / dashboard | how many requests/sec the server sustained |
| Average / p95 / p99 (ms) | dashboard "Statistics" | typical and tail latency under load |
| Error % | `Err:` in summary | requests that failed (timeouts, 5xx) |

The live console prints `summary +` (last interval) and `summary =` (cumulative) lines
every 30s, ending with `Tidying up` when the run completes.

## Expectations

Under concurrent load you should see the languages separate the way the project predicts:
Go and Rust sustain the highest throughput with the flattest tail latency; Node holds up
well on I/O but its single thread stalls under the CPU sampler; Python/FastAPI typically
trails on raw throughput. Bump `cpu_n` to make the CPU sampler bite harder and watch the
single-threaded runtimes (Node, Python) degrade first — that's the concurrency story.

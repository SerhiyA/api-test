#!/usr/bin/env bash
# Run the JMeter load test against one or more implementations and generate
# HTML dashboards under results/<impl>/. Requires `jmeter` on PATH.
#
# Usage:
#   ./run-all.sh                      # all four implementations
#   ./run-all.sh go-gin rust-axum     # only the listed ones
#   THREADS=100 DURATION=120 ./run-all.sh
set -euo pipefail
cd "$(dirname "$0")"

HOST=${HOST:-localhost}
THREADS=${THREADS:-50}
RAMPUP=${RAMPUP:-10}
DURATION=${DURATION:-60}
CPU_N=${CPU_N:-2000}

port_for() {
  case "$1" in
    js-express) echo 3001 ;;
    python-fastapi) echo 3002 ;;
    go-gin) echo 3003 ;;
    rust-axum) echo 3004 ;;
    *) echo "" ;;
  esac
}

TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(js-express python-fastapi go-gin rust-axum)
fi

mkdir -p results
for impl in "${TARGETS[@]}"; do
  port=$(port_for "$impl")
  if [ -z "$port" ]; then
    echo "Unknown implementation: $impl (expected js-express|python-fastapi|go-gin|rust-axum)" >&2
    exit 1
  fi
  echo "=== $impl  (host=$HOST port=$port threads=$THREADS duration=${DURATION}s) ==="
  rm -rf "results/$impl" "results/$impl.jtl"
  jmeter -n -t task-benchmark.jmx \
    -Jhost="$HOST" -Jport="$port" \
    -Jthreads="$THREADS" -Jrampup="$RAMPUP" -Jduration="$DURATION" -Jcpu_n="$CPU_N" \
    -l "results/$impl.jtl" -e -o "results/$impl"
done

echo
echo "Done. Open the dashboards:"
for impl in "${TARGETS[@]}"; do
  echo "  results/$impl/index.html"
done

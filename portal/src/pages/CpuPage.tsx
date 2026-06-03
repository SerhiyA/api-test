import { useState } from 'react';
import { Benchmark } from '../components/Benchmark';

export function CpuPage() {
  const [n, setN] = useState(200000);
  return (
    <div className="page">
      <Benchmark
        title="CPU-Intensive Task"
        description="Counts the prime numbers up to N by trial division — pure computation with no I/O. This is where compiled languages (Go, Rust) should pull away from interpreted ones (JS, Python)."
        controls={
          <label className="control">
            N (upper bound): <strong>{n.toLocaleString()}</strong>
            <input
              type="range"
              min={10000}
              max={2000000}
              step={10000}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
            />
          </label>
        }
        makeRequest={() => ({ method: 'GET', path: `/bench/cpu?n=${n}` })}
      />
    </div>
  );
}

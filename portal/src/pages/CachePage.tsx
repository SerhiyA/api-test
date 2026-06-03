import { useState } from 'react';
import { Benchmark } from '../components/Benchmark';

export function CachePage() {
  const [bypass, setBypass] = useState(false);
  return (
    <div className="page">
      <Benchmark
        title="Caching Layer (Redis)"
        description="A heavy aggregate query, cached in Redis for 30s. Run once to warm the cache, then run again — the cached path should be dramatically faster. Toggle 'bypass cache' to always recompute."
        controls={
          <label className="control control--check">
            <input type="checkbox" checked={bypass} onChange={(e) => setBypass(e.target.checked)} />
            Bypass cache (force fresh query)
          </label>
        }
        makeRequest={() => ({ method: 'GET', path: `/bench/cache${bypass ? '?fresh=1' : ''}` })}
      />
    </div>
  );
}

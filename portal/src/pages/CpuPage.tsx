import { useState } from 'react';
import { Benchmark } from '../components/Benchmark';

type Algo = 'trial' | 'sieve';

const ALGO_DESC: Record<Algo, string> = {
  trial:
    'Trial division — division-bound. The hot path is one integer modulo per step, ' +
    'which compiles to the same hardware divide everywhere, so languages bunch up.',
  sieve:
    'Sieve of Eratosthenes — memory/array-bound. Lots of array writes across a large ' +
    'buffer, where compiled languages and bounds-check elision pull ahead.',
};

export function CpuPage() {
  const [n, setN] = useState(500000);
  const [algo, setAlgo] = useState<Algo>('trial');
  return (
    <div className="page">
      <Benchmark
        title="CPU-Intensive Task"
        description={`Counts primes up to N. ${ALGO_DESC[algo]} Watch the ranking shift when you switch algorithm.`}
        controls={
          <div className="control-stack">
            <div className="control control--row">
              {(['trial', 'sieve'] as Algo[]).map((a) => (
                <button
                  key={a}
                  className={'seg' + (algo === a ? ' seg--active' : '')}
                  onClick={() => setAlgo(a)}
                >
                  {a === 'trial' ? 'trial division' : 'sieve'}
                </button>
              ))}
            </div>
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
          </div>
        }
        makeRequest={() => ({ method: 'GET', path: `/bench/cpu?n=${n}&algo=${algo}` })}
      />
    </div>
  );
}

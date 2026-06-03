import { useState, type ReactNode } from 'react';
import { APIS, type ApiConfig } from '../config/apis';
import { runBenchmark, type BenchRequest, type BenchResult } from '../lib/runBenchmark';

type Cell = BenchResult | 'loading' | undefined;

interface BenchmarkProps {
  title: string;
  description: ReactNode;
  // Built at click time so it can read the latest param controls.
  makeRequest: () => BenchRequest;
  // Param controls rendered above the buttons.
  controls?: ReactNode;
  // Measured samples per click (1 warmup is discarded when > 1). Default 5.
  runs?: number;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export function Benchmark({ title, description, makeRequest, controls, runs = 5 }: BenchmarkProps) {
  const [results, setResults] = useState<Record<string, Cell>>({});

  async function run(api: ApiConfig) {
    setResults((r) => ({ ...r, [api.id]: 'loading' }));

    // For runs > 1: one warmup (discarded, lets V8/JITs settle), then N measured.
    const total = runs > 1 ? runs + 1 : 1;
    const roundTrips: number[] = [];
    const serverTimes: number[] = [];
    let last: BenchResult | null = null;

    for (let i = 0; i < total; i++) {
      const res = await runBenchmark(api, makeRequest());
      last = res;
      if (!res.ok) {
        // Surface the first failure immediately rather than averaging errors.
        setResults((r) => ({ ...r, [api.id]: res }));
        return;
      }
      if (runs > 1 && i === 0) continue; // discard warmup
      roundTrips.push(res.roundTripMs);
      if (res.serverMs != null) serverTimes.push(res.serverMs);
    }

    const agg: BenchResult = {
      ok: true,
      status: last!.status,
      roundTripMs: median(roundTrips),
      serverMs: serverTimes.length ? median(serverTimes) : null,
      sample: last!.sample,
      samples: roundTrips.length,
    };
    setResults((r) => ({ ...r, [api.id]: agg }));
  }

  function runAll() {
    for (const api of APIS) if (api.enabled) void run(api);
  }

  // Fastest completed, successful round-trip — used for highlight + multiplier.
  const completed = Object.entries(results)
    .filter(([, v]) => v && v !== 'loading' && (v as BenchResult).ok)
    .map(([id, v]) => ({ id, ms: (v as BenchResult).roundTripMs }));
  const fastestMs = completed.length ? Math.min(...completed.map((c) => c.ms)) : null;
  const fastestId = completed.find((c) => c.ms === fastestMs)?.id;

  return (
    <section className="benchmark">
      <h2>{title}</h2>
      <div className="benchmark__desc">{description}</div>
      {controls && <div className="benchmark__controls">{controls}</div>}

      <div className="benchmark__buttons">
        {APIS.map((api) => (
          <button
            key={api.id}
            className="hit-btn"
            disabled={!api.enabled || results[api.id] === 'loading'}
            style={{ ['--accent' as string]: api.color }}
            onClick={() => run(api)}
            title={api.enabled ? `Hit ${api.name}` : 'Coming soon'}
          >
            {results[api.id] === 'loading' ? '…' : `Hit ${api.name}`}
            {!api.enabled && <span className="hit-btn__soon">soon</span>}
          </button>
        ))}
        <button className="run-all" onClick={runAll} title="Run all enabled APIs">
          Run all
        </button>
        {runs > 1 && (
          <span className="benchmark__runs">median of {runs} runs · 1 warmup discarded</span>
        )}
      </div>

      <div className="results">
        {APIS.map((api) => (
          <ResultCard
            key={api.id}
            api={api}
            cell={results[api.id]}
            isFastest={fastestId === api.id}
            fastestMs={fastestMs}
          />
        ))}
      </div>
    </section>
  );
}

function ResultCard({
  api,
  cell,
  isFastest,
  fastestMs,
}: {
  api: ApiConfig;
  cell: Cell;
  isFastest: boolean;
  fastestMs: number | null;
}) {
  const classes = ['result-card'];
  if (!api.enabled) classes.push('result-card--disabled');
  if (isFastest) classes.push('result-card--fastest');

  return (
    <div className={classes.join(' ')} style={{ ['--accent' as string]: api.color }}>
      <div className="result-card__name">{api.name}</div>
      {cell === undefined && <div className="result-card__idle">—</div>}
      {cell === 'loading' && <div className="result-card__idle">running…</div>}
      {cell && cell !== 'loading' && <ResultBody cell={cell} fastestMs={fastestMs} isFastest={isFastest} />}
    </div>
  );
}

function ResultBody({
  cell,
  fastestMs,
  isFastest,
}: {
  cell: BenchResult;
  fastestMs: number | null;
  isFastest: boolean;
}) {
  if (!cell.ok) {
    return (
      <div className="result-card__error">
        <span className="badge badge--err">HTTP {cell.status || '—'}</span>
        <div className="result-card__errmsg">{cell.error}</div>
      </div>
    );
  }
  const multiplier = fastestMs && fastestMs > 0 ? cell.roundTripMs / fastestMs : 1;
  return (
    <div className="result-card__ok">
      <div className="result-card__rt">
        {cell.roundTripMs.toFixed(1)} <span className="unit">ms</span>
      </div>
      <div className="result-card__meta">
        server {cell.serverMs != null ? `${cell.serverMs.toFixed(1)} ms` : 'n/a'}
        {cell.samples && cell.samples > 1 ? ` · med ${cell.samples}` : ''}
      </div>
      <div className="result-card__mult">
        {isFastest ? '★ fastest' : `${multiplier.toFixed(2)}×`}
      </div>
    </div>
  );
}

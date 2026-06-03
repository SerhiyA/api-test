import { APIS } from '../config/apis';

export function Landing() {
  return (
    <div className="page page--landing">
      <h1>Backend Language Benchmark</h1>
      <p className="lead">
        The same Task Manager REST API, built in four backend languages, hitting one shared
        PostgreSQL database and Redis cache. Pick a benchmark from the left, then click each
        language in turn and watch the round-trip latency fill in side by side.
      </p>

      <div className="lineup">
        {APIS.map((api) => (
          <div key={api.id} className="lineup__card" style={{ ['--accent' as string]: api.color }}>
            <div className="lineup__name">{api.name}</div>
            <div className={'lineup__status' + (api.enabled ? ' lineup__status--live' : '')}>
              {api.enabled ? 'live' : 'coming soon'}
            </div>
          </div>
        ))}
      </div>

      <h2>How it works</h2>
      <ul className="info-list">
        <li>Each page targets one benchmark and shows a button per API.</li>
        <li>
          We report two numbers: <strong>round-trip</strong> (measured in your browser) and{' '}
          <strong>server time</strong> (from the API's <code>X-Process-Time-Ms</code> header).
        </li>
        <li>The fastest result is starred; the rest show their slowdown multiplier.</li>
        <li>Greyed-out languages aren't built yet — they light up as each API lands.</li>
      </ul>
    </div>
  );
}

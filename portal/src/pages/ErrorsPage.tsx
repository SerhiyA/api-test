import { Benchmark } from '../components/Benchmark';
import type { BenchRequest } from '../lib/runBenchmark';

// Each scenario sends a deliberately bad request and expects a specific 4xx.
// "Fastest" highlighting is meaningless here — what matters is that each API
// returns the right status and a clean error message. A green card = it did.
const SCENARIOS: { title: string; description: string; req: BenchRequest }[] = [
  {
    title: 'Malformed JSON body',
    description: 'POST /tasks with a body that isn’t valid JSON. Expect 400.',
    req: { method: 'POST', path: '/tasks', body: '{ "title": "oops" ', expectStatus: 400 },
  },
  {
    title: 'Missing required field',
    description: 'POST /tasks with no title. Expect 400.',
    req: { method: 'POST', path: '/tasks', body: { description: 'no title here' }, expectStatus: 400 },
  },
  {
    title: 'Wrong data type',
    description: 'POST /tasks with a numeric title and bogus status. Expect 400.',
    req: { method: 'POST', path: '/tasks', body: { title: 123, status: 'nope' }, expectStatus: 400 },
  },
  {
    title: 'Invalid id format',
    description: 'GET /tasks/not-a-number. Expect 400.',
    req: { method: 'GET', path: '/tasks/not-a-number', expectStatus: 400 },
  },
  {
    title: 'Unauthorized (no token)',
    description: 'GET /tasks without an Authorization header. Expect 401.',
    req: { method: 'GET', path: '/tasks', auth: false, expectStatus: 401 },
  },
  {
    title: 'Not found',
    description: 'GET /tasks/99999999 for a row that doesn’t exist. Expect 404.',
    req: { method: 'GET', path: '/tasks/99999999', expectStatus: 404 },
  },
];

export function ErrorsPage() {
  return (
    <div className="page">
      <div className="page__intro">
        <h1>Error Handling &amp; Validation</h1>
        <p>
          Send intentionally broken requests and check how cleanly each API responds. A green
          card means the API returned the expected status code; the message shows what it said.
        </p>
      </div>
      {SCENARIOS.map((s) => (
        <Benchmark
          key={s.title}
          title={s.title}
          description={s.description}
          makeRequest={() => s.req}
        />
      ))}
    </div>
  );
}

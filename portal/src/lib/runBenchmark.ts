import type { ApiConfig } from '../config/apis';
import { getToken } from './auth';

export interface BenchRequest {
  method: string;
  path: string;
  // Object → JSON.stringify'd. Raw string → sent verbatim (for malformed-JSON tests).
  body?: unknown;
  auth?: boolean; // default true
  // If set, "ok" means status === expectStatus (used by error-handling tests).
  expectStatus?: number;
}

export interface BenchResult {
  ok: boolean;
  status: number;
  roundTripMs: number;
  serverMs: number | null;
  error?: string;
  sample?: unknown;
}

export async function runBenchmark(api: ApiConfig, req: BenchRequest): Promise<BenchResult> {
  const headers: Record<string, string> = {};
  let body: string | undefined;

  if (req.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  if (req.auth !== false) {
    try {
      headers['Authorization'] = `Bearer ${await getToken(api.baseUrl)}`;
    } catch (e) {
      return { ok: false, status: 0, roundTripMs: 0, serverMs: null, error: (e as Error).message };
    }
  }

  const start = performance.now();
  let res: Response;
  try {
    res = await fetch(`${api.baseUrl}${req.path}`, { method: req.method, headers, body });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      roundTripMs: performance.now() - start,
      serverMs: null,
      error: `network error: ${(e as Error).message}`,
    };
  }
  const roundTripMs = performance.now() - start;

  const serverHeader = res.headers.get('X-Process-Time-Ms');
  const serverMs = serverHeader != null ? Number(serverHeader) : null;

  let sample: unknown = null;
  try {
    sample = await res.json();
  } catch {
    /* no JSON body (e.g. 204) */
  }

  const ok = req.expectStatus !== undefined ? res.status === req.expectStatus : res.ok;
  const error = ok
    ? undefined
    : (sample && typeof sample === 'object' && 'error' in sample
        ? String((sample as { error: unknown }).error)
        : `HTTP ${res.status}`);

  return { ok, status: res.status, roundTripMs, serverMs, error, sample };
}

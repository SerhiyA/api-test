// One dev JWT per API base URL, fetched on first use and reused thereafter.
// The fetch happens BEFORE the benchmark timer starts, so token cost is never
// counted in a measured request.
const tokenCache = new Map<string, string>();

export async function getToken(baseUrl: string): Promise<string> {
  const cached = tokenCache.get(baseUrl);
  if (cached) return cached;

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'portal' }),
  });
  if (!res.ok) throw new Error(`auth/login failed (HTTP ${res.status})`);
  const data = (await res.json()) as { token: string };
  tokenCache.set(baseUrl, data.token);
  return data.token;
}

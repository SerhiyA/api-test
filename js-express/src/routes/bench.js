import { Router } from 'express';
import { query, pool } from '../db.js';
import { redis } from '../redis.js';

export const benchRouter = Router();

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// POST /bench/json — JSON serialize/deserialize stress.
// Echoes the payload back with light transformation so both decode and encode
// are exercised. Reports element counts so the portal can show payload size.
benchRouter.post('/json', (req, res, next) => {
  try {
    const payload = req.body;
    if (payload == null) throw httpError(400, 'Expected a JSON body');
    const items = Array.isArray(payload.items) ? payload.items : [];
    const transformed = items.map((item, i) => ({
      ...item,
      index: i,
      processed: true,
    }));
    res.json({
      received: items.length,
      sumCheck: items.reduce((acc, it) => acc + (Number(it?.value) || 0), 0),
      items: transformed,
    });
  } catch (err) {
    next(err);
  }
});

// GET /bench/cpu?n= — CPU-heavy work: count primes up to n via trial division.
benchRouter.get('/cpu', (req, res, next) => {
  try {
    const n = Math.min(5_000_000, Math.max(1, Number(req.query.n) || 100_000));
    let count = 0;
    for (let candidate = 2; candidate <= n; candidate++) {
      let isPrime = true;
      for (let d = 2; d * d <= candidate; d++) {
        if (candidate % d === 0) { isPrime = false; break; }
      }
      if (isPrime) count++;
    }
    res.json({ n, primesFound: count });
  } catch (err) {
    next(err);
  }
});

// GET /bench/db?type=simple|complex|bulk
benchRouter.get('/db', async (req, res, next) => {
  const type = req.query.type ?? 'simple';
  try {
    if (type === 'simple') {
      // Single record by primary key.
      const { rows } = await query('SELECT * FROM tasks WHERE id = $1', [1]);
      return res.json({ type, row: rows[0] ?? null });
    }
    if (type === 'complex') {
      // Multi-table join with filter + pagination + aggregation.
      const { rows } = await query(
        `SELECT p.id AS project_id, p.name AS project_name,
                t.status, COUNT(*)::int AS task_count
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
          WHERE t.priority IN ('medium','high')
          GROUP BY p.id, p.name, t.status
          ORDER BY task_count DESC
          LIMIT 25`,
      );
      return res.json({ type, rows });
    }
    if (type === 'bulk') {
      // Insert 1,000 rows in one statement, then clean them up.
      const client = await pool.connect();
      try {
        const values = [];
        const params = [];
        for (let i = 0; i < 1000; i++) {
          const base = i * 2;
          values.push(`($${base + 1}, $${base + 2})`);
          params.push(`Bulk task ${i}`, 'pending');
        }
        await client.query('BEGIN');
        const { rowCount } = await client.query(
          `INSERT INTO tasks (title, status) VALUES ${values.join(',')}`,
          params,
        );
        // Roll back so the benchmark is repeatable and doesn't bloat the table.
        await client.query('ROLLBACK');
        return res.json({ type, inserted: rowCount, committed: false });
      } finally {
        client.release();
      }
    }
    throw httpError(400, "type must be one of: simple, complex, bulk");
  } catch (err) {
    next(err);
  }
});

// GET /bench/cache?fresh=1 — heavy aggregate query, cached in Redis for 30s.
const CACHE_KEY = 'bench:cache:summary';
benchRouter.get('/cache', async (req, res, next) => {
  try {
    const bypass = req.query.fresh === '1';
    if (!bypass && redis.isOpen) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return res.json({ cached: true, ...JSON.parse(cached) });
      }
    }
    // Deliberately non-trivial aggregate to make caching worthwhile.
    const { rows } = await query(
      `SELECT t.status, t.priority, COUNT(*)::int AS count,
              MAX(t.created_at) AS latest
         FROM tasks t
         GROUP BY t.status, t.priority
         ORDER BY t.status, t.priority`,
    );
    const result = { generatedAt: new Date().toISOString(), summary: rows };
    if (redis.isOpen) {
      await redis.set(CACHE_KEY, JSON.stringify(result), { EX: 30 });
    }
    res.json({ cached: false, ...result });
  } catch (err) {
    next(err);
  }
});

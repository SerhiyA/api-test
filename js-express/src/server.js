import { createApp } from './app.js';
import { config } from './config.js';
import { connectRedis } from './redis.js';
import { pool } from './db.js';

async function main() {
  try {
    await connectRedis();
  } catch (err) {
    console.error('[startup] redis unavailable, continuing without cache:', err.message);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[js-express] listening on :${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[js-express] ${signal} received, shutting down`);
    server.close();
    await pool.end().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();

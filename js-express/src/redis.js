import { createClient } from 'redis';
import { config } from './config.js';

export const redis = createClient({ url: config.redis.url });

redis.on('error', (err) => {
  // Don't crash the process on a transient redis blip; log and continue.
  console.error('[redis] client error:', err.message);
});

export async function connectRedis() {
  if (!redis.isOpen) await redis.connect();
}

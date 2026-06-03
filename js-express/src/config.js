// Central config. Defaults target a host run (localhost); the dev container
// overrides PGHOST/REDIS_HOST to the compose service names (postgres/redis).
export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  pg: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'bench',
    password: process.env.PGPASSWORD ?? 'bench',
    database: process.env.PGDATABASE ?? 'taskbench',
    max: Number(process.env.PG_POOL_MAX ?? 10),
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  // Origin allowed to call the API from the browser portal.
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};

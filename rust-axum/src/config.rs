use std::env;

// Env-driven config. Defaults target a host run (localhost); the dev container
// overrides PGHOST/REDIS_URL to the compose service names.
pub struct Config {
    pub port: u16,
    pub jwt_secret: String,
    pub jwt_expires_hours: usize,
    pub pg_dsn: String,
    pub redis_url: String,
}

impl Config {
    pub fn load() -> Self {
        let user = env_or("PGUSER", "bench");
        let password = env_or("PGPASSWORD", "bench");
        let host = env_or("PGHOST", "localhost");
        let port = env_or("PGPORT", "5432");
        let database = env_or("PGDATABASE", "taskbench");

        Config {
            port: env_or("PORT", "3004").parse().unwrap_or(3004),
            jwt_secret: env_or("JWT_SECRET", "dev-secret-change-me"),
            jwt_expires_hours: env_or("JWT_EXPIRES_HOURS", "12").parse().unwrap_or(12),
            pg_dsn: format!("postgres://{user}:{password}@{host}:{port}/{database}"),
            redis_url: env_or("REDIS_URL", "redis://localhost:6379"),
        }
    }
}

fn env_or(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

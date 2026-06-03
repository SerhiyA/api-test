package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config is env-driven. Defaults target a host run (localhost); the dev
// container overrides PGHOST/REDIS_URL to the compose service names.
type Config struct {
	Port            int
	JWTSecret       string
	JWTExpiresHours int
	PGHost          string
	PGPort          int
	PGUser          string
	PGPassword      string
	PGDatabase      string
	RedisURL        string
	CORSOrigin      string
}

func Load() *Config {
	return &Config{
		Port:            envInt("PORT", 3003),
		JWTSecret:       env("JWT_SECRET", "dev-secret-change-me"),
		JWTExpiresHours: envInt("JWT_EXPIRES_HOURS", 12),
		PGHost:          env("PGHOST", "localhost"),
		PGPort:          envInt("PGPORT", 5432),
		PGUser:          env("PGUSER", "bench"),
		PGPassword:      env("PGPASSWORD", "bench"),
		PGDatabase:      env("PGDATABASE", "taskbench"),
		RedisURL:        env("REDIS_URL", "redis://localhost:6379"),
		CORSOrigin:      env("CORS_ORIGIN", "*"),
	}
}

func (c *Config) PgDSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s",
		c.PGUser, c.PGPassword, c.PGHost, c.PGPort, c.PGDatabase)
}

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v, ok := os.LookupEnv(key); ok {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

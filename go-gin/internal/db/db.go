package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"gogin/internal/config"
)

// Connect opens a shared pgx connection pool.
func Connect(ctx context.Context, cfg *config.Config) (*pgxpool.Pool, error) {
	return pgxpool.New(ctx, cfg.PgDSN())
}

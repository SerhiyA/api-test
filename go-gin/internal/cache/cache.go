package cache

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"

	"gogin/internal/config"
)

// Connect returns a connected redis client, or nil if Redis is unavailable
// (the cache benchmark simply runs uncached in that case).
func Connect(ctx context.Context, cfg *config.Config) *redis.Client {
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Printf("[startup] bad REDIS_URL, continuing without cache: %v", err)
		return nil
	}
	client := redis.NewClient(opt)
	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[startup] redis unavailable, continuing without cache: %v", err)
		return nil
	}
	return client
}

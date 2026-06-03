package handlers

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"gogin/internal/config"
)

// Handlers bundles the dependencies every route needs. Redis may be nil.
type Handlers struct {
	Pool  *pgxpool.Pool
	Redis *redis.Client
	Cfg   *config.Config
}

// Task mirrors the shared data model. db tags map SELECT * columns;
// json tags produce the same wire shape as the other implementations.
type Task struct {
	ID          int       `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Description *string   `json:"description" db:"description"`
	Status      string    `json:"status" db:"status"`
	Priority    string    `json:"priority" db:"priority"`
	ProjectID   *int      `json:"project_id" db:"project_id"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

func respondError(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"error": msg})
}

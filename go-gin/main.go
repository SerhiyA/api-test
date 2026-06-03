package main

import (
	"context"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"

	"gogin/internal/cache"
	"gogin/internal/config"
	"gogin/internal/db"
	"gogin/internal/handlers"
	"gogin/internal/middleware"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg)
	if err != nil {
		log.Fatalf("[go-gin] db connect failed: %v", err)
	}
	defer pool.Close()

	rdb := cache.Connect(ctx, cfg) // may be nil
	h := &handlers.Handlers{Pool: pool, Redis: rdb, Cfg: cfg}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), middleware.CORS(cfg.CORSOrigin), middleware.Timing())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "impl": "go-gin"})
	})
	r.POST("/auth/login", h.Login)

	auth := middleware.RequireAuth(cfg.JWTSecret)
	tasks := r.Group("/tasks", auth)
	{
		tasks.GET("", h.ListTasks)
		tasks.POST("", h.CreateTask)
		tasks.GET("/:id", h.GetTask)
		tasks.PUT("/:id", h.UpdateTask)
		tasks.DELETE("/:id", h.DeleteTask)
	}
	bench := r.Group("/bench", auth)
	{
		bench.POST("/json", h.BenchJSON)
		bench.GET("/cpu", h.BenchCPU)
		bench.GET("/db", h.BenchDB)
		bench.GET("/cache", h.BenchCache)
	}
	r.NoRoute(func(c *gin.Context) { c.JSON(404, gin.H{"error": "Not found"}) })

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("[go-gin] listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("[go-gin] server error: %v", err)
	}
}

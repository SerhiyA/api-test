package handlers

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Login is a dev convenience: any POST returns a signed token so the JWT
// middleware can be exercised. Real auth is out of scope for the benchmark.
func (h *Handlers) Login(c *gin.Context) {
	var body map[string]any
	_ = c.ShouldBindJSON(&body) // body is optional

	subject := "benchmark-user"
	if body != nil {
		if u, ok := body["username"].(string); ok && u != "" {
			subject = u
		}
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"sub": subject,
		"iat": now.Unix(),
		"exp": now.Add(time.Duration(h.Cfg.JWTExpiresHours) * time.Hour).Unix(),
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(h.Cfg.JWTSecret))
	if err != nil {
		respondError(c, 500, "failed to sign token")
		return
	}
	c.JSON(200, gin.H{
		"token":     signed,
		"tokenType": "Bearer",
		"expiresIn": fmt.Sprintf("%dh", h.Cfg.JWTExpiresHours),
	})
}

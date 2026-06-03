package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// CORS allows the browser portal to call the API and read the timing header.
func CORS(origin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Header("Access-Control-Expose-Headers", "X-Process-Time-Ms")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// timedWriter stamps X-Process-Time-Ms just before the response is flushed,
// since headers can't be set once the body has started writing.
type timedWriter struct {
	gin.ResponseWriter
	start  time.Time
	stamped bool
}

func (w *timedWriter) stamp() {
	if w.stamped {
		return
	}
	w.stamped = true
	ms := float64(time.Since(w.start).Microseconds()) / 1000.0
	w.Header().Set("X-Process-Time-Ms", strconv.FormatFloat(ms, 'f', 3, 64))
}

func (w *timedWriter) WriteHeader(code int) {
	w.stamp()
	w.ResponseWriter.WriteHeader(code)
}

func (w *timedWriter) Write(b []byte) (int, error) {
	w.stamp()
	return w.ResponseWriter.Write(b)
}

func (w *timedWriter) WriteString(s string) (int, error) {
	w.stamp()
	return w.ResponseWriter.WriteString(s)
}

// Timing measures handler time and exposes it via X-Process-Time-Ms.
func Timing() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer = &timedWriter{ResponseWriter: c.Writer, start: time.Now()}
		c.Next()
	}
}

// RequireAuth enforces a valid HS256 Bearer token.
func RequireAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		parts := strings.SplitN(c.GetHeader("Authorization"), " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" || strings.TrimSpace(parts[1]) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing or malformed Authorization header"})
			return
		}
		token, err := jwt.Parse(parts[1], func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}
		c.Next()
	}
}

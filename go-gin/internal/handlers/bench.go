package handlers

import (
	"encoding/json"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

const cacheKey = "bench:cache:summary"

// ComplexRow is the shape of the multi-table join benchmark result.
type ComplexRow struct {
	ProjectID   int    `json:"project_id" db:"project_id"`
	ProjectName string `json:"project_name" db:"project_name"`
	Status      string `json:"status" db:"status"`
	TaskCount   int    `json:"task_count" db:"task_count"`
}

// CacheRow / CacheResult are the cached aggregate summary.
type CacheRow struct {
	Status   string    `json:"status" db:"status"`
	Priority string    `json:"priority" db:"priority"`
	Count    int       `json:"count" db:"count"`
	Latest   time.Time `json:"latest" db:"latest"`
}

type CacheResult struct {
	GeneratedAt string     `json:"generatedAt"`
	Summary     []CacheRow `json:"summary"`
}

// BenchJSON: JSON serialize/deserialize stress — echo the payload back transformed.
func (h *Handlers) BenchJSON(c *gin.Context) {
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		respondError(c, 400, "Expected a JSON body")
		return
	}
	items, _ := body["items"].([]any)
	transformed := make([]any, 0, len(items))
	sum := 0.0
	for i, raw := range items {
		if m, ok := raw.(map[string]any); ok {
			cp := make(map[string]any, len(m)+2)
			for k, v := range m {
				cp[k] = v
			}
			cp["index"] = i
			cp["processed"] = true
			transformed = append(transformed, cp)
			if val, ok := m["value"].(float64); ok {
				sum += val
			}
		} else {
			transformed = append(transformed, raw)
		}
	}
	c.JSON(200, gin.H{"received": len(items), "sumCheck": sum, "items": transformed})
}

// BenchCPU: count primes up to n via trial division.
func (h *Handlers) BenchCPU(c *gin.Context) {
	n := atoiDefault(c.Query("n"), 100000)
	if n < 1 {
		n = 1
	}
	if n > 5000000 {
		n = 5000000
	}
	count := 0
	for cand := 2; cand <= n; cand++ {
		isPrime := true
		for d := 2; d*d <= cand; d++ {
			if cand%d == 0 {
				isPrime = false
				break
			}
		}
		if isPrime {
			count++
		}
	}
	c.JSON(200, gin.H{"n": n, "primesFound": count})
}

// BenchDB: simple | complex | bulk.
func (h *Handlers) BenchDB(c *gin.Context) {
	switch c.DefaultQuery("type", "simple") {
	case "simple":
		task, err := h.queryOneTask(c, "SELECT * FROM tasks WHERE id = $1", 1)
		if err != nil {
			c.JSON(200, gin.H{"type": "simple", "row": nil})
			return
		}
		c.JSON(200, gin.H{"type": "simple", "row": task})

	case "complex":
		rows, err := h.Pool.Query(c,
			`SELECT p.id AS project_id, p.name AS project_name,
			        t.status, COUNT(*)::int AS task_count
			   FROM tasks t
			   JOIN projects p ON p.id = t.project_id
			  WHERE t.priority IN ('medium','high')
			  GROUP BY p.id, p.name, t.status
			  ORDER BY task_count DESC
			  LIMIT 25`)
		if err != nil {
			respondError(c, 500, err.Error())
			return
		}
		result, err := pgx.CollectRows(rows, pgx.RowToStructByName[ComplexRow])
		if err != nil {
			respondError(c, 500, err.Error())
			return
		}
		if result == nil {
			result = []ComplexRow{}
		}
		c.JSON(200, gin.H{"type": "complex", "rows": result})

	case "bulk":
		// Insert 1,000 rows in one statement, then roll back so the test repeats.
		tx, err := h.Pool.Begin(c)
		if err != nil {
			respondError(c, 500, err.Error())
			return
		}
		tag, err := tx.Exec(c,
			`INSERT INTO tasks (title, status)
			 SELECT 'Bulk task ' || g, 'pending'::task_status
			   FROM generate_series(1, 1000) AS g`)
		_ = tx.Rollback(c)
		if err != nil {
			respondError(c, 500, err.Error())
			return
		}
		c.JSON(200, gin.H{"type": "bulk", "inserted": tag.RowsAffected(), "committed": false})

	default:
		respondError(c, 400, "type must be one of: simple, complex, bulk")
	}
}

// BenchCache: heavy aggregate, cached in Redis for 30s. ?fresh=1 bypasses.
func (h *Handlers) BenchCache(c *gin.Context) {
	bypass := c.Query("fresh") == "1"
	if !bypass && h.Redis != nil {
		if val, err := h.Redis.Get(c, cacheKey).Result(); err == nil && val != "" {
			var cr CacheResult
			if json.Unmarshal([]byte(val), &cr) == nil {
				c.JSON(200, gin.H{"cached": true, "generatedAt": cr.GeneratedAt, "summary": cr.Summary})
				return
			}
		}
	}

	rows, err := h.Pool.Query(c,
		`SELECT t.status, t.priority, COUNT(*)::int AS count,
		        MAX(t.created_at) AS latest
		   FROM tasks t
		   GROUP BY t.status, t.priority
		   ORDER BY t.status, t.priority`)
	if err != nil {
		respondError(c, 500, err.Error())
		return
	}
	summary, err := pgx.CollectRows(rows, pgx.RowToStructByName[CacheRow])
	if err != nil {
		respondError(c, 500, err.Error())
		return
	}
	if summary == nil {
		summary = []CacheRow{}
	}
	result := CacheResult{GeneratedAt: time.Now().UTC().Format(time.RFC3339), Summary: summary}
	if h.Redis != nil {
		if b, err := json.Marshal(result); err == nil {
			h.Redis.Set(c, cacheKey, b, 30*time.Second)
		}
	}
	c.JSON(200, gin.H{"cached": false, "generatedAt": result.GeneratedAt, "summary": result.Summary})
}

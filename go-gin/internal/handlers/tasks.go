package handlers

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

var (
	statuses   = []string{"pending", "in_progress", "done"}
	priorities = []string{"low", "medium", "high"}
	enumCasts  = map[string]string{"status": "::task_status", "priority": "::task_priority"}
)

// validateTask mirrors the JS/Python validators: returns the cleaned fields, or
// a 400 message string. With partial=true (PUT) only provided fields are checked.
func validateTask(body map[string]any, partial bool) (map[string]any, string) {
	out := map[string]any{}
	_, hasTitle := body["title"]
	if !partial || hasTitle {
		s, ok := body["title"].(string)
		if !ok || strings.TrimSpace(s) == "" {
			return nil, "title is required and must be a non-empty string"
		}
		if len(s) > 255 {
			return nil, "title must be <= 255 chars"
		}
		out["title"] = strings.TrimSpace(s)
	}
	if v, ok := body["description"]; ok {
		if v == nil {
			out["description"] = nil
		} else if s, ok := v.(string); ok {
			out["description"] = s
		} else {
			return nil, "description must be a string or null"
		}
	}
	if v, ok := body["status"]; ok {
		s, ok := v.(string)
		if !ok || !contains(statuses, s) {
			return nil, "status must be one of: " + strings.Join(statuses, ", ")
		}
		out["status"] = s
	}
	if v, ok := body["priority"]; ok {
		s, ok := v.(string)
		if !ok || !contains(priorities, s) {
			return nil, "priority must be one of: " + strings.Join(priorities, ", ")
		}
		out["priority"] = s
	}
	if v, ok := body["project_id"]; ok {
		if v == nil {
			out["project_id"] = nil
		} else if f, ok := v.(float64); ok && f == math.Trunc(f) {
			out["project_id"] = int(f)
		} else {
			return nil, "project_id must be an integer or null"
		}
	}
	if partial && len(out) == 0 {
		return nil, "No valid fields to update"
	}
	return out, ""
}

func (h *Handlers) ListTasks(c *gin.Context) {
	page := atoiDefault(c.Query("page"), 1)
	if page < 1 {
		page = 1
	}
	limit := atoiDefault(c.Query("limit"), 20)
	if limit < 1 {
		limit = 1
	}
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	rows, err := h.Pool.Query(c, "SELECT * FROM tasks ORDER BY id DESC LIMIT $1 OFFSET $2", limit, offset)
	if err != nil {
		respondError(c, 500, err.Error())
		return
	}
	tasks, err := pgx.CollectRows(rows, pgx.RowToStructByName[Task])
	if err != nil {
		respondError(c, 500, err.Error())
		return
	}
	if tasks == nil {
		tasks = []Task{}
	}
	var total int
	if err := h.Pool.QueryRow(c, "SELECT COUNT(*) FROM tasks").Scan(&total); err != nil {
		respondError(c, 500, err.Error())
		return
	}
	c.JSON(200, gin.H{
		"data":       tasks,
		"pagination": gin.H{"page": page, "limit": limit, "total": total},
	})
}

func (h *Handlers) CreateTask(c *gin.Context) {
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		respondError(c, 400, "Malformed JSON in request body")
		return
	}
	fields, msg := validateTask(body, false)
	if msg != "" {
		respondError(c, 400, msg)
		return
	}
	status := "pending"
	if v, ok := fields["status"]; ok {
		status = v.(string)
	}
	priority := "medium"
	if v, ok := fields["priority"]; ok {
		priority = v.(string)
	}
	task, err := h.queryOneTask(c,
		`INSERT INTO tasks (title, description, status, priority, project_id)
		 VALUES ($1, $2, $3::task_status, $4::task_priority, $5) RETURNING *`,
		fields["title"], fields["description"], status, priority, fields["project_id"])
	if err != nil {
		respondError(c, 500, err.Error())
		return
	}
	c.JSON(201, task)
}

func (h *Handlers) GetTask(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	task, err := h.queryOneTask(c, "SELECT * FROM tasks WHERE id = $1", id)
	if errors.Is(err, pgx.ErrNoRows) {
		respondError(c, 404, "Task not found")
		return
	}
	if err != nil {
		respondError(c, 500, err.Error())
		return
	}
	c.JSON(200, task)
}

func (h *Handlers) UpdateTask(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		respondError(c, 400, "Malformed JSON in request body")
		return
	}
	fields, msg := validateTask(body, true)
	if msg != "" {
		respondError(c, 400, msg)
		return
	}

	setParts := make([]string, 0, len(fields))
	args := make([]any, 0, len(fields)+1)
	i := 1
	for k, v := range fields {
		setParts = append(setParts, fmt.Sprintf("%s = $%d%s", k, i, enumCasts[k]))
		args = append(args, v)
		i++
	}
	args = append(args, id)
	sql := fmt.Sprintf("UPDATE tasks SET %s WHERE id = $%d RETURNING *", strings.Join(setParts, ", "), i)

	task, err := h.queryOneTask(c, sql, args...)
	if errors.Is(err, pgx.ErrNoRows) {
		respondError(c, 404, "Task not found")
		return
	}
	if err != nil {
		respondError(c, 500, err.Error())
		return
	}
	c.JSON(200, task)
}

func (h *Handlers) DeleteTask(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	tag, err := h.Pool.Exec(c, "DELETE FROM tasks WHERE id = $1", id)
	if err != nil {
		respondError(c, 500, err.Error())
		return
	}
	if tag.RowsAffected() == 0 {
		respondError(c, 404, "Task not found")
		return
	}
	c.Status(204)
}

func (h *Handlers) queryOneTask(ctx context.Context, sql string, args ...any) (*Task, error) {
	rows, err := h.Pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	task, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[Task])
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func parseID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		respondError(c, 400, "id must be a positive integer")
		return 0, false
	}
	return id, true
}

func atoiDefault(s string, def int) int {
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	return def
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

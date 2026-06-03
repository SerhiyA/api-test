import { Router } from 'express';
import { query } from '../db.js';

export const tasksRouter = Router();

const STATUSES = ['pending', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

// Throws a 400-tagged error on the first validation failure.
function validateTask(body, { partial = false } = {}) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Request body must be a JSON object');
  }
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has('title')) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      throw httpError(400, 'title is required and must be a non-empty string');
    }
    if (body.title.length > 255) throw httpError(400, 'title must be <= 255 chars');
    out.title = body.title.trim();
  }
  if (has('description')) {
    if (body.description !== null && typeof body.description !== 'string') {
      throw httpError(400, 'description must be a string or null');
    }
    out.description = body.description;
  }
  if (has('status')) {
    if (!STATUSES.includes(body.status)) {
      throw httpError(400, `status must be one of: ${STATUSES.join(', ')}`);
    }
    out.status = body.status;
  }
  if (has('priority')) {
    if (!PRIORITIES.includes(body.priority)) {
      throw httpError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
    }
    out.priority = body.priority;
  }
  if (has('project_id')) {
    if (body.project_id !== null && !Number.isInteger(body.project_id)) {
      throw httpError(400, 'project_id must be an integer or null');
    }
    out.project_id = body.project_id;
  }
  if (partial && Object.keys(out).length === 0) {
    throw httpError(400, 'No valid fields to update');
  }
  return out;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'id must be a positive integer');
  return id;
}

// GET /tasks?page=&limit=  — paginated list with total count.
tasksRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      query(
        'SELECT * FROM tasks ORDER BY id DESC LIMIT $1 OFFSET $2',
        [limit, offset],
      ),
      query('SELECT COUNT(*)::int AS total FROM tasks'),
    ]);
    res.json({
      data: rows.rows,
      pagination: { page, limit, total: count.rows[0].total },
    });
  } catch (err) {
    next(err);
  }
});

// POST /tasks — create.
tasksRouter.post('/', async (req, res, next) => {
  try {
    const t = validateTask(req.body);
    const { rows } = await query(
      `INSERT INTO tasks (title, description, status, priority, project_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [t.title, t.description ?? null, t.status ?? 'pending', t.priority ?? 'medium', t.project_id ?? null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /tasks/:id — fetch one.
tasksRouter.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { rows } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (rows.length === 0) throw httpError(404, 'Task not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /tasks/:id — partial update of the provided fields.
tasksRouter.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const fields = validateTask(req.body, { partial: true });
    const keys = Object.keys(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map((k) => fields[k]);
    const { rows } = await query(
      `UPDATE tasks SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id],
    );
    if (rows.length === 0) throw httpError(404, 'Task not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id — delete.
tasksRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [id]);
    if (rowCount === 0) throw httpError(404, 'Task not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

from fastapi import APIRouter, Depends, HTTPException, Response

from ..db import pool
from ..models import TaskCreate, TaskUpdate
from ..security import require_auth

router = APIRouter(dependencies=[Depends(require_auth)])

# Columns whose values must be cast to their Postgres enum type.
_CASTS = {"status": "::task_status", "priority": "::task_priority"}


@router.get("")
async def list_tasks(page: int = 1, limit: int = 20):
    page = max(1, page)
    limit = min(100, max(1, limit))
    offset = (page - 1) * limit
    rows = await pool().fetch(
        "SELECT * FROM tasks ORDER BY id DESC LIMIT $1 OFFSET $2", limit, offset
    )
    total = await pool().fetchval("SELECT COUNT(*) FROM tasks")
    return {
        "data": [dict(r) for r in rows],
        "pagination": {"page": page, "limit": limit, "total": total},
    }


@router.post("", status_code=201)
async def create_task(body: TaskCreate):
    row = await pool().fetchrow(
        """INSERT INTO tasks (title, description, status, priority, project_id)
           VALUES ($1, $2, $3::task_status, $4::task_priority, $5) RETURNING *""",
        body.title,
        body.description,
        body.status,
        body.priority,
        body.project_id,
    )
    return dict(row)


@router.get("/{task_id}")
async def get_task(task_id: int):
    _require_positive(task_id)
    row = await pool().fetchrow("SELECT * FROM tasks WHERE id = $1", task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return dict(row)


@router.put("/{task_id}")
async def update_task(task_id: int, body: TaskUpdate):
    _require_positive(task_id)
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    set_parts = []
    values = []
    for i, (key, value) in enumerate(fields.items(), start=1):
        set_parts.append(f"{key} = ${i}{_CASTS.get(key, '')}")
        values.append(value)
    values.append(task_id)
    sql = f"UPDATE tasks SET {', '.join(set_parts)} WHERE id = ${len(values)} RETURNING *"

    row = await pool().fetchrow(sql, *values)
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return dict(row)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: int):
    _require_positive(task_id)
    status = await pool().execute("DELETE FROM tasks WHERE id = $1", task_id)
    if status.split()[-1] == "0":
        raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=204)


def _require_positive(task_id: int) -> None:
    if task_id <= 0:
        raise HTTPException(status_code=400, detail="id must be a positive integer")

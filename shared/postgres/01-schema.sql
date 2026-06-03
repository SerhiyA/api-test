-- Shared schema for the Task Manager benchmark API.
-- Loaded automatically by the postgres container on first boot
-- (files in /docker-entrypoint-initdb.d run in alphabetical order).

CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'done');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

-- projects exists so the "complex query" benchmark has a real multi-table join.
CREATE TABLE projects (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      task_status   NOT NULL DEFAULT 'pending',
    priority    task_priority NOT NULL DEFAULT 'medium',
    project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_status     ON tasks (status);
CREATE INDEX idx_tasks_priority   ON tasks (priority);
CREATE INDEX idx_tasks_project_id ON tasks (project_id);
CREATE INDEX idx_tasks_created_at ON tasks (created_at);

-- Keep updated_at fresh on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

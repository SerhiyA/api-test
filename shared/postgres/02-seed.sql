-- Seed data shared by every implementation.

INSERT INTO projects (name) VALUES
    ('Website Redesign'),
    ('Mobile App'),
    ('Infrastructure'),
    ('Marketing'),
    ('Research');

-- ~50 tasks spread across projects, statuses and priorities.
-- generate_series gives deterministic, repeatable seed data.
INSERT INTO tasks (title, description, status, priority, project_id, created_at)
SELECT
    'Task #' || g                                              AS title,
    CASE WHEN g % 4 = 0 THEN NULL
         ELSE 'Auto-generated seed task number ' || g END      AS description,
    (ARRAY['pending','in_progress','done']::task_status[])[1 + (g % 3)]   AS status,
    (ARRAY['low','medium','high']::task_priority[])[1 + (g % 3)]          AS priority,
    1 + (g % 5)                                                AS project_id,
    now() - (g || ' hours')::interval                          AS created_at
FROM generate_series(1, 50) AS g;

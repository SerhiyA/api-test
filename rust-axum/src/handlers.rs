use std::collections::HashMap;

use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use redis::AsyncCommands;
use serde_json::{json, Value};
use sqlx::QueryBuilder;

use crate::{
    auth::{create_token, AuthUser},
    error::{bad, AppError},
    models::{validate_task, CacheResult, CacheRow, ComplexRow, Task, TASK_SELECT},
    state::AppState,
};

const CACHE_KEY: &str = "bench:cache:summary";

pub async fn login(State(state): State<AppState>, body: Bytes) -> Result<Json<Value>, AppError> {
    let username = serde_json::from_slice::<Value>(&body)
        .ok()
        .and_then(|v| v.get("username").and_then(|u| u.as_str()).map(str::to_string))
        .unwrap_or_else(|| "benchmark-user".to_string());
    let token = create_token(&username, &state.config)?;
    Ok(Json(json!({
        "token": token,
        "tokenType": "Bearer",
        "expiresIn": format!("{}h", state.config.jwt_expires_hours),
    })))
}

// ---------- CRUD ----------

pub async fn list_tasks(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, AppError> {
    let page = q.get("page").and_then(|s| s.parse::<i64>().ok()).unwrap_or(1).max(1);
    let limit = q.get("limit").and_then(|s| s.parse::<i64>().ok()).unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    let tasks = sqlx::query_as::<_, Task>(&format!(
        "SELECT {TASK_SELECT} FROM tasks ORDER BY id DESC LIMIT $1 OFFSET $2"
    ))
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await?;
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tasks")
        .fetch_one(&state.pool)
        .await?;

    Ok(Json(json!({
        "data": tasks,
        "pagination": { "page": page, "limit": limit, "total": total },
    })))
}

pub async fn create_task(
    State(state): State<AppState>,
    _auth: AuthUser,
    body: Bytes,
) -> Result<(StatusCode, Json<Task>), AppError> {
    let val: Value = serde_json::from_slice(&body).map_err(|_| bad("Malformed JSON in request body"))?;
    let fields = validate_task(&val, false)?;

    let title = fields["title"].as_str().unwrap().to_string();
    let description = match fields.get("description") {
        Some(Value::String(s)) => Some(s.clone()),
        _ => None,
    };
    let status = fields.get("status").and_then(|v| v.as_str()).unwrap_or("pending").to_string();
    let priority = fields.get("priority").and_then(|v| v.as_str()).unwrap_or("medium").to_string();
    let project_id = fields.get("project_id").and_then(|v| v.as_i64()).map(|n| n as i32);

    let task = sqlx::query_as::<_, Task>(&format!(
        "INSERT INTO tasks (title, description, status, priority, project_id) \
         VALUES ($1, $2, $3::task_status, $4::task_priority, $5) RETURNING {TASK_SELECT}"
    ))
    .bind(title)
    .bind(description)
    .bind(status)
    .bind(priority)
    .bind(project_id)
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(task)))
}

pub async fn get_task(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Task>, AppError> {
    let id = parse_id(&id)?;
    let task = sqlx::query_as::<_, Task>(&format!("SELECT {TASK_SELECT} FROM tasks WHERE id = $1"))
        .bind(id)
        .fetch_optional(&state.pool)
        .await?;
    task.map(Json)
        .ok_or_else(|| AppError::status(StatusCode::NOT_FOUND, "Task not found"))
}

pub async fn update_task(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<Json<Task>, AppError> {
    let id = parse_id(&id)?;
    let val: Value = serde_json::from_slice(&body).map_err(|_| bad("Malformed JSON in request body"))?;
    let fields = validate_task(&val, true)?;

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("UPDATE tasks SET ");
    let mut first = true;
    for (key, v) in fields.iter() {
        if !first {
            qb.push(", ");
        }
        first = false;
        match key.as_str() {
            "title" => {
                qb.push("title = ");
                qb.push_bind(v.as_str().unwrap().to_string());
            }
            "description" => {
                qb.push("description = ");
                let d: Option<String> = match v {
                    Value::String(s) => Some(s.clone()),
                    _ => None,
                };
                qb.push_bind(d);
            }
            "status" => {
                qb.push("status = ");
                qb.push_bind(v.as_str().unwrap().to_string());
                qb.push("::task_status");
            }
            "priority" => {
                qb.push("priority = ");
                qb.push_bind(v.as_str().unwrap().to_string());
                qb.push("::task_priority");
            }
            "project_id" => {
                qb.push("project_id = ");
                qb.push_bind(v.as_i64().map(|n| n as i32));
            }
            _ => {}
        }
    }
    qb.push(" WHERE id = ");
    qb.push_bind(id);
    qb.push(format!(" RETURNING {TASK_SELECT}"));

    let task = qb
        .build_query_as::<Task>()
        .fetch_optional(&state.pool)
        .await?;
    task.map(Json)
        .ok_or_else(|| AppError::status(StatusCode::NOT_FOUND, "Task not found"))
}

pub async fn delete_task(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let id = parse_id(&id)?;
    let res = sqlx::query("DELETE FROM tasks WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::status(StatusCode::NOT_FOUND, "Task not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ---------- benchmarks ----------

pub async fn bench_json(_auth: AuthUser, body: Bytes) -> Result<Json<Value>, AppError> {
    let val: Value = serde_json::from_slice(&body).map_err(|_| bad("Expected a JSON body"))?;
    let items = val.get("items").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let mut transformed = Vec::with_capacity(items.len());
    let mut sum = 0f64;
    for (i, item) in items.iter().enumerate() {
        if let Some(obj) = item.as_object() {
            let mut m = obj.clone();
            m.insert("index".into(), json!(i));
            m.insert("processed".into(), json!(true));
            transformed.push(Value::Object(m));
            if let Some(n) = obj.get("value").and_then(|v| v.as_f64()) {
                sum += n;
            }
        } else {
            transformed.push(item.clone());
        }
    }
    Ok(Json(json!({ "received": items.len(), "sumCheck": sum, "items": transformed })))
}

// algo=trial -> trial division (division-bound; the great equalizer)
// algo=sieve -> Sieve of Eratosthenes (memory/array-bound)
pub async fn bench_cpu(
    _auth: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Json<Value> {
    let n = q.get("n").and_then(|s| s.parse::<i64>().ok()).unwrap_or(100_000).clamp(1, 5_000_000);
    let algo = match q.get("algo").map(String::as_str) {
        Some("sieve") => "sieve",
        _ => "trial",
    };
    let count = if algo == "sieve" {
        count_primes_sieve(n)
    } else {
        count_primes_trial(n)
    };
    Json(json!({ "n": n, "algo": algo, "primesFound": count }))
}

fn count_primes_trial(n: i64) -> i64 {
    let mut count = 0i64;
    for cand in 2..=n {
        let mut is_prime = true;
        let mut d = 2i64;
        while d * d <= cand {
            if cand % d == 0 {
                is_prime = false;
                break;
            }
            d += 1;
        }
        if is_prime {
            count += 1;
        }
    }
    count
}

fn count_primes_sieve(n: i64) -> i64 {
    let n = n as usize;
    let mut sieve = vec![false; n + 1];
    let mut count = 0i64;
    let mut i = 2usize;
    while i <= n {
        if !sieve[i] {
            count += 1;
            let mut j = i * i;
            while j <= n {
                sieve[j] = true;
                j += i;
            }
        }
        i += 1;
    }
    count
}

pub async fn bench_db(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, AppError> {
    match q.get("type").map(String::as_str).unwrap_or("simple") {
        "simple" => {
            let task = sqlx::query_as::<_, Task>(&format!("SELECT {TASK_SELECT} FROM tasks WHERE id = $1"))
                .bind(1i32)
                .fetch_optional(&state.pool)
                .await?;
            Ok(Json(json!({ "type": "simple", "row": task })))
        }
        "complex" => {
            let rows = sqlx::query_as::<_, ComplexRow>(
                "SELECT p.id AS project_id, p.name AS project_name, t.status::text AS status, \
                        COUNT(*)::int AS task_count \
                   FROM tasks t \
                   JOIN projects p ON p.id = t.project_id \
                  WHERE t.priority IN ('medium','high') \
                  GROUP BY p.id, p.name, t.status \
                  ORDER BY task_count DESC \
                  LIMIT 25",
            )
            .fetch_all(&state.pool)
            .await?;
            Ok(Json(json!({ "type": "complex", "rows": rows })))
        }
        "bulk" => {
            let mut tx = state.pool.begin().await?;
            let res = sqlx::query(
                "INSERT INTO tasks (title, status) \
                 SELECT 'Bulk task ' || g, 'pending'::task_status \
                   FROM generate_series(1, 1000) AS g",
            )
            .execute(&mut *tx)
            .await?;
            let inserted = res.rows_affected();
            tx.rollback().await?;
            Ok(Json(json!({ "type": "bulk", "inserted": inserted, "committed": false })))
        }
        _ => Err(bad("type must be one of: simple, complex, bulk")),
    }
}

pub async fn bench_cache(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, AppError> {
    let bypass = q.get("fresh").map(String::as_str) == Some("1");

    if !bypass {
        if let Some(mut cm) = state.redis.clone() {
            if let Ok(Some(cached)) = cm.get::<_, Option<String>>(CACHE_KEY).await {
                if let Ok(cr) = serde_json::from_str::<CacheResult>(&cached) {
                    return Ok(Json(json!({
                        "cached": true,
                        "generatedAt": cr.generated_at,
                        "summary": cr.summary,
                    })));
                }
            }
        }
    }

    let summary = sqlx::query_as::<_, CacheRow>(
        "SELECT t.status::text AS status, t.priority::text AS priority, \
                COUNT(*)::int AS count, MAX(t.created_at) AS latest \
           FROM tasks t \
          GROUP BY t.status, t.priority \
          ORDER BY t.status, t.priority",
    )
    .fetch_all(&state.pool)
    .await?;

    let result = CacheResult {
        generated_at: chrono::Utc::now().to_rfc3339(),
        summary,
    };
    if let Some(mut cm) = state.redis.clone() {
        if let Ok(s) = serde_json::to_string(&result) {
            let _: Result<(), _> = cm.set_ex(CACHE_KEY, s, 30).await;
        }
    }
    Ok(Json(json!({
        "cached": false,
        "generatedAt": result.generated_at,
        "summary": result.summary,
    })))
}

fn parse_id(raw: &str) -> Result<i32, AppError> {
    match raw.parse::<i32>() {
        Ok(id) if id > 0 => Ok(id),
        _ => Err(bad("id must be a positive integer")),
    }
}

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sqlx::FromRow;

use crate::error::{bad, AppError};

// Enums are cast to ::text so they decode straight into String.
pub const TASK_SELECT: &str =
    "id, title, description, status::text AS status, priority::text AS priority, \
     project_id, created_at, updated_at";

pub const STATUSES: [&str; 3] = ["pending", "in_progress", "done"];
pub const PRIORITIES: [&str; 3] = ["low", "medium", "high"];

#[derive(Serialize, FromRow)]
pub struct Task {
    pub id: i32,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub project_id: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, FromRow)]
pub struct ComplexRow {
    pub project_id: i32,
    pub project_name: String,
    pub status: String,
    pub task_count: i32,
}

#[derive(Serialize, Deserialize, FromRow)]
pub struct CacheRow {
    pub status: String,
    pub priority: String,
    pub count: i32,
    pub latest: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct CacheResult {
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
    pub summary: Vec<CacheRow>,
}

// Mirrors the JS/Python/Go validators: returns the cleaned fields or a 400.
// With partial=true (PUT) only the provided fields are validated.
pub fn validate_task(body: &Value, partial: bool) -> Result<Map<String, Value>, AppError> {
    let obj = body.as_object().ok_or_else(|| bad("Request body must be a JSON object"))?;
    let mut out = Map::new();

    if !partial || obj.contains_key("title") {
        match obj.get("title").and_then(|v| v.as_str()) {
            Some(s) if !s.trim().is_empty() => {
                if s.len() > 255 {
                    return Err(bad("title must be <= 255 chars"));
                }
                out.insert("title".into(), Value::String(s.trim().to_string()));
            }
            _ => return Err(bad("title is required and must be a non-empty string")),
        }
    }
    if let Some(v) = obj.get("description") {
        if v.is_null() {
            out.insert("description".into(), Value::Null);
        } else if v.is_string() {
            out.insert("description".into(), v.clone());
        } else {
            return Err(bad("description must be a string or null"));
        }
    }
    if let Some(v) = obj.get("status") {
        match v.as_str() {
            Some(s) if STATUSES.contains(&s) => {
                out.insert("status".into(), Value::String(s.into()));
            }
            _ => return Err(bad("status must be one of: pending, in_progress, done")),
        }
    }
    if let Some(v) = obj.get("priority") {
        match v.as_str() {
            Some(s) if PRIORITIES.contains(&s) => {
                out.insert("priority".into(), Value::String(s.into()));
            }
            _ => return Err(bad("priority must be one of: low, medium, high")),
        }
    }
    if let Some(v) = obj.get("project_id") {
        if v.is_null() {
            out.insert("project_id".into(), Value::Null);
        } else if let Some(n) = v.as_i64() {
            out.insert("project_id".into(), json!(n));
        } else {
            return Err(bad("project_id must be an integer or null"));
        }
    }
    if partial && out.is_empty() {
        return Err(bad("No valid fields to update"));
    }
    Ok(out)
}

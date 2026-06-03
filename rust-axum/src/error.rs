use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

// A single error type that renders as the shared { "error": ... } envelope.
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
}

impl AppError {
    pub fn status(status: StatusCode, msg: impl Into<String>) -> Self {
        Self { status, message: msg.into() }
    }
}

// Shorthand for a 400.
pub fn bad(msg: impl Into<String>) -> AppError {
    AppError::status(StatusCode::BAD_REQUEST, msg)
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

// DB errors surface as 500s.
impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::status(StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
    }
}

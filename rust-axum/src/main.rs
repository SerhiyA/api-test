mod auth;
mod config;
mod error;
mod handlers;
mod models;
mod state;

use std::sync::Arc;

use axum::{
    extract::{DefaultBodyLimit, Request},
    http::{HeaderName, HeaderValue},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{Any, CorsLayer};

use config::Config;
use state::AppState;

#[tokio::main]
async fn main() {
    let config = Arc::new(Config::load());

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.pg_dsn)
        .await
        .expect("[rust-axum] failed to connect to postgres");

    let redis = match redis::Client::open(config.redis_url.clone()) {
        Ok(client) => match client.get_connection_manager().await {
            Ok(cm) => Some(cm),
            Err(e) => {
                eprintln!("[startup] redis unavailable, continuing without cache: {e}");
                None
            }
        },
        Err(e) => {
            eprintln!("[startup] bad REDIS_URL, continuing without cache: {e}");
            None
        }
    };

    let state = AppState { pool, redis, config: config.clone() };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .expose_headers([HeaderName::from_static("x-process-time-ms")]);

    let app = Router::new()
        .route("/health", get(health))
        .route("/auth/login", post(handlers::login))
        .route("/tasks", get(handlers::list_tasks).post(handlers::create_task))
        .route(
            "/tasks/:id",
            get(handlers::get_task).put(handlers::update_task).delete(handlers::delete_task),
        )
        .route("/bench/json", post(handlers::bench_json))
        .route("/bench/cpu", get(handlers::bench_cpu))
        .route("/bench/db", get(handlers::bench_db))
        .route("/bench/cache", get(handlers::bench_cache))
        .fallback(not_found)
        .layer(middleware::from_fn(timing))
        .layer(cors)
        // Allow large JSON payloads (matches the other impls; Axum defaults to 2 MB).
        .layer(DefaultBodyLimit::max(32 * 1024 * 1024))
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("[rust-axum] failed to bind");
    println!("[rust-axum] listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}

// Stamps X-Process-Time-Ms on every response (Axum buffers the response, so we
// can set the header after the handler runs).
async fn timing(req: Request, next: Next) -> Response {
    let start = std::time::Instant::now();
    let mut res = next.run(req).await;
    let ms = start.elapsed().as_secs_f64() * 1000.0;
    if let Ok(v) = HeaderValue::from_str(&format!("{ms:.3}")) {
        res.headers_mut().insert(HeaderName::from_static("x-process-time-ms"), v);
    }
    res
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "impl": "rust-axum" }))
}

async fn not_found() -> impl IntoResponse {
    (axum::http::StatusCode::NOT_FOUND, Json(json!({ "error": "Not found" })))
}

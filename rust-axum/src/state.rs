use std::sync::Arc;

use redis::aio::ConnectionManager;
use sqlx::PgPool;

use crate::config::Config;

// Shared application state. ConnectionManager and PgPool are cheap to clone
// (internally reference-counted); Redis is optional so the cache can be absent.
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub redis: Option<ConnectionManager>,
    pub config: Arc<Config>,
}

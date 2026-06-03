use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts, StatusCode},
};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::{config::Config, error::AppError, state::AppState};

#[derive(Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub iat: usize,
    pub exp: usize,
}

pub fn create_token(subject: &str, cfg: &Config) -> Result<String, AppError> {
    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: subject.to_string(),
        iat: now,
        exp: now + cfg.jwt_expires_hours * 3600,
    };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(cfg.jwt_secret.as_bytes()))
        .map_err(|_| AppError::status(StatusCode::INTERNAL_SERVER_ERROR, "failed to sign token"))
}

// Extractor that enforces a valid HS256 Bearer token. Handlers that require auth
// just take an `_auth: AuthUser` argument.
pub struct AuthUser;

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .unwrap_or("");
        let mut it = header.splitn(2, ' ');
        let scheme = it.next().unwrap_or("");
        let token = it.next().unwrap_or("");
        if scheme != "Bearer" || token.is_empty() {
            return Err(AppError::status(
                StatusCode::UNAUTHORIZED,
                "Missing or malformed Authorization header",
            ));
        }
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
            &Validation::new(Algorithm::HS256),
        )
        .map_err(|_| AppError::status(StatusCode::UNAUTHORIZED, "Invalid or expired token"))?;
        Ok(AuthUser)
    }
}

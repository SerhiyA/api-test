import jwt from 'jsonwebtoken';
import { config } from './config.js';

// Stamps every response with the server-measured handler time in ms.
// The portal reads X-Process-Time-Ms to show "server time" alongside round-trip.
export function processTimer(req, res, next) {
  const start = process.hrtime.bigint();
  const original = res.end;
  res.end = function patchedEnd(...args) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (!res.headersSent) res.setHeader('X-Process-Time-Ms', ms.toFixed(3));
    return original.apply(this, args);
  };
  next();
}

// JWT guard for protected routes. Expects `Authorization: Bearer <token>`.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Consistent error envelope. `status` defaults to 500.
export function errorHandler(err, req, res, _next) {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.message ?? 'Internal Server Error' });
}

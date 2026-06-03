import pg from 'pg';
import { config } from './config.js';

// A single shared connection pool. pg returns BIGINT/NUMERIC as strings by
// default; our ids are plain INT so default parsing is fine.
export const pool = new pg.Pool(config.pg);

export function query(text, params) {
  return pool.query(text, params);
}

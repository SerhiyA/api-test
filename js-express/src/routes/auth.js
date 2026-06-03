import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const authRouter = Router();

// Dev convenience: any POST returns a signed token. Real auth is out of scope
// for the benchmark; we only need a valid JWT to exercise the middleware.
authRouter.post('/login', (req, res) => {
  const subject = req.body?.username ?? 'benchmark-user';
  const token = jwt.sign({ sub: subject }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
  res.json({ token, tokenType: 'Bearer', expiresIn: config.jwtExpiresIn });
});

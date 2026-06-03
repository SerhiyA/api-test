import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { processTimer, requireAuth, errorHandler } from './middleware.js';
import { authRouter } from './routes/auth.js';
import { tasksRouter } from './routes/tasks.js';
import { benchRouter } from './routes/bench.js';

export function createApp() {
  const app = express();

  // Expose the timing header to browser JS (CORS hides custom headers otherwise).
  app.use(cors({ origin: config.corsOrigin, exposedHeaders: ['X-Process-Time-Ms'] }));
  app.use(processTimer);
  app.use(express.json({ limit: '25mb' }));

  // Surface malformed-JSON parse errors as a clean 400 instead of a 500.
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON in request body' });
    }
    next(err);
  });

  app.get('/health', (req, res) => res.json({ status: 'ok', impl: 'js-express' }));
  app.use('/auth', authRouter);
  app.use('/tasks', requireAuth, tasksRouter);
  app.use('/bench', requireAuth, benchRouter);

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}

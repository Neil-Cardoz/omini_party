import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) => {
    response.json({ ok: true, app: 'celebrAItions' });
  });

  return app;
};

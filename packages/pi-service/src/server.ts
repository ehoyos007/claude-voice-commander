import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { getConfig } from './lib/config';
import { healthRoutes } from './routes/health';
import { sessionRoutes } from './routes/sessions';
import { attentionRoutes } from './routes/attention';
import ttsRoutes from './routes/tts';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors());

// API Key authentication middleware (skip for health check and TTS audio)
app.use('*', async (c, next) => {
  // Allow health check and TTS audio without auth
  if (c.req.path === '/health' || c.req.path.startsWith('/tts/audio/')) {
    return next();
  }

  const apiKey = c.req.header('X-API-Key');
  const config = getConfig();

  if (!apiKey || apiKey !== config.apiKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
});

// Routes
app.route('/health', healthRoutes);
app.route('/sessions', sessionRoutes);
app.route('/attention', attentionRoutes);
app.route('/tts', ttsRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  );
});

export { app };

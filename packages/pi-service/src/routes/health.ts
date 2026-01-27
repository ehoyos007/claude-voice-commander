import { Hono } from 'hono';
import type { HealthResponse } from '@claude-voice-commander/shared';
import { getConfig } from '../lib/config';

const healthRoutes = new Hono();

const startTime = Date.now();

/**
 * GET /health
 * Returns system health status
 */
healthRoutes.get('/', (c) => {
  const config = getConfig();

  // TODO: Get actual values from session manager and attention queue
  const sessionCount = 0;
  const attentionQueueSize = 0;

  const response: HealthResponse = {
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    sessionCount,
    attentionQueueSize,
    version: '0.1.0',
  };

  return c.json(response);
});

export { healthRoutes };

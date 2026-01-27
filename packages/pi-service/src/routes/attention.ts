import { Hono } from 'hono';
import { z } from 'zod';
import type {
  AttentionQueueResponse,
  ResolveAttentionRequest,
} from '@claude-voice-commander/shared';

const attentionRoutes = new Hono();

// Request validation schemas
const resolveAttentionSchema = z.object({
  resolvedBy: z.enum(['call', 'sms', 'dashboard']),
  resolutionContent: z.string().min(1),
});

/**
 * GET /attention
 * Get the current attention queue
 */
attentionRoutes.get('/', async (c) => {
  // TODO: Get queue from attention queue service
  // const queueState = attentionQueue.getState();

  const response: AttentionQueueResponse = {
    items: [],
    batchWindowStartedAt: undefined,
    currentWindowMs: undefined,
    scheduledCallAt: undefined,
    timeRemainingMs: undefined,
  };

  return c.json(response);
});

/**
 * POST /attention/:id/resolve
 * Mark an attention item as resolved
 */
attentionRoutes.post('/:id/resolve', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = resolveAttentionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  const request: ResolveAttentionRequest = parsed.data;

  // TODO: Resolve item via attention queue service
  // await attentionQueue.resolveItem(id, request);

  return c.json({ success: true });
});

/**
 * POST /attention/trigger-now
 * Manually trigger an outbound call with current queue
 */
attentionRoutes.post('/trigger-now', async (c) => {
  // TODO: Trigger call via attention queue service
  // await attentionQueue.triggerCallNow();

  return c.json({ success: true });
});

/**
 * POST /attention/snooze
 * Snooze the scheduled call by N minutes
 */
attentionRoutes.post('/snooze', async (c) => {
  const body = await c.req.json();
  const minutes = body.minutes || 5;

  // TODO: Snooze via attention queue service
  // await attentionQueue.snooze(minutes);

  return c.json({ success: true, snoozedMinutes: minutes });
});

export { attentionRoutes };

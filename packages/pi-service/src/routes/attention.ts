import { Hono } from 'hono';
import { z } from 'zod';
import type { AttentionQueueResponse } from '@claude-voice-commander/shared';
import { attentionQueue } from '../services/attention-queue';

const attentionRoutes = new Hono();

const resolveAttentionSchema = z.object({
  resolvedBy: z.enum(['call', 'sms', 'dashboard']),
  resolutionContent: z.string().min(1),
});

/** GET /attention — Current attention queue */
attentionRoutes.get('/', async (c) => {
  const state = attentionQueue.getState();
  const response: AttentionQueueResponse = {
    items: state.items,
    batchWindowStartedAt: state.batchWindowStartedAt?.toISOString(),
    currentWindowMs: state.currentWindowMs,
    scheduledCallAt: state.scheduledCallAt instanceof Date
      ? state.scheduledCallAt.toISOString()
      : state.scheduledCallAt,
    timeRemainingMs: state.scheduledCallAt
      ? Math.max(0, new Date(state.scheduledCallAt).getTime() - Date.now())
      : undefined,
  };
  return c.json(response);
});

/** POST /attention/:id/resolve — Resolve an attention item */
attentionRoutes.post('/:id/resolve', async (c) => {
  const body = await c.req.json();
  const parsed = resolveAttentionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }
  await attentionQueue.resolveItem(c.req.param('id'), parsed.data.resolvedBy, parsed.data.resolutionContent);
  return c.json({ success: true });
});

/** POST /attention/trigger-now — Manually trigger outbound call */
attentionRoutes.post('/trigger-now', async (c) => {
  await attentionQueue.triggerCallNow();
  return c.json({ success: true });
});

/** POST /attention/snooze — Snooze scheduled call */
attentionRoutes.post('/snooze', async (c) => {
  const body = await c.req.json();
  const minutes = body.minutes || 5;
  await attentionQueue.snooze(minutes);
  return c.json({ success: true, snoozedMinutes: minutes });
});

/** POST /attention/clear-resolved — Clean up resolved items */
attentionRoutes.post('/clear-resolved', async (c) => {
  attentionQueue.clearResolved();
  return c.json({ success: true });
});

export { attentionRoutes };

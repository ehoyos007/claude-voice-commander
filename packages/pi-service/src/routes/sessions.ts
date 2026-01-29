import { Hono } from 'hono';
import { z } from 'zod';
import type {
  CreateSessionRequest,
  SessionListResponse,
  SessionWithOutput,
} from '@claude-voice-commander/shared';
import { sessionManager } from '../services/session-manager';

const sessionRoutes = new Hono();

const createSessionSchema = z.object({
  name: z.string().min(1).max(100),
  projectPath: z.string().optional(),
  description: z.string().optional(),
  initialPrompt: z.string().optional(),
});

const sendMessageSchema = z.object({
  message: z.string().min(1),
});

/** GET /sessions — List all active sessions */
sessionRoutes.get('/', async (c) => {
  const sessions = await sessionManager.getSessions();
  const response: SessionListResponse = { sessions };
  return c.json(response);
});

/** POST /sessions — Create a new session */
sessionRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  const session = await sessionManager.createSession(parsed.data);
  return c.json({ session }, 201);
});

/** GET /sessions/:id — Get session details with recent output */
sessionRoutes.get('/:id', async (c) => {
  const session = await sessionManager.getSession(c.req.param('id'));
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  let recentOutput = '';
  try {
    recentOutput = await sessionManager.getSessionOutput(session.id, 50);
  } catch { /* tmux may be gone */ }

  const result: SessionWithOutput = { ...session, recentOutput };
  return c.json({ session: result });
});

/** GET /sessions/:id/output — Get session terminal output */
sessionRoutes.get('/:id/output', async (c) => {
  const id = c.req.param('id');
  const lines = parseInt(c.req.query('lines') || '200', 10);
  const output = await sessionManager.getSessionOutput(id, lines);
  return c.json({ output });
});

/** POST /sessions/:id/send — Send a message to the session */
sessionRoutes.post('/:id/send', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  await sessionManager.sendMessage(id, parsed.data.message);
  return c.json({ success: true });
});

/** POST /sessions/:id/stop — Ctrl+C the session */
sessionRoutes.post('/:id/stop', async (c) => {
  await sessionManager.stopSession(c.req.param('id'));
  return c.json({ success: true });
});

/** POST /sessions/:id/kill — Terminate session */
sessionRoutes.post('/:id/kill', async (c) => {
  await sessionManager.killSession(c.req.param('id'));
  return c.json({ success: true });
});

/** POST /sessions/:id/resume — Resume a preserved session */
sessionRoutes.post('/:id/resume', async (c) => {
  await sessionManager.resumeSession(c.req.param('id'));
  return c.json({ success: true });
});

/** DELETE /sessions/:id — Alias for kill */
sessionRoutes.delete('/:id', async (c) => {
  await sessionManager.killSession(c.req.param('id'));
  return c.json({ success: true });
});

export { sessionRoutes };

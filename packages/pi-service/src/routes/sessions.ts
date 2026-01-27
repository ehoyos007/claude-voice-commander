import { Hono } from 'hono';
import { z } from 'zod';
import type {
  Session,
  CreateSessionRequest,
  SessionListResponse,
  SessionWithOutput,
} from '@claude-voice-commander/shared';

const sessionRoutes = new Hono();

// Request validation schemas
const createSessionSchema = z.object({
  name: z.string().min(1).max(100),
  projectPath: z.string().optional(),
  description: z.string().optional(),
  initialPrompt: z.string().optional(),
});

const sendMessageSchema = z.object({
  message: z.string().min(1),
});

/**
 * GET /sessions
 * List all active sessions
 */
sessionRoutes.get('/', async (c) => {
  // TODO: Get sessions from session manager
  const response: SessionListResponse = {
    sessions: [],
  };
  return c.json(response);
});

/**
 * POST /sessions
 * Create a new session
 */
sessionRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  const request: CreateSessionRequest = parsed.data;

  // TODO: Create session via session manager
  // const session = await sessionManager.createSession(request);

  // Stub response
  const session: Session = {
    id: crypto.randomUUID(),
    name: request.name,
    tmuxSession: `claude-${request.name}`,
    projectPath: request.projectPath,
    description: request.description,
    initialPrompt: request.initialPrompt,
    status: 'created',
    createdAt: new Date(),
    updatedAt: new Date(),
    errorCount: 0,
    isPreserved: false,
    metadata: {},
  };

  return c.json({ session }, 201);
});

/**
 * GET /sessions/:id
 * Get session details with recent output
 */
sessionRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  // TODO: Get session from session manager
  // const session = await sessionManager.getSession(id);
  // if (!session) {
  //   return c.json({ error: 'Session not found' }, 404);
  // }

  return c.json({ error: 'Not implemented' }, 501);
});

/**
 * GET /sessions/:id/output
 * Get session output with optional pagination
 */
sessionRoutes.get('/:id/output', async (c) => {
  const id = c.req.param('id');
  const lines = parseInt(c.req.query('lines') || '200', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  // TODO: Get output from session manager
  // const output = await sessionManager.getSessionOutput(id, lines, offset);

  return c.json({ error: 'Not implemented' }, 501);
});

/**
 * POST /sessions/:id/send
 * Send a message to the session
 */
sessionRoutes.post('/:id/send', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = sendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  // TODO: Send message via session manager
  // await sessionManager.sendMessage(id, parsed.data.message);

  return c.json({ success: true });
});

/**
 * POST /sessions/:id/stop
 * Send Ctrl+C to interrupt the session
 */
sessionRoutes.post('/:id/stop', async (c) => {
  const id = c.req.param('id');

  // TODO: Stop session via session manager
  // await sessionManager.stopSession(id);

  return c.json({ success: true });
});

/**
 * POST /sessions/:id/kill
 * Terminate the session completely
 */
sessionRoutes.post('/:id/kill', async (c) => {
  const id = c.req.param('id');

  // TODO: Kill session via session manager
  // await sessionManager.killSession(id);

  return c.json({ success: true });
});

/**
 * POST /sessions/:id/resume
 * Run /resume command in the session
 */
sessionRoutes.post('/:id/resume', async (c) => {
  const id = c.req.param('id');

  // TODO: Resume session via session manager
  // await sessionManager.resumeSession(id);

  return c.json({ success: true });
});

/**
 * DELETE /sessions/:id
 * Alias for kill
 */
sessionRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  // TODO: Kill session via session manager
  // await sessionManager.killSession(id);

  return c.json({ success: true });
});

export { sessionRoutes };

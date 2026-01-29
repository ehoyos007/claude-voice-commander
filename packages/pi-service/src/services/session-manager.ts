import type {
  Session,
  SessionStatus,
  CreateSessionRequest,
} from '@claude-voice-commander/shared';
import * as tmux from '../lib/tmux';
import { getConfig } from '../lib/config';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

/**
 * Session Manager Service
 *
 * Manages Claude Code sessions running in tmux.
 * Handles creation, lifecycle, and message passing.
 */
export interface ISessionManager {
  getSessions(): Promise<Session[]>;
  getSession(idOrName: string): Promise<Session | null>;
  createSession(request: CreateSessionRequest): Promise<Session>;
  sendMessage(sessionId: string, message: string): Promise<void>;
  stopSession(sessionId: string): Promise<void>;
  killSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<void>;
  getSessionOutput(sessionId: string, lines?: number): Promise<string>;
  updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void>;
  reconcile(): Promise<void>;
}

/** In-memory session store */
const sessions = new Map<string, Session>();

/** Resolve a session by ID or name, throwing if not found */
async function resolveSession(idOrName: string): Promise<Session> {
  const session = sessions.get(idOrName)
    ?? Array.from(sessions.values()).find((s) => s.name === idOrName);
  if (!session) {
    throw new Error(`Session '${idOrName}' not found`);
  }
  return session;
}

/** Build the Claude Code launch command */
function buildClaudeCommand(config: ReturnType<typeof getConfig>, request: CreateSessionRequest): string {
  const parts = [config.claudePath, '--dangerously-skip-permissions'];
  if (request.initialPrompt) {
    // Pass initial prompt via -p flag so Claude starts working immediately
    parts.push('-p', `"${request.initialPrompt.replace(/"/g, '\\"')}"`);
  }
  return parts.join(' ');
}

/** Ensure the archive log directory exists and return the log path */
async function ensureArchiveLogPath(sessionName: string): Promise<string> {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const archiveDir = join(home, '.claude-commander', 'archives');
  await mkdir(archiveDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(archiveDir, `${sessionName}-${timestamp}.log`);
}

export const sessionManager: ISessionManager = {
  async getSessions(): Promise<Session[]> {
    return Array.from(sessions.values());
  },

  async getSession(idOrName: string): Promise<Session | null> {
    return sessions.get(idOrName)
      ?? Array.from(sessions.values()).find((s) => s.name === idOrName)
      ?? null;
  },

  async createSession(request: CreateSessionRequest): Promise<Session> {
    const config = getConfig();

    // Enforce limits
    const activeSessions = await this.getSessions();
    if (activeSessions.length >= config.maxSessions) {
      throw new Error(`Maximum sessions (${config.maxSessions}) reached`);
    }

    const existing = await this.getSession(request.name);
    if (existing) {
      throw new Error(`Session '${request.name}' already exists`);
    }

    const id = crypto.randomUUID();
    const tmuxSessionName = `claude-${request.name}`;
    const claudeCmd = buildClaudeCommand(config, request);

    // 1. Create tmux session running Claude Code
    await tmux.createSession(tmuxSessionName, claudeCmd, request.projectPath);

    // 2. Set up pipe-pane for archiving output
    try {
      const logPath = await ensureArchiveLogPath(request.name);
      await tmux.startPipePane(tmuxSessionName, logPath);
    } catch (err) {
      console.error(`Failed to set up pipe-pane for ${tmuxSessionName}:`, err);
      // Non-fatal — session still works without archiving
    }

    const session: Session = {
      id,
      name: request.name,
      tmuxSession: tmuxSessionName,
      projectPath: request.projectPath,
      description: request.description,
      initialPrompt: request.initialPrompt,
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      errorCount: 0,
      isPreserved: false,
      metadata: {},
    };

    sessions.set(id, session);
    console.log(`Session created: ${request.name} (${id}) → tmux:${tmuxSessionName}`);
    return session;
  },

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = await resolveSession(sessionId);
    await tmux.sendKeys(session.tmuxSession, message);
    session.updatedAt = new Date();
    session.lastActivityAt = new Date();
  },

  async stopSession(sessionId: string): Promise<void> {
    const session = await resolveSession(sessionId);
    await tmux.sendCtrlC(session.tmuxSession);
    session.status = 'stopped';
    session.updatedAt = new Date();
  },

  async killSession(sessionId: string): Promise<void> {
    const session = await resolveSession(sessionId);

    // Stop archiving first
    try {
      await tmux.stopPipePane(session.tmuxSession);
    } catch { /* ignore if already gone */ }

    try {
      await tmux.killSession(session.tmuxSession);
    } catch { /* tmux session may already be dead */ }

    session.status = 'killed';
    session.updatedAt = new Date();
    sessions.delete(session.id);
    console.log(`Session killed: ${session.name} (${session.id})`);
  },

  async resumeSession(sessionId: string): Promise<void> {
    const session = await resolveSession(sessionId);
    await tmux.sendKeys(session.tmuxSession, '/resume');
    session.status = 'running';
    session.isPreserved = false;
    session.updatedAt = new Date();
  },

  async getSessionOutput(sessionId: string, lines = 200): Promise<string> {
    const session = await resolveSession(sessionId);
    return tmux.capturePane(session.tmuxSession, lines);
  },

  async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const session = await resolveSession(sessionId);
    session.status = status;
    session.updatedAt = new Date();
  },

  /**
   * Reconcile in-memory state with actual tmux sessions.
   * Marks sessions as killed if their tmux session no longer exists.
   */
  async reconcile(): Promise<void> {
    for (const session of sessions.values()) {
      const exists = await tmux.sessionExists(session.tmuxSession);
      if (!exists && session.status !== 'killed') {
        console.log(`Reconcile: tmux session gone for ${session.name}, marking killed`);
        session.status = 'killed';
        session.updatedAt = new Date();
        sessions.delete(session.id);
      }
    }
  },
};

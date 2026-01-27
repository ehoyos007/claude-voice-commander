import type {
  Session,
  SessionStatus,
  CreateSessionRequest,
} from '@claude-voice-commander/shared';
import * as tmux from '../lib/tmux';
import { getConfig } from '../lib/config';

/**
 * Session Manager Service
 *
 * Manages Claude Code sessions running in tmux.
 * Handles creation, lifecycle, and message passing.
 */
export interface ISessionManager {
  /** Get all active sessions */
  getSessions(): Promise<Session[]>;

  /** Get a specific session by ID or name */
  getSession(idOrName: string): Promise<Session | null>;

  /** Create a new session */
  createSession(request: CreateSessionRequest): Promise<Session>;

  /** Send a message to a session */
  sendMessage(sessionId: string, message: string): Promise<void>;

  /** Stop a session (Ctrl+C) */
  stopSession(sessionId: string): Promise<void>;

  /** Kill a session completely */
  killSession(sessionId: string): Promise<void>;

  /** Resume a session (/resume command) */
  resumeSession(sessionId: string): Promise<void>;

  /** Get recent output from a session */
  getSessionOutput(sessionId: string, lines?: number): Promise<string>;

  /** Update session status */
  updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void>;
}

/**
 * In-memory session store (will be synced to Supabase and local state)
 */
const sessions = new Map<string, Session>();

/**
 * Session Manager Implementation
 */
export const sessionManager: ISessionManager = {
  async getSessions(): Promise<Session[]> {
    // TODO: Implement - return sessions from local state
    // Should also reconcile with actual tmux sessions
    return Array.from(sessions.values());
  },

  async getSession(idOrName: string): Promise<Session | null> {
    // TODO: Implement - find by ID or name
    // Check local state first, then tmux
    const session = sessions.get(idOrName);
    if (session) return session;

    // Try to find by name
    for (const s of sessions.values()) {
      if (s.name === idOrName) return s;
    }

    return null;
  },

  async createSession(request: CreateSessionRequest): Promise<Session> {
    const config = getConfig();

    // Check max sessions limit
    const activeSessions = await this.getSessions();
    if (activeSessions.length >= config.maxSessions) {
      throw new Error(`Maximum sessions (${config.maxSessions}) reached`);
    }

    // Check if name already exists
    const existing = await this.getSession(request.name);
    if (existing) {
      throw new Error(`Session '${request.name}' already exists`);
    }

    const id = crypto.randomUUID();
    const tmuxSessionName = `claude-${request.name}`;

    // TODO: Implement actual session creation
    // 1. Create tmux session
    // 2. Start Claude Code with --dangerously-skip-permissions
    // 3. If initialPrompt provided, send it
    // 4. Set up pipe-pane for archiving
    // 5. Store in local state and sync to Supabase

    const session: Session = {
      id,
      name: request.name,
      tmuxSession: tmuxSessionName,
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

    sessions.set(id, session);
    return session;
  },

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    // TODO: Implement - send keys to tmux session
    // await tmux.sendKeys(session.tmuxSession, message);

    // Update last activity
    session.updatedAt = new Date();
    session.lastActivityAt = new Date();
  },

  async stopSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    // TODO: Implement - send Ctrl+C to tmux session
    // await tmux.sendCtrlC(session.tmuxSession);

    session.status = 'stopped';
    session.updatedAt = new Date();
  },

  async killSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    // TODO: Implement - kill tmux session
    // await tmux.killSession(session.tmuxSession);

    session.status = 'killed';
    session.updatedAt = new Date();
    sessions.delete(sessionId);
  },

  async resumeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    // TODO: Implement - send /resume command to session
    // await tmux.sendKeys(session.tmuxSession, '/resume');

    session.status = 'running';
    session.isPreserved = false;
    session.updatedAt = new Date();
  },

  async getSessionOutput(sessionId: string, lines = 200): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    // TODO: Implement - capture tmux pane content
    // return await tmux.capturePane(session.tmuxSession, lines);
    return '';
  },

  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    session.status = status;
    session.updatedAt = new Date();
  },
};

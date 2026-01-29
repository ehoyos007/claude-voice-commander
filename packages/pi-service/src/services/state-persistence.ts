import type {
  PersistedState,
  Session,
  AttentionItem,
  SystemConfig,
  Decision,
  SystemBootPayload,
} from '@claude-voice-commander/shared';
import { getConfig } from '../lib/config';
import { getSupabase } from '../lib/supabase';
import { sessionManager } from './session-manager';
import { attentionQueue } from './attention-queue';

/**
 * State Persistence Service
 *
 * Persists state to local JSON file for resilience across reboots.
 * Also syncs to Supabase for dashboard access.
 */
export interface IStatePersistence {
  /** Save current state to file */
  saveState(): Promise<void>;

  /** Load state from file */
  loadState(): Promise<PersistedState | null>;

  /** Restore state after reboot */
  restoreState(): Promise<void>;

  /** Record a decision */
  recordDecision(decision: Omit<Decision, 'id' | 'createdAt'>): Promise<void>;

  /** Get decisions for a session */
  getDecisions(sessionId: string): Promise<Decision[]>;

  /** Update system settings */
  updateSettings(settings: Partial<SystemConfig>): Promise<void>;

  /** Get current settings */
  getSettings(): SystemConfig;
}

/**
 * Current state version for migrations
 */
const STATE_VERSION = 1;

/**
 * Default settings
 */
const defaultSettings: SystemConfig = {
  dndEnabled: false,
  dndSchedule: undefined,
  notificationChannels: ['sms', 'slack', 'email'],
  maxSessions: 5,
  pollIntervalMs: 1500,
};

/**
 * In-memory state
 */
let currentSettings: SystemConfig = { ...defaultSettings };
let decisions: Decision[] = [];
let piBootTime = new Date();

/**
 * Ensure state directory exists
 */
async function ensureStateDir(): Promise<void> {
  const config = getConfig();
  const stateDir = config.stateFile.replace(/\/[^/]+$/, '');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(stateDir, { recursive: true });
}

/**
 * Convert camelCase Session to snake_case DB row
 */
function sessionToRow(s: Session) {
  return {
    id: s.id,
    name: s.name,
    tmux_session: s.tmuxSession,
    project_path: s.projectPath ?? null,
    description: s.description ?? null,
    initial_prompt: s.initialPrompt ?? null,
    status: s.status,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    last_activity_at: s.lastActivityAt ?? null,
    last_output_preview: s.lastOutputPreview ?? null,
    error_count: s.errorCount,
    is_preserved: s.isPreserved,
    metadata: s.metadata,
  };
}

/**
 * Sync sessions to Supabase (best-effort, non-blocking)
 */
async function syncSessionsToSupabase(sessions: Session[]): Promise<void> {
  const sb = getSupabase();
  if (sessions.length === 0) return;

  const rows = sessions.map(sessionToRow);
  const { error } = await sb.from('sessions').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('Supabase session sync error:', error.message);
  }
}

/**
 * Sync a decision to Supabase
 */
async function syncDecisionToSupabase(d: Decision): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('decisions').upsert({
    id: d.id,
    session_id: d.sessionId,
    question: d.question,
    answer: d.answer,
    context: d.context ?? null,
    created_at: d.createdAt,
  });
  if (error) {
    console.error('Supabase decision sync error:', error.message);
  }
}

/**
 * Log an audit event to Supabase
 */
async function logAudit(
  eventType: string,
  actor: string,
  description: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('audit_logs').insert({
    event_type: eventType,
    actor,
    description,
    details,
  });
  if (error) {
    console.error('Supabase audit log error:', error.message);
  }
}

/**
 * State Persistence Implementation
 */
export const statePersistence: IStatePersistence = {
  async saveState(): Promise<void> {
    const config = getConfig();
    await ensureStateDir();

    const sessions = await sessionManager.getSessions();
    const queueState = attentionQueue.getState();

    const state: PersistedState = {
      version: STATE_VERSION,
      piBootTime: piBootTime.toISOString(),
      lastSync: new Date().toISOString(),
      sessions: Object.fromEntries(sessions.map((s) => [s.id, s])),
      attentionQueue: queueState.items,
      batchWindowStartedAt: queueState.batchWindowStartedAt?.toISOString(),
      settings: currentSettings,
      decisionLog: decisions,
    };

    await Bun.write(config.stateFile, JSON.stringify(state, null, 2));

    // Sync sessions to Supabase (best-effort)
    syncSessionsToSupabase(sessions).catch(() => {});
  },

  async loadState(): Promise<PersistedState | null> {
    const config = getConfig();

    try {
      const file = Bun.file(config.stateFile);
      if (!(await file.exists())) {
        return null;
      }

      const content = await file.text();
      const state = JSON.parse(content) as PersistedState;

      return state;
    } catch (error) {
      console.error('Error loading state:', error);
      return null;
    }
  },

  async restoreState(): Promise<void> {
    piBootTime = new Date();

    const state = await this.loadState();
    if (!state) {
      console.log('No previous state found, starting fresh');
      logAudit('system.boot', 'system', 'Pi booted (fresh start)').catch(() => {});
      return;
    }

    console.log('Restoring state from', state.lastSync);

    // Restore settings
    currentSettings = { ...defaultSettings, ...state.settings };

    // Restore decisions
    decisions = state.decisionLog || [];

    // Mark sessions as preserved (they need manual resume)
    const preservedSessions: Array<{
      name: string;
      status: string;
      lastActivity?: string;
    }> = [];

    for (const session of Object.values(state.sessions)) {
      if (session.status !== 'killed') {
        session.isPreserved = true;
        session.status = 'preserved';
        preservedSessions.push({
          name: session.name,
          status: session.status,
          lastActivity: session.lastActivityAt?.toString(),
        });
      }
    }

    // Sync preserved sessions to Supabase
    const sessionsToSync = Object.values(state.sessions).filter(
      (s) => s.status !== 'killed'
    );
    syncSessionsToSupabase(sessionsToSync).catch(() => {});

    // Log boot event
    logAudit('system.boot', 'system', `Pi rebooted, ${preservedSessions.length} sessions preserved`, {
      previousSync: state.lastSync,
      preservedSessions: preservedSessions.map((s) => s.name),
    }).catch(() => {});

    // Send boot notification
    const bootPayload: SystemBootPayload = {
      event: 'system.boot',
      bootTime: piBootTime.toISOString(),
      sessions: preservedSessions.map((s) => ({
        name: s.name,
        status: s.status as any,
        lastActivity: s.lastActivity,
      })),
    };

    // TODO: Send webhook notification to n8n
    console.log('Would send boot notification:', bootPayload);

    console.log(
      `Restored ${preservedSessions.length} sessions (marked as preserved)`
    );
  },

  async recordDecision(
    decision: Omit<Decision, 'id' | 'createdAt'>
  ): Promise<void> {
    const newDecision: Decision = {
      ...decision,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    decisions.push(newDecision);

    // Keep last 100 decisions per session
    const sessionDecisions = decisions.filter(
      (d) => d.sessionId === decision.sessionId
    );
    if (sessionDecisions.length > 100) {
      decisions = decisions.filter(
        (d) => d.sessionId !== decision.sessionId || sessionDecisions.indexOf(d) >= sessionDecisions.length - 100
      );
    }

    // Save state after recording
    await this.saveState();

    // Sync to Supabase
    syncDecisionToSupabase(newDecision).catch(() => {});
  },

  async getDecisions(sessionId: string): Promise<Decision[]> {
    return decisions.filter((d) => d.sessionId === sessionId);
  },

  async updateSettings(settings: Partial<SystemConfig>): Promise<void> {
    currentSettings = { ...currentSettings, ...settings };
    await this.saveState();
  },

  getSettings(): SystemConfig {
    return { ...currentSettings };
  },
};

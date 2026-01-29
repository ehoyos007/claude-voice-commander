import type {
  AttentionItem,
  AttentionType,
  AttentionPriority,
  Session,
} from '@claude-voice-commander/shared';
import { sessionManager } from './session-manager';
import { attentionQueue } from './attention-queue';
import * as tmux from '../lib/tmux';
import { getConfig } from '../lib/config';

export interface IOutputMonitor {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  pollAll(): Promise<AttentionItem[]>;
}

/** Output hash cache — tracks last seen content per session */
const outputHashes = new Map<string, string>();

/** Tracks the last detection type per session to avoid duplicate alerts */
const lastDetection = new Map<string, { type: AttentionType; matchedLine: string }>();

let isMonitorRunning = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Anti-patterns: lines matching these are skipped before detection
// ---------------------------------------------------------------------------
const ANTI_PATTERNS = [
  /\[INFO\]|\[DEBUG\]|\[WARN\]/i,
  /logging error/i,
  /error handling/i,
  /^#|^\/\/|^\*/,
  /TODO:|FIXME:|NOTE:/,
  /should .+ when/i,
  /previously failed/i,
  /was an error/i,
  /fixed the error/i,
  // Claude Code UI chrome — ignore prompt lines, borders, and status bars
  /^❯/,
  /^\s*Opus \d/,
  /bypass permissions/i,
  /shift\+Tab to cycle/i,
  /^╭|^│|^╰|^─/,
  /Welcome back/i,
  /ctrl\+o to expand/i,
  /Enter to select/i,
  /Tab\/Arrow keys/i,
];

// ---------------------------------------------------------------------------
// Detection patterns ordered by priority
// ---------------------------------------------------------------------------
const PATTERNS: { type: AttentionType; priority: AttentionPriority; patterns: RegExp[] }[] = [
  {
    type: 'error',
    priority: 5,
    patterns: [
      /error:/i,
      /failed:/i,
      /exception:/i,
      /traceback/i,
      /permission denied/i,
      /cannot |unable to /i,
      /ENOENT|EACCES|EPERM|ECONNREFUSED/i,
      /fatal:/i,
      /panic:/i,
      /compilation failed/i,
      /build failed/i,
      /syntax error/i,
      /test failed/i,
      /assertion failed/i,
    ],
  },
  {
    type: 'blocking',
    priority: 4,
    patterns: [
      /waiting for (?:input|response|confirmation)/i,
      /please (?:provide|enter|specify|confirm)/i,
      /need(?:s)? (?:your|more) input/i,
      /cannot proceed without/i,
      /before I can continue/i,
      /I need you to/i,
    ],
  },
  {
    type: 'question',
    priority: 3,
    patterns: [
      /\?$/m,
      /what would you like me to/i,
      /should I/i,
      /do you want me to/i,
      /please clarify/i,
      /which (?:one|option|approach)/i,
      /would you prefer/i,
      /how should I/i,
    ],
  },
  {
    type: 'completion',
    priority: 1,
    patterns: [
      /task complete/i,
      /done!/i,
      /finished/i,
      /all tests pass/i,
      /successfully/i,
      /I've completed/i,
      /here's what I did/i,
      /build succeeded/i,
    ],
  },
];

function isAntiPattern(line: string): boolean {
  return ANTI_PATTERNS.some((p) => p.test(line));
}

export function detectAttentionType(
  content: string
): { type: AttentionType; priority: AttentionPriority; matchedLine: string } | null {
  const lines = content.split('\n');
  const recentLines = lines.slice(-20);

  for (const line of recentLines.reverse()) {
    // Strip Claude Code output prefix (⏺) before checking
    const trimmed = line.trim().replace(/^⏺\s*/, '');
    if (!trimmed || isAntiPattern(trimmed)) continue;

    for (const group of PATTERNS) {
      for (const pattern of group.patterns) {
        if (pattern.test(trimmed)) {
          return { type: group.type, priority: group.priority, matchedLine: trimmed };
        }
      }
    }
  }

  return null;
}

function getContext(content: string, matchedLine: string, contextLines = 20): string {
  const lines = content.split('\n');
  const matchIndex = lines.findIndex((l) => l.trim() === matchedLine);
  if (matchIndex === -1) {
    return lines.slice(-contextLines).join('\n');
  }
  const start = Math.max(0, matchIndex - Math.floor(contextLines / 2));
  const end = Math.min(lines.length, matchIndex + Math.ceil(contextLines / 2));
  return lines.slice(start, end).join('\n');
}

async function pollSession(session: Session): Promise<Omit<AttentionItem, 'id' | 'detectedAt'> | null> {
  try {
    const output = await tmux.capturePane(session.tmuxSession, 200);

    // Change detection via hash
    const hasher = new Bun.CryptoHasher('md5');
    hasher.update(output);
    const currentHash = hasher.digest('hex');

    const previousHash = outputHashes.get(session.id);
    if (currentHash === previousHash) {
      return null;
    }
    outputHashes.set(session.id, currentHash);

    // Update session output preview
    const lines = output.split('\n').filter((l) => l.trim());
    session.lastOutputPreview = lines.slice(-3).join('\n');

    // Detect attention type
    const detected = detectAttentionType(output);
    if (!detected) {
      // Output changed but no pattern matched — session is active
      await sessionManager.updateSessionStatus(session.id, 'running');
      lastDetection.delete(session.id);
      return null;
    }

    // Dedup: skip if same detection type + matched line as last poll
    const prev = lastDetection.get(session.id);
    if (prev && prev.type === detected.type && prev.matchedLine === detected.matchedLine) {
      return null;
    }
    lastDetection.set(session.id, { type: detected.type, matchedLine: detected.matchedLine });

    // Update session status based on detection
    if (detected.type === 'question' || detected.type === 'blocking') {
      await sessionManager.updateSessionStatus(session.id, 'waiting_input');
    } else if (detected.type === 'error') {
      await sessionManager.updateSessionStatus(session.id, 'error');
      session.errorCount++;
    }

    return {
      sessionId: session.id,
      sessionName: session.name,
      type: detected.type,
      priority: detected.priority,
      content: detected.matchedLine,
      context: getContext(output, detected.matchedLine),
      metadata: {},
    };
  } catch (error) {
    console.error(`Error polling session ${session.name}:`, error);
    return null;
  }
}

/** Clean up tracking state for a removed session */
export function clearSessionState(sessionId: string): void {
  outputHashes.delete(sessionId);
  lastDetection.delete(sessionId);
}

export const outputMonitor: IOutputMonitor = {
  start(): void {
    if (isMonitorRunning) {
      console.log('Output monitor already running');
      return;
    }

    const config = getConfig();
    isMonitorRunning = true;

    console.log(`Output monitor started (poll every ${config.pollIntervalMs}ms)`);

    pollInterval = setInterval(async () => {
      try {
        await this.pollAll();
      } catch (error) {
        console.error('Poll cycle error:', error);
      }
    }, config.pollIntervalMs);
  },

  stop(): void {
    if (!isMonitorRunning) return;
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    isMonitorRunning = false;
    console.log('Output monitor stopped');
  },

  isRunning(): boolean {
    return isMonitorRunning;
  },

  async pollAll(): Promise<AttentionItem[]> {
    const sessions = await sessionManager.getSessions();
    const items: AttentionItem[] = [];

    const activeSessions = sessions.filter(
      (s) => s.status === 'running' || s.status === 'waiting_input' || s.status === 'error'
    );

    // Also reconcile — detect tmux sessions that died
    await sessionManager.reconcile();

    for (const session of activeSessions) {
      const item = await pollSession(session);
      if (item) {
        // attentionQueue.addItem assigns id and detectedAt
        await attentionQueue.addItem(item);
        // Retrieve the full item from the queue state for return
        const queueState = attentionQueue.getState();
        const added = queueState.items[queueState.items.length - 1];
        if (added) items.push(added);
      }
    }

    return items;
  },
};

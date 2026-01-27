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

/**
 * Output Monitor Service
 *
 * Polls tmux session output and detects patterns that need attention.
 * Detected patterns:
 * - Questions (priority 3)
 * - Errors (priority 5)
 * - Blocking (priority 4)
 * - Completions (priority 1)
 */
export interface IOutputMonitor {
  /** Start the polling loop */
  start(): void;

  /** Stop the polling loop */
  stop(): void;

  /** Check if monitor is running */
  isRunning(): boolean;

  /** Manually poll all sessions (for testing) */
  pollAll(): Promise<AttentionItem[]>;
}

/**
 * Output hash cache for detecting changes
 */
const outputHashes = new Map<string, string>();

/**
 * Monitor state
 */
let isMonitorRunning = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Detection patterns
 * TODO: Move to configurable patterns file
 */
const PATTERNS = {
  question: [
    /\?$/m, // Ends with question mark
    /what would you like me to/i,
    /should I/i,
    /do you want me to/i,
    /please clarify/i,
    /which (?:one|option)/i,
    /would you prefer/i,
  ],
  error: [
    /error:/i,
    /failed:/i,
    /exception:/i,
    /traceback/i,
    /permission denied/i,
    /cannot |unable to /i,
    /ENOENT|EACCES|EPERM/i,
    /fatal:/i,
    /panic:/i,
  ],
  completion: [
    /task complete/i,
    /done!/i,
    /finished/i,
    /all tests passing/i,
    /successfully/i,
    /completed/i,
  ],
  blocking: [
    /waiting for (?:input|response)/i,
    /please (?:provide|enter|specify)/i,
    /need(?:s)? (?:your|more) input/i,
  ],
};

/**
 * Detect attention type from output content
 */
function detectAttentionType(
  content: string
): { type: AttentionType; priority: AttentionPriority; matchedLine: string } | null {
  const lines = content.split('\n');

  // Check last 20 lines for patterns
  const recentLines = lines.slice(-20);

  for (const line of recentLines.reverse()) {
    // Check for errors first (highest priority)
    for (const pattern of PATTERNS.error) {
      if (pattern.test(line)) {
        return { type: 'error', priority: 5, matchedLine: line };
      }
    }

    // Check for blocking
    for (const pattern of PATTERNS.blocking) {
      if (pattern.test(line)) {
        return { type: 'blocking', priority: 4, matchedLine: line };
      }
    }

    // Check for questions
    for (const pattern of PATTERNS.question) {
      if (pattern.test(line)) {
        return { type: 'question', priority: 3, matchedLine: line };
      }
    }

    // Check for completions
    for (const pattern of PATTERNS.completion) {
      if (pattern.test(line)) {
        return { type: 'completion', priority: 1, matchedLine: line };
      }
    }
  }

  return null;
}

/**
 * Get context (surrounding lines) for an attention item
 */
function getContext(content: string, matchedLine: string, contextLines = 20): string {
  const lines = content.split('\n');
  const matchIndex = lines.findIndex((l) => l === matchedLine);

  if (matchIndex === -1) {
    // Return last N lines if match not found
    return lines.slice(-contextLines).join('\n');
  }

  const start = Math.max(0, matchIndex - Math.floor(contextLines / 2));
  const end = Math.min(lines.length, matchIndex + Math.ceil(contextLines / 2));

  return lines.slice(start, end).join('\n');
}

/**
 * Poll a single session for attention items
 */
async function pollSession(session: Session): Promise<AttentionItem | null> {
  try {
    // Get current output
    const output = await tmux.capturePane(session.tmuxSession, 200);

    // Get hash for change detection
    const hasher = new Bun.CryptoHasher('md5');
    hasher.update(output);
    const currentHash = hasher.digest('hex');

    // Check if output changed
    const previousHash = outputHashes.get(session.id);
    if (currentHash === previousHash) {
      return null; // No change
    }

    // Update hash
    outputHashes.set(session.id, currentHash);

    // Detect attention type
    const detected = detectAttentionType(output);
    if (!detected) {
      return null;
    }

    // Create attention item
    const item: Omit<AttentionItem, 'id' | 'detectedAt'> = {
      sessionId: session.id,
      sessionName: session.name,
      type: detected.type,
      priority: detected.priority,
      content: detected.matchedLine,
      context: getContext(output, detected.matchedLine),
      metadata: {},
    };

    return item as AttentionItem;
  } catch (error) {
    console.error(`Error polling session ${session.name}:`, error);
    return null;
  }
}

/**
 * Output Monitor Implementation
 */
export const outputMonitor: IOutputMonitor = {
  start(): void {
    if (isMonitorRunning) {
      console.log('Output monitor already running');
      return;
    }

    const config = getConfig();
    isMonitorRunning = true;

    console.log(`Starting output monitor (poll interval: ${config.pollIntervalMs}ms)`);

    pollInterval = setInterval(async () => {
      try {
        await this.pollAll();
      } catch (error) {
        console.error('Error in poll cycle:', error);
      }
    }, config.pollIntervalMs);
  },

  stop(): void {
    if (!isMonitorRunning) {
      return;
    }

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

    // Only poll active sessions
    const activeSessions = sessions.filter(
      (s) => s.status === 'running' || s.status === 'waiting_input'
    );

    for (const session of activeSessions) {
      const item = await pollSession(session);
      if (item) {
        items.push(item);
        await attentionQueue.addItem(item);
      }
    }

    return items;
  },
};

import type {
  AttentionItem,
  AttentionType,
  AttentionPriority,
  AttentionQueueState,
  AttentionBatchReadyPayload,
} from '@claude-voice-commander/shared';
import { getConfig } from '../lib/config';

/**
 * Attention Queue Service
 *
 * Manages the queue of items that need user attention.
 * Implements tiered batching based on priority.
 *
 * Priority Windows:
 * - 5 (Error): 30 seconds
 * - 4 (Blocking): 60 seconds
 * - 3 (Question): 2 minutes
 * - 2 (Minor): 3 minutes
 * - 1 (Completion): 5 minutes
 *
 * Rules:
 * - Timer starts when FIRST item enters empty queue
 * - New items do NOT reset timer
 * - Higher priority items can SHORTEN remaining window (never extend)
 * - Maximum absolute window: 5 minutes
 */
export interface IAttentionQueue {
  /** Add an item to the queue */
  addItem(item: Omit<AttentionItem, 'id' | 'detectedAt'>): Promise<void>;

  /** Resolve an item */
  resolveItem(
    itemId: string,
    resolvedBy: 'call' | 'sms' | 'dashboard' | 'auto',
    resolutionContent: string
  ): Promise<void>;

  /** Get current queue state */
  getState(): AttentionQueueState;

  /** Check if we should trigger a call now */
  shouldTriggerCall(): boolean;

  /** Trigger call immediately (manual) */
  triggerCallNow(): Promise<void>;

  /** Snooze scheduled call by N minutes */
  snooze(minutes: number): Promise<void>;

  /** Clear resolved items from queue */
  clearResolved(): void;
}

/**
 * Priority to window mapping (milliseconds)
 */
const PRIORITY_WINDOWS: Record<AttentionPriority, number> = {
  5: 30 * 1000,      // 30 seconds for errors
  4: 60 * 1000,      // 60 seconds for blocking
  3: 2 * 60 * 1000,  // 2 minutes for questions
  2: 3 * 60 * 1000,  // 3 minutes for minor
  1: 5 * 60 * 1000,  // 5 minutes for completions
};

const MAX_WINDOW_MS = 5 * 60 * 1000; // 5 minutes absolute max

/**
 * Internal state
 */
interface QueueState {
  items: AttentionItem[];
  firstItemAt: Date | null;
  currentWindowMs: number | null;
  scheduledCallAt: Date | null;
  timerId: ReturnType<typeof setTimeout> | null;
}

const state: QueueState = {
  items: [],
  firstItemAt: null,
  currentWindowMs: null,
  scheduledCallAt: null,
  timerId: null,
};

/**
 * Send webhook to n8n when call should be triggered
 */
async function triggerWebhook(): Promise<void> {
  const config = getConfig();

  const payload: AttentionBatchReadyPayload = {
    event: 'attention.batch_ready',
    batchId: crypto.randomUUID(),
    items: state.items.filter((i) => !i.resolvedAt),
    triggeredAt: new Date().toISOString(),
    triggerReason: 'timer_expired',
  };

  // Call n8n webhook to initiate outbound call
  const webhookUrl = config.n8nWebhookUrl || 'https://firsthealthenrollment.app.n8n.cloud/webhook/initiate-outbound-call';
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.error('Webhook failed:', response.status, await response.text());
    } else {
      console.log('Webhook triggered successfully:', await response.json());
    }
  } catch (error) {
    console.error('Error triggering webhook:', error);
  }

  console.log('Triggered webhook:', payload);

  // Reset state after triggering
  state.firstItemAt = null;
  state.currentWindowMs = null;
  state.scheduledCallAt = null;
  state.timerId = null;
}

/**
 * Schedule the next call trigger
 */
function scheduleCall(windowMs: number): void {
  // Clear existing timer
  if (state.timerId) {
    clearTimeout(state.timerId);
  }

  state.currentWindowMs = windowMs;
  state.scheduledCallAt = new Date(Date.now() + windowMs);

  state.timerId = setTimeout(() => {
    triggerWebhook();
  }, windowMs);
}

/**
 * Attention Queue Implementation
 */
export const attentionQueue: IAttentionQueue = {
  async addItem(
    item: Omit<AttentionItem, 'id' | 'detectedAt'>
  ): Promise<void> {
    const newItem: AttentionItem = {
      ...item,
      id: crypto.randomUUID(),
      detectedAt: new Date(),
    };

    state.items.push(newItem);
    console.log(`Attention: ${item.type} (p${item.priority}) in ${item.sessionName}: ${item.content.slice(0, 80)}`);

    // If this is the first item, start the timer
    if (!state.firstItemAt) {
      state.firstItemAt = new Date();
      const windowMs = PRIORITY_WINDOWS[item.priority];
      scheduleCall(windowMs);
      return;
    }

    // If new item has higher priority, potentially shorten window
    const newWindowMs = PRIORITY_WINDOWS[item.priority];
    if (state.currentWindowMs && newWindowMs < state.currentWindowMs) {
      // Calculate remaining time with new window
      const elapsed = Date.now() - state.firstItemAt.getTime();
      const remainingWithNewWindow = Math.max(0, newWindowMs - elapsed);

      // Only shorten if there's still time remaining
      if (remainingWithNewWindow > 0) {
        scheduleCall(remainingWithNewWindow);
      } else {
        // Timer should have already fired
        triggerWebhook();
      }
    }

    // Check max window
    if (state.firstItemAt) {
      const elapsed = Date.now() - state.firstItemAt.getTime();
      if (elapsed >= MAX_WINDOW_MS) {
        triggerWebhook();
      }
    }
  },

  async resolveItem(
    itemId: string,
    resolvedBy: 'call' | 'sms' | 'dashboard' | 'auto',
    resolutionContent: string
  ): Promise<void> {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`Attention item '${itemId}' not found`);
    }

    item.resolvedAt = new Date();
    item.resolvedBy = resolvedBy;
    item.resolutionContent = resolutionContent;

    // TODO: Sync to Supabase
    // TODO: Send response to corresponding session if needed
  },

  getState(): AttentionQueueState {
    return {
      items: [...state.items],
      batchWindowStartedAt: state.firstItemAt || undefined,
      currentWindowMs: state.currentWindowMs || undefined,
      scheduledCallAt: state.scheduledCallAt || undefined,
    };
  },

  shouldTriggerCall(): boolean {
    if (!state.firstItemAt || state.items.length === 0) {
      return false;
    }

    const unresolvedItems = state.items.filter((i) => !i.resolvedAt);
    if (unresolvedItems.length === 0) {
      return false;
    }

    const elapsed = Date.now() - state.firstItemAt.getTime();

    // Check if current window expired
    if (state.currentWindowMs && elapsed >= state.currentWindowMs) {
      return true;
    }

    // Check absolute max window
    if (elapsed >= MAX_WINDOW_MS) {
      return true;
    }

    return false;
  },

  async triggerCallNow(): Promise<void> {
    if (state.items.filter((i) => !i.resolvedAt).length === 0) {
      throw new Error('No unresolved items in queue');
    }

    await triggerWebhook();
  },

  async snooze(minutes: number): Promise<void> {
    if (!state.firstItemAt) {
      throw new Error('No active batch window');
    }

    const snoozeMs = minutes * 60 * 1000;
    const newScheduledAt = new Date(Date.now() + snoozeMs);

    // Don't allow snooze beyond max window from first item
    const maxScheduledAt = new Date(
      state.firstItemAt.getTime() + MAX_WINDOW_MS
    );

    if (newScheduledAt > maxScheduledAt) {
      throw new Error(
        `Cannot snooze beyond max window (${MAX_WINDOW_MS / 60000} minutes)`
      );
    }

    scheduleCall(snoozeMs);
  },

  clearResolved(): void {
    state.items = state.items.filter((i) => !i.resolvedAt);

    // If all items resolved, reset state
    if (state.items.length === 0) {
      if (state.timerId) {
        clearTimeout(state.timerId);
      }
      state.firstItemAt = null;
      state.currentWindowMs = null;
      state.scheduledCallAt = null;
      state.timerId = null;
    }
  },
};

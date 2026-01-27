// =============================================================================
// Claude Voice Commander - Shared Types
// =============================================================================

// -----------------------------------------------------------------------------
// Session Types
// -----------------------------------------------------------------------------

export type SessionStatus =
  | 'created'      // Session created but Claude not yet running
  | 'running'      // Claude actively working
  | 'idle'         // Claude waiting at prompt, no activity
  | 'waiting_input'// Claude asked a question, waiting for response
  | 'error'        // Claude encountered an error
  | 'stopped'      // User sent Ctrl+C, Claude interrupted
  | 'killed'       // Session terminated completely
  | 'preserved';   // Session state saved after Pi reboot

export interface Session {
  id: string;
  name: string;
  tmuxSession: string;
  projectPath?: string;
  description?: string;
  initialPrompt?: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt?: Date;
  lastOutputPreview?: string;
  errorCount: number;
  isPreserved: boolean;
  metadata: Record<string, unknown>;
}

export interface CreateSessionRequest {
  name: string;
  projectPath?: string;
  description?: string;
  initialPrompt?: string;
}

export interface SessionWithOutput extends Session {
  recentOutput: string;
}

// -----------------------------------------------------------------------------
// Attention Types
// -----------------------------------------------------------------------------

export type AttentionType =
  | 'question'    // Claude asked a question
  | 'error'       // Claude encountered an error
  | 'completion'  // Claude finished a task
  | 'blocking';   // Claude is blocked, needs input to proceed

export type AttentionPriority = 1 | 2 | 3 | 4 | 5;

export const ATTENTION_PRIORITY: Record<AttentionType, AttentionPriority> = {
  error: 5,
  blocking: 4,
  question: 3,
  completion: 1,
} as const;

export const ATTENTION_WINDOWS_MS: Record<AttentionPriority, number> = {
  5: 30 * 1000,      // 30 seconds for errors
  4: 60 * 1000,      // 60 seconds for blocking
  3: 2 * 60 * 1000,  // 2 minutes for questions
  2: 3 * 60 * 1000,  // 3 minutes for minor
  1: 5 * 60 * 1000,  // 5 minutes for completions
} as const;

export const MAX_ATTENTION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes absolute max

export interface AttentionItem {
  id: string;
  sessionId: string;
  sessionName: string;
  type: AttentionType;
  priority: AttentionPriority;
  content: string;
  context: string; // Last 20-50 lines of output for context
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: 'call' | 'sms' | 'dashboard' | 'auto';
  resolutionContent?: string;
  callId?: string;
  batchId?: string;
  metadata: Record<string, unknown>;
}

export interface AttentionQueueState {
  items: AttentionItem[];
  batchWindowStartedAt?: Date;
  currentWindowMs?: number;
  scheduledCallAt?: Date;
}

export interface ResolveAttentionRequest {
  resolvedBy: 'call' | 'sms' | 'dashboard';
  resolutionContent: string;
}

// -----------------------------------------------------------------------------
// Call Types
// -----------------------------------------------------------------------------

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus =
  | 'initiated'   // Call started
  | 'ringing'     // Call ringing
  | 'in-progress' // Call connected
  | 'completed'   // Call ended normally
  | 'voicemail'   // Reached voicemail
  | 'failed'      // Call failed
  | 'no-answer';  // No answer

export interface Call {
  id: string;
  direction: CallDirection;
  telnyxCallControlId?: string;
  telnyxCallLegId?: string;
  status: CallStatus;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  recordingUrl?: string;
  recordingDurationSeconds?: number;
  transcript?: string;
  relatedSessionIds: string[];
  attentionItemsResolved: number;
  callerNumber?: string;
  metadata: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Escalation Types (for notification cascade)
// -----------------------------------------------------------------------------

export type EscalationStatus =
  | 'pending'        // Waiting to start
  | 'calling'        // Call in progress
  | 'voicemail_sent' // Voicemail left
  | 'sms_sent'       // SMS sent
  | 'slack_sent'     // Slack notification sent
  | 'email_sent'     // Email sent
  | 'resolved'       // User responded
  | 'expired';       // No response after all attempts

export interface EscalationState {
  id: string;
  batchId: string;
  status: EscalationStatus;
  attentionItemIds: string[];
  callAttempts: number;
  lastCallAt?: Date;
  nextRetryAt?: Date;
  voicemailAt?: Date;
  smsAt?: Date;
  slackAt?: Date;
  emailAt?: Date;
  resolvedAt?: Date;
  resolvedVia?: 'call' | 'sms' | 'dashboard';
  createdAt: Date;
  updatedAt: Date;
}

// -----------------------------------------------------------------------------
// Notification Types
// -----------------------------------------------------------------------------

export type NotificationChannel = 'sms' | 'slack' | 'email' | 'voicemail';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface Notification {
  id: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipient?: string;
  content: string;
  relatedAttentionItemIds: string[];
  sentAt: Date;
  deliveredAt?: Date;
  resendEmailId?: string;
  metadata: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Audit Log Types
// -----------------------------------------------------------------------------

export type AuditEventType =
  // Session events
  | 'session.created'
  | 'session.started'
  | 'session.stopped'
  | 'session.killed'
  | 'session.resumed'
  | 'session.error'
  // Attention events
  | 'attention.detected'
  | 'attention.batched'
  | 'attention.resolved'
  // Call events
  | 'call.initiated'
  | 'call.answered'
  | 'call.ended'
  | 'call.voicemail'
  | 'call.failed'
  // Message events
  | 'message.sent'
  | 'message.received'
  // Notification events
  | 'notification.sent'
  | 'notification.failed'
  // System events
  | 'system.boot'
  | 'system.shutdown'
  | 'system.error';

export type AuditActor = 'user' | 'system' | 'claude';

export interface AuditLog {
  id: string;
  eventType: AuditEventType;
  sessionId?: string;
  callId?: string;
  actor: AuditActor;
  description: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

// -----------------------------------------------------------------------------
// Decision Types (for Claude context)
// -----------------------------------------------------------------------------

export interface Decision {
  id: string;
  sessionId: string;
  question: string;
  answer: string;
  context?: string;
  createdAt: Date;
}

// -----------------------------------------------------------------------------
// System Configuration Types
// -----------------------------------------------------------------------------

export interface SystemConfig {
  dndEnabled: boolean;
  dndSchedule?: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
  notificationChannels: NotificationChannel[];
  maxSessions: number;
  pollIntervalMs: number;
}

// -----------------------------------------------------------------------------
// Persisted State (local JSON file)
// -----------------------------------------------------------------------------

export interface PersistedState {
  version: number;
  piBootTime: string;
  lastSync: string;
  sessions: Record<string, Session>;
  attentionQueue: AttentionItem[];
  batchWindowStartedAt?: string;
  settings: SystemConfig;
  decisionLog: Decision[];
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  uptime: number;
  sessionCount: number;
  attentionQueueSize: number;
  lastSync?: string;
  version: string;
}

export interface SessionListResponse {
  sessions: Session[];
}

export interface AttentionQueueResponse {
  items: AttentionItem[];
  batchWindowStartedAt?: string;
  currentWindowMs?: number;
  scheduledCallAt?: string;
  timeRemainingMs?: number;
}

// -----------------------------------------------------------------------------
// Webhook Payloads (Pi → n8n)
// -----------------------------------------------------------------------------

export interface AttentionBatchReadyPayload {
  event: 'attention.batch_ready';
  batchId: string;
  items: AttentionItem[];
  triggeredAt: string;
  triggerReason: 'timer_expired' | 'manual' | 'max_window';
}

export interface SystemBootPayload {
  event: 'system.boot';
  bootTime: string;
  sessions: Array<{
    name: string;
    status: SessionStatus;
    lastActivity?: string;
  }>;
}

export interface SessionErrorPayload {
  event: 'session.error';
  sessionId: string;
  sessionName: string;
  error: string;
  context: string;
}

export type PiWebhookPayload =
  | AttentionBatchReadyPayload
  | SystemBootPayload
  | SessionErrorPayload;

// -----------------------------------------------------------------------------
// Telnyx Types (subset used in our code)
// -----------------------------------------------------------------------------

export interface TelnyxCallEvent {
  event_type: string;
  payload: {
    call_control_id: string;
    call_leg_id: string;
    direction?: 'incoming' | 'outgoing';
    from?: string;
    to?: string;
    state?: string;
    speech?: {
      transcript: string;
      confidence: number;
    };
    result?: 'human' | 'machine' | 'not_sure';
    hangup_cause?: string;
    recording_urls?: {
      mp3: string;
      wav: string;
    };
  };
}

// -----------------------------------------------------------------------------
// Intent Classification (Claude API response)
// -----------------------------------------------------------------------------

export type VoiceIntent =
  | 'create_session'
  | 'list_sessions'
  | 'check_status'
  | 'send_message'
  | 'stop_session'
  | 'kill_session'
  | 'resume_session'
  | 'get_errors'
  | 'schedule_callback'
  | 'end_call'
  | 'unknown';

export interface IntentClassification {
  intent: VoiceIntent;
  sessionName?: string;
  message?: string;
  callbackTime?: string;
  confidence: number;
}

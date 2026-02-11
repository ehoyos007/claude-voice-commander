import { Hono } from 'hono';
import { z } from 'zod';
import { sessionManager } from '../services/session-manager';
import { getConfig } from '../lib/config';

const voiceCommandRoutes = new Hono();

// Known repos for quick access
const KNOWN_REPOS: Record<string, string> = {
  'mission control': '~/Developer/clu-mission-control',
  'clu mission control': '~/Developer/clu-mission-control',
  'voice commander': '~/Developer/claude-voice-commander',
  'claude voice commander': '~/Developer/claude-voice-commander',
  'sales coaching': '~/Developer/sales-coaching-ai-v2',
  'transcript analyzer': '~/Developer/sales-transcript-analyzer',
  'transcript ui': '~/Developer/sales-transcript-ui',
  'clu chat': '~/Developer/clu-chat',
  'clu dashboard': '~/Developer/clu-dashboard',
  'life calculator': '~/Developer/fhe-life-calculator',
  'stream crm': '~/Developer/stream-crm',
};

const processCommandSchema = z.object({
  transcript: z.string().min(1),
  intent: z.enum([
    'start_session',
    'check_session', 
    'list_sessions',
    'terminate_session',
    'terminate_all',
    'send_message',
    'status',
    'help',
    'unknown'
  ]).optional(),
  sessionName: z.string().optional(),
  repoName: z.string().optional(),
  message: z.string().optional(),
});

export interface VoiceCommandResult {
  success: boolean;
  responseText: string;
  action: string;
  data?: any;
}

/** POST /voice-commands/process — Process a voice command */
voiceCommandRoutes.post('/process', async (c) => {
  const body = await c.req.json();
  const parsed = processCommandSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
  }

  const { transcript, intent, sessionName, repoName, message } = parsed.data;
  const result = await processVoiceCommand(transcript, intent, sessionName, repoName, message);
  
  return c.json(result);
});

/** GET /voice-commands/repos — List known repos */
voiceCommandRoutes.get('/repos', async (c) => {
  return c.json({ repos: Object.keys(KNOWN_REPOS) });
});

/** Main command processor */
async function processVoiceCommand(
  transcript: string,
  intent?: string,
  sessionName?: string,
  repoName?: string,
  message?: string
): Promise<VoiceCommandResult> {
  
  // If no intent provided, try to infer from transcript
  const detectedIntent = intent || inferIntent(transcript);
  
  switch (detectedIntent) {
    case 'start_session':
      return await handleStartSession(transcript, repoName);
    
    case 'check_session':
      return await handleCheckSession(sessionName || extractSessionName(transcript));
    
    case 'list_sessions':
      return await handleListSessions();
    
    case 'terminate_session':
      return await handleTerminateSession(sessionName || extractSessionName(transcript));
    
    case 'terminate_all':
      return await handleTerminateAll();
    
    case 'send_message':
      return await handleSendMessage(
        sessionName || extractSessionName(transcript),
        message || extractMessage(transcript)
      );
    
    case 'status':
      return await handleStatus();
    
    case 'help':
      return handleHelp();
    
    default:
      return {
        success: false,
        responseText: "I didn't understand that command. You can say: start new session, check on a session, list sessions, terminate a session, or send a message to a session.",
        action: 'unknown',
      };
  }
}

/** Infer intent from transcript */
function inferIntent(transcript: string): string {
  const lower = transcript.toLowerCase();
  
  if (lower.includes('start') && (lower.includes('session') || lower.includes('new'))) {
    return 'start_session';
  }
  if (lower.includes('check') || lower.includes('status of') || lower.includes("how's")) {
    if (lower.includes('all') || lower.includes('sessions')) {
      return 'status';
    }
    return 'check_session';
  }
  if (lower.includes('list') || lower.includes('show') && lower.includes('session')) {
    return 'list_sessions';
  }
  if (lower.includes('terminate') || lower.includes('kill') || lower.includes('stop')) {
    if (lower.includes('all')) {
      return 'terminate_all';
    }
    return 'terminate_session';
  }
  if (lower.includes('tell') || lower.includes('send') || lower.includes('ask')) {
    return 'send_message';
  }
  if (lower.includes('status') || lower.includes('overview')) {
    return 'status';
  }
  if (lower.includes('help') || lower.includes('what can')) {
    return 'help';
  }
  
  return 'unknown';
}

/** Extract session name from transcript */
function extractSessionName(transcript: string): string | undefined {
  // Try to find session name patterns
  const patterns = [
    /(?:check on|status of|how's|terminate|kill|stop|tell)\s+(?:the\s+)?(\w[\w\s-]*?)(?:\s+session)?(?:\s+to|\s*$)/i,
    /session\s+(?:called\s+)?["']?(\w[\w\s-]*)["']?/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) return match[1].trim();
  }
  
  return undefined;
}

/** Extract message from transcript */
function extractMessage(transcript: string): string | undefined {
  const patterns = [
    /(?:tell|ask|send).*?to\s+(?:the\s+)?(?:\w+\s+)?(?:session\s+)?["']?(.+)["']?$/i,
    /message[:\s]+["']?(.+)["']?$/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) return match[1].trim();
  }
  
  return undefined;
}

/** Handle: Start new session */
async function handleStartSession(transcript: string, repoName?: string): Promise<VoiceCommandResult> {
  // Find repo from transcript or provided name
  let projectPath: string | undefined;
  const searchTerm = repoName || transcript.toLowerCase();
  
  for (const [name, path] of Object.entries(KNOWN_REPOS)) {
    if (searchTerm.includes(name)) {
      projectPath = path;
      break;
    }
  }
  
  if (!projectPath) {
    // Default to workspace if no repo specified
    projectPath = '~/.openclaw/workspace';
  }
  
  const sessionName = `voice-${Date.now().toString(36)}`;
  
  try {
    const session = await sessionManager.createSession({
      name: sessionName,
      projectPath: projectPath.replace('~', process.env.HOME || ''),
      description: `Voice-initiated session`,
    });
    
    return {
      success: true,
      responseText: `Started new Claude Code session called ${sessionName} in ${projectPath.split('/').pop()}. The session is now running and ready for commands.`,
      action: 'start_session',
      data: { session },
    };
  } catch (error: any) {
    return {
      success: false,
      responseText: `Failed to start session: ${error.message}`,
      action: 'start_session',
    };
  }
}

/** Handle: Check on session */
async function handleCheckSession(sessionName?: string): Promise<VoiceCommandResult> {
  if (!sessionName) {
    // Get most recent session
    const sessions = await sessionManager.getSessions();
    if (sessions.length === 0) {
      return {
        success: true,
        responseText: "There are no active sessions right now.",
        action: 'check_session',
      };
    }
    sessionName = sessions[0].name;
  }
  
  const sessions = await sessionManager.getSessions();
  const session = sessions.find(s => 
    s.name.toLowerCase().includes(sessionName!.toLowerCase()) ||
    s.id.includes(sessionName!)
  );
  
  if (!session) {
    return {
      success: false,
      responseText: `I couldn't find a session matching "${sessionName}". Say "list sessions" to see all active sessions.`,
      action: 'check_session',
    };
  }
  
  try {
    const output = await sessionManager.getSessionOutput(session.id, 30);
    const lastLines = output.split('\n').slice(-5).join(' ').substring(0, 200);
    
    // Check if Claude is waiting for input
    const isWaiting = output.includes('❯') || output.includes('?') || output.includes('y/n');
    const statusText = isWaiting ? 'waiting for input' : 'working';
    
    return {
      success: true,
      responseText: `Session ${session.name} is ${statusText}. Recent activity: ${lastLines || 'No recent output'}`,
      action: 'check_session',
      data: { session, output },
    };
  } catch (error: any) {
    return {
      success: false,
      responseText: `Session ${session.name} exists but I couldn't get its output: ${error.message}`,
      action: 'check_session',
    };
  }
}

/** Handle: List sessions */
async function handleListSessions(): Promise<VoiceCommandResult> {
  const sessions = await sessionManager.getSessions();
  
  if (sessions.length === 0) {
    return {
      success: true,
      responseText: "There are no active sessions right now. Say 'start new session' to create one.",
      action: 'list_sessions',
      data: { sessions: [] },
    };
  }
  
  const sessionList = sessions.map(s => s.name).join(', ');
  const plural = sessions.length === 1 ? 'session' : 'sessions';
  
  return {
    success: true,
    responseText: `You have ${sessions.length} active ${plural}: ${sessionList}. Say "check on" followed by a session name to get details.`,
    action: 'list_sessions',
    data: { sessions },
  };
}

/** Handle: Terminate session */
async function handleTerminateSession(sessionName?: string): Promise<VoiceCommandResult> {
  if (!sessionName) {
    return {
      success: false,
      responseText: "Which session do you want to terminate? Say the session name.",
      action: 'terminate_session',
    };
  }
  
  const sessions = await sessionManager.getSessions();
  const session = sessions.find(s => 
    s.name.toLowerCase().includes(sessionName.toLowerCase()) ||
    s.id.includes(sessionName)
  );
  
  if (!session) {
    return {
      success: false,
      responseText: `I couldn't find a session matching "${sessionName}".`,
      action: 'terminate_session',
    };
  }
  
  try {
    await sessionManager.killSession(session.id);
    return {
      success: true,
      responseText: `Terminated session ${session.name}.`,
      action: 'terminate_session',
      data: { session },
    };
  } catch (error: any) {
    return {
      success: false,
      responseText: `Failed to terminate session: ${error.message}`,
      action: 'terminate_session',
    };
  }
}

/** Handle: Terminate all sessions */
async function handleTerminateAll(): Promise<VoiceCommandResult> {
  const sessions = await sessionManager.getSessions();
  
  if (sessions.length === 0) {
    return {
      success: true,
      responseText: "There are no active sessions to terminate.",
      action: 'terminate_all',
    };
  }
  
  let terminated = 0;
  for (const session of sessions) {
    try {
      await sessionManager.killSession(session.id);
      terminated++;
    } catch { /* continue */ }
  }
  
  const plural = terminated === 1 ? 'session' : 'sessions';
  return {
    success: true,
    responseText: `Terminated ${terminated} ${plural}.`,
    action: 'terminate_all',
    data: { terminated },
  };
}

/** Handle: Send message to session */
async function handleSendMessage(sessionName?: string, message?: string): Promise<VoiceCommandResult> {
  if (!sessionName) {
    // Use most recent session
    const sessions = await sessionManager.getSessions();
    if (sessions.length === 0) {
      return {
        success: false,
        responseText: "There are no active sessions to send a message to.",
        action: 'send_message',
      };
    }
    sessionName = sessions[0].name;
  }
  
  if (!message) {
    return {
      success: false,
      responseText: "What would you like me to tell the session?",
      action: 'send_message',
    };
  }
  
  const sessions = await sessionManager.getSessions();
  const session = sessions.find(s => 
    s.name.toLowerCase().includes(sessionName!.toLowerCase()) ||
    s.id.includes(sessionName!)
  );
  
  if (!session) {
    return {
      success: false,
      responseText: `I couldn't find a session matching "${sessionName}".`,
      action: 'send_message',
    };
  }
  
  try {
    await sessionManager.sendMessage(session.id, message);
    return {
      success: true,
      responseText: `Sent message to ${session.name}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
      action: 'send_message',
      data: { session, message },
    };
  } catch (error: any) {
    return {
      success: false,
      responseText: `Failed to send message: ${error.message}`,
      action: 'send_message',
    };
  }
}

/** Handle: Status overview */
async function handleStatus(): Promise<VoiceCommandResult> {
  const sessions = await sessionManager.getSessions();
  
  if (sessions.length === 0) {
    return {
      success: true,
      responseText: "All quiet. No active Claude Code sessions running. Say 'start new session' to begin working on a project.",
      action: 'status',
      data: { sessions: [] },
    };
  }
  
  // Get quick status of each session
  const statuses: string[] = [];
  for (const session of sessions.slice(0, 3)) {
    try {
      const output = await sessionManager.getSessionOutput(session.id, 10);
      const isWaiting = output.includes('❯') || output.includes('?');
      statuses.push(`${session.name}: ${isWaiting ? 'waiting' : 'working'}`);
    } catch {
      statuses.push(`${session.name}: unknown`);
    }
  }
  
  const summary = statuses.join('. ');
  const more = sessions.length > 3 ? ` Plus ${sessions.length - 3} more.` : '';
  
  return {
    success: true,
    responseText: `You have ${sessions.length} active sessions. ${summary}.${more}`,
    action: 'status',
    data: { sessions },
  };
}

/** Handle: Help */
function handleHelp(): VoiceCommandResult {
  return {
    success: true,
    responseText: `You can say: Start new session on a project. List all sessions. Check on a specific session. Terminate a session or all sessions. Tell a session to do something. Or ask for status overview.`,
    action: 'help',
  };
}

export { voiceCommandRoutes };

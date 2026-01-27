import { $ } from 'bun';

/**
 * tmux session management utilities using Bun shell
 */

export interface TmuxSession {
  name: string;
  windows: number;
  created: Date;
  attached: boolean;
}

/**
 * List all tmux sessions
 */
export async function listSessions(): Promise<TmuxSession[]> {
  try {
    const result = await $`tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created}|#{session_attached}"`.text();

    return result
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const [name, windows, created, attached] = line.split('|');
        return {
          name: name!,
          windows: parseInt(windows!, 10),
          created: new Date(parseInt(created!, 10) * 1000),
          attached: attached === '1',
        };
      });
  } catch (error) {
    // No sessions exist or tmux not running
    if (error instanceof Error && error.message.includes('no server running')) {
      return [];
    }
    throw error;
  }
}

/**
 * Check if a specific session exists
 */
export async function sessionExists(name: string): Promise<boolean> {
  try {
    await $`tmux has-session -t ${name}`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a new tmux session
 * @param name - Session name
 * @param command - Command to run in the session (optional)
 * @param cwd - Working directory (optional)
 */
export async function createSession(
  name: string,
  command?: string,
  cwd?: string
): Promise<void> {
  if (await sessionExists(name)) {
    throw new Error(`Session '${name}' already exists`);
  }

  const args = ['-d', '-s', name];

  if (cwd) {
    args.push('-c', cwd);
  }

  if (command) {
    args.push(command);
  }

  await $`tmux new-session ${args}`;
}

/**
 * Kill a tmux session
 */
export async function killSession(name: string): Promise<void> {
  if (!(await sessionExists(name))) {
    throw new Error(`Session '${name}' does not exist`);
  }
  await $`tmux kill-session -t ${name}`;
}

/**
 * Send keys to a tmux session
 * @param session - Session name
 * @param keys - Keys to send (will append Enter by default)
 * @param noEnter - If true, don't append Enter key
 */
export async function sendKeys(
  session: string,
  keys: string,
  noEnter = false
): Promise<void> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }

  // Escape special characters for tmux
  const escapedKeys = keys
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$');

  if (noEnter) {
    await $`tmux send-keys -t ${session} "${escapedKeys}"`;
  } else {
    await $`tmux send-keys -t ${session} "${escapedKeys}" Enter`;
  }
}

/**
 * Send Ctrl+C to interrupt a session
 */
export async function sendCtrlC(session: string): Promise<void> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }
  await $`tmux send-keys -t ${session} C-c`;
}

/**
 * Capture the current pane content
 * @param session - Session name
 * @param lines - Number of lines to capture (default: 200)
 * @returns The captured pane content
 */
export async function capturePane(
  session: string,
  lines = 200
): Promise<string> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }

  // Capture from scrollback buffer
  // -p prints to stdout instead of a file
  // -S specifies start line (negative for scrollback)
  const result = await $`tmux capture-pane -t ${session} -p -S -${lines}`.text();
  return result;
}

/**
 * Get the current pane content hash (for detecting changes)
 */
export async function getPaneHash(session: string): Promise<string> {
  const content = await capturePane(session, 50);
  const hasher = new Bun.CryptoHasher('md5');
  hasher.update(content);
  return hasher.digest('hex');
}

/**
 * Set up pipe-pane to log session output to a file
 * @param session - Session name
 * @param logFile - Path to log file
 */
export async function startPipePane(
  session: string,
  logFile: string
): Promise<void> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }
  await $`tmux pipe-pane -t ${session} "cat >> ${logFile}"`;
}

/**
 * Stop pipe-pane logging
 */
export async function stopPipePane(session: string): Promise<void> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }
  await $`tmux pipe-pane -t ${session}`;
}

/**
 * Rename a tmux session
 */
export async function renameSession(
  oldName: string,
  newName: string
): Promise<void> {
  if (!(await sessionExists(oldName))) {
    throw new Error(`Session '${oldName}' does not exist`);
  }
  if (await sessionExists(newName)) {
    throw new Error(`Session '${newName}' already exists`);
  }
  await $`tmux rename-session -t ${oldName} ${newName}`;
}

/**
 * Get session info (windows, attached status, etc.)
 */
export async function getSessionInfo(name: string): Promise<TmuxSession | null> {
  const sessions = await listSessions();
  return sessions.find((s) => s.name === name) || null;
}

/**
 * tmux session management utilities using Bun.spawn
 *
 * Uses Bun.spawn with explicit arg arrays for reliable argument passing.
 */

export interface TmuxSession {
  name: string;
  windows: number;
  created: Date;
  attached: boolean;
}

/** Run a tmux command and return stdout */
async function run(...args: string[]): Promise<string> {
  const proc = Bun.spawn(['tmux', ...args], { stdout: 'pipe', stderr: 'pipe' });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`tmux ${args[0]} failed (exit ${exitCode}): ${stderr.trim()}`);
  }
  return new Response(proc.stdout).text();
}

/** Run a tmux command, ignoring errors (returns success boolean) */
async function tryRun(...args: string[]): Promise<boolean> {
  const proc = Bun.spawn(['tmux', ...args], { stdout: 'ignore', stderr: 'ignore' });
  return (await proc.exited) === 0;
}

export async function listSessions(): Promise<TmuxSession[]> {
  try {
    const result = await run(
      'list-sessions', '-F',
      '#{session_name}|#{session_windows}|#{session_created}|#{session_attached}'
    );
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
  } catch {
    return [];
  }
}

export async function sessionExists(name: string): Promise<boolean> {
  return tryRun('has-session', '-t', name);
}

export async function createSession(
  name: string,
  command?: string,
  cwd?: string
): Promise<void> {
  if (await sessionExists(name)) {
    throw new Error(`Session '${name}' already exists`);
  }

  const args = ['tmux', 'new-session', '-d', '-s', name];
  if (cwd) {
    args.push('-c', cwd);
  }
  if (command) {
    // tmux new-session takes the command as a single trailing argument via shell
    // We need sh -c to handle the full command string with flags
    args.push('sh', '-c', command);
  }

  const proc = Bun.spawn(args, { stdout: 'inherit', stderr: 'pipe' });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`tmux new-session failed (exit ${exitCode}): ${stderr.trim()}`);
  }
}

export async function killSession(name: string): Promise<void> {
  await run('kill-session', '-t', name);
}

export async function sendKeys(
  session: string,
  keys: string,
  noEnter = false
): Promise<void> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }

  // Send text with -l (literal) so tmux doesn't interpret special chars
  const textProc = Bun.spawn(['tmux', 'send-keys', '-t', session, '-l', keys], {
    stdout: 'inherit',
    stderr: 'pipe',
  });
  const textExit = await textProc.exited;
  if (textExit !== 0) {
    const stderr = await new Response(textProc.stderr).text();
    throw new Error(`tmux send-keys (text) failed (exit ${textExit}): ${stderr.trim()}`);
  }

  // Send Enter as a separate command (Enter is a tmux key name, not literal)
  if (!noEnter) {
    const enterProc = Bun.spawn(['tmux', 'send-keys', '-t', session, 'Enter'], {
      stdout: 'inherit',
      stderr: 'pipe',
    });
    await enterProc.exited;
  }
}

export async function sendCtrlC(session: string): Promise<void> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }
  await run('send-keys', '-t', session, 'C-c');
}

export async function capturePane(session: string, lines = 200): Promise<string> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }
  return run('capture-pane', '-t', session, '-p', '-S', `-${lines}`);
}

export async function getPaneHash(session: string): Promise<string> {
  const content = await capturePane(session, 50);
  const hasher = new Bun.CryptoHasher('md5');
  hasher.update(content);
  return hasher.digest('hex');
}

export async function startPipePane(session: string, logFile: string): Promise<void> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }
  await run('pipe-pane', '-t', session, `cat >> ${logFile}`);
}

export async function stopPipePane(session: string): Promise<void> {
  if (!(await sessionExists(session))) {
    throw new Error(`Session '${session}' does not exist`);
  }
  await run('pipe-pane', '-t', session);
}

export async function renameSession(oldName: string, newName: string): Promise<void> {
  if (!(await sessionExists(oldName))) {
    throw new Error(`Session '${oldName}' does not exist`);
  }
  if (await sessionExists(newName)) {
    throw new Error(`Session '${newName}' already exists`);
  }
  await run('rename-session', '-t', oldName, newName);
}

export async function getSessionInfo(name: string): Promise<TmuxSession | null> {
  const sessions = await listSessions();
  return sessions.find((s) => s.name === name) || null;
}

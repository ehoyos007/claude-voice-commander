import { z } from 'zod';

/**
 * Environment configuration schema with validation
 */
const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3000),
  apiKey: z.string().min(1, 'API_KEY is required'),

  // Supabase
  supabaseUrl: z.string().url('SUPABASE_URL must be a valid URL'),
  supabaseKey: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),

  // n8n
  n8nWebhookUrl: z.string().url('N8N_WEBHOOK_URL must be a valid URL'),

  // Paths
  claudePath: z.string().default('~/.local/bin/claude'),
  stateFile: z.string().default('~/.claude-commander/state.json'),

  // Settings
  maxSessions: z.coerce.number().min(1).max(10).default(5),
  pollIntervalMs: z.coerce.number().min(500).max(10000).default(1500),
  allowedCallerNumber: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  const rawConfig = {
    port: process.env.PORT,
    apiKey: process.env.API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY,
    n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
    claudePath: process.env.CLAUDE_PATH,
    stateFile: process.env.STATE_FILE,
    maxSessions: process.env.MAX_SESSIONS,
    pollIntervalMs: process.env.POLL_INTERVAL_MS,
    allowedCallerNumber: process.env.ALLOWED_CALLER_NUMBER,
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Expand ~ to home directory in paths
 */
function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.replace('~', home);
  }
  return path;
}

// Load config on module initialization
let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
    // Expand paths
    _config.claudePath = expandPath(_config.claudePath);
    _config.stateFile = expandPath(_config.stateFile);
  }
  return _config;
}

// For testing - allows resetting config
export function resetConfig(): void {
  _config = null;
}

export const config = getConfig();

import { app } from './server';
import { getConfig } from './lib/config';
import { outputMonitor } from './services/output-monitor';
import { statePersistence } from './services/state-persistence';

const config = getConfig();

console.log('Starting Claude Voice Commander Pi Service...');
console.log(`  Port: ${config.port}`);
console.log(`  Max Sessions: ${config.maxSessions}`);
console.log(`  Poll Interval: ${config.pollIntervalMs}ms`);

// Restore state from previous session (if any)
await statePersistence.restoreState();

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log(`Server running at http://localhost:${server.port}`);

// Start output monitor
outputMonitor.start();

// Auto-save state every 30 seconds
const AUTO_SAVE_INTERVAL_MS = 30_000;
const autoSaveTimer = setInterval(async () => {
  try {
    await statePersistence.saveState();
  } catch (error) {
    console.error('Auto-save failed:', error);
  }
}, AUTO_SAVE_INTERVAL_MS);

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down...');
  clearInterval(autoSaveTimer);
  outputMonitor.stop();
  try {
    await statePersistence.saveState();
    console.log('State saved.');
  } catch (error) {
    console.error('Failed to save state on shutdown:', error);
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import { app } from './server';
import { getConfig } from './lib/config';

// Load config first to validate environment
const config = getConfig();

console.log('Starting Claude Voice Commander Pi Service...');
console.log(`  Port: ${config.port}`);
console.log(`  Max Sessions: ${config.maxSessions}`);
console.log(`  Poll Interval: ${config.pollIntervalMs}ms`);

// Start server
const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log(`Server running at http://localhost:${server.port}`);

// TODO: Start output monitor polling loop
// import { startMonitor } from './services/output-monitor';
// startMonitor();

// TODO: Restore state from persistence
// import { restoreState } from './services/state-persistence';
// await restoreState();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  // TODO: Stop monitor, persist state
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  // TODO: Stop monitor, persist state
  process.exit(0);
});

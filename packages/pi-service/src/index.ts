import { app } from './server';
import { getConfig } from './lib/config';
import { outputMonitor } from './services/output-monitor';

const config = getConfig();

console.log('Starting Claude Voice Commander Pi Service...');
console.log(`  Port: ${config.port}`);
console.log(`  Max Sessions: ${config.maxSessions}`);
console.log(`  Poll Interval: ${config.pollIntervalMs}ms`);

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log(`Server running at http://localhost:${server.port}`);

// Start output monitor
outputMonitor.start();

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down...');
  outputMonitor.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

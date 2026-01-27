# Claude Voice Commander - Development Guide

## Project Overview

This is a voice-controlled system for managing Claude Code sessions on a Raspberry Pi. The system allows users to:
- Call in via phone to start, manage, and monitor coding projects
- Receive calls when Claude needs input or encounters errors
- Track all interactions via a real-time dashboard

## Architecture

### Core Components

1. **Pi Service** (`packages/pi-service/`) - Bun + Hono REST API
   - Manages tmux sessions running Claude Code
   - Monitors output for questions/errors/completions
   - Implements attention queue with tiered batching
   - Persists state locally and syncs to Supabase

2. **n8n Workflows** (`n8n-workflows/`) - Orchestration
   - Handles Telnyx voice webhooks
   - Routes between STT → Claude → TTS → Telnyx
   - Manages notification cascades

3. **Dashboard** (`packages/dashboard/`) - Next.js on Vercel
   - Real-time session output viewing
   - Call history with recording playback
   - Audit log viewer

4. **Shared Types** (`packages/shared/`) - TypeScript definitions
   - All domain types used across packages

### Tech Stack

| Component | Technology |
|-----------|------------|
| Pi Service | Bun + Hono |
| Dashboard | Next.js 14 |
| Database | Supabase (PostgreSQL) |
| Voice | Telnyx Call Control API |
| STT | Telnyx built-in |
| TTS | ElevenLabs |
| Orchestration | n8n |
| Tunnel | Tailscale Funnel |

## Key Design Decisions

### Attention Batching (Tiered Priority)

When Claude needs input, items are queued with priority-based windows:
- **Priority 5 (Error)**: 30 second window
- **Priority 4 (Blocking)**: 60 second window
- **Priority 3 (Question)**: 2 minute window
- **Priority 2 (Minor)**: 3 minute window
- **Priority 1 (Completion)**: 5 minute window

Rules:
- Timer starts on first item, new items don't reset
- Higher priority can shorten window (never extend)
- Maximum absolute window: 5 minutes

### Output Storage (Tiered)

- **Live**: 200 lines from tmux buffer (polled, in-memory)
- **Recent**: 1000 lines in Supabase (rotating)
- **Archive**: tmux pipe-pane to local files (7-day retention)

### State Persistence

Local state in `~/.claude-commander/state.json` survives reboots. On boot:
1. Restore state from file
2. Mark sessions as "preserved"
3. Send notification with session status
4. Sessions require manual resume (not auto-resume)

## Running Locally

```bash
# Install dependencies
npm install

# Start Pi service (from project root)
npm run dev:pi

# Start dashboard (from project root)
npm run dev:dashboard
```

## Testing

### Manual Testing (Pi Service)

```bash
# Health check
curl http://localhost:3000/health

# List sessions
curl -H "X-API-Key: $API_KEY" http://localhost:3000/sessions

# Create session
curl -X POST -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "projectPath": "/tmp/test"}' \
  http://localhost:3000/sessions

# Get attention queue
curl -H "X-API-Key: $API_KEY" http://localhost:3000/attention
```

### tmux Commands Reference

```bash
# List sessions
tmux list-sessions

# Attach to session
tmux attach -t claude-session-name

# View session output
tmux capture-pane -t session-name -p -S -200

# Send keys to session
tmux send-keys -t session-name "message" Enter
```

## Code Style

- Use TypeScript strict mode
- Prefer `async/await` over callbacks
- Use Zod for runtime validation
- Keep functions small and focused
- Add JSDoc comments for public APIs
- Use descriptive variable names

## File Organization

```
packages/pi-service/src/
├── index.ts          # Entry point
├── server.ts         # Hono app setup
├── routes/           # HTTP endpoints
├── services/         # Business logic
├── lib/              # Utilities and clients
└── types/            # Type re-exports
```

## Common Tasks

### Adding a New API Endpoint

1. Create handler in appropriate `routes/*.ts` file
2. Add types to `packages/shared/src/types.ts`
3. Update `server.ts` if new route file

### Adding a New Detection Pattern

1. Edit `docs/PATTERNS.md`
2. Update `packages/pi-service/src/lib/patterns.ts`
3. Test with sample Claude output

### Modifying Voice Prompts

1. Edit `docs/VOICE-PROMPTS.md`
2. Update corresponding n8n workflow nodes

## Debugging

### Pi Service Logs

The service logs structured JSON. Key events:
- `session.created` / `session.killed`
- `attention.detected` / `attention.resolved`
- `output.poll` (with new content detected)

### Telnyx Webhooks

All Telnyx events go through n8n. Check n8n execution logs for:
- `call.initiated` / `call.answered` / `call.hangup`
- `call.gather.ended` (speech transcription)
- `call.machine.detection.ended` (voicemail detection)

### Supabase

Use Supabase dashboard to:
- View table data
- Check Realtime subscriptions
- Monitor edge function logs (if used)

## Important Notes

- Sessions run with `--dangerously-skip-permissions` flag
- Caller ID is the only authentication for voice
- Pi API requires `X-API-Key` header
- Maximum 5 concurrent sessions enforced
- DND mode respects schedule + manual toggle

# Claude Voice Commander

Voice-controlled system for managing Claude Code sessions on a Raspberry Pi. Call in to start, manage, and monitor coding projects. Receive calls when Claude needs input.

## Features

- **Inbound Calls**: Start sessions, check status, send instructions, kill sessions - all via voice
- **Outbound Calls**: Claude calls you when it needs input, encounters errors, or completes tasks
- **Intelligent Batching**: Questions are batched before calling (errors = 30s, questions = 2min)
- **Multi-channel Fallback**: Call → Voicemail → SMS → Slack → Email
- **Real-time Dashboard**: Watch Claude work, review call history, track decisions
- **Persistent State**: Survives Pi reboots, preserves session state

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Phone     │────▶│   Telnyx    │────▶│    n8n      │
│  (You)      │◀────│  (Voice)    │◀────│ (Orchestr.) │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐     ┌──────▼──────┐
                    │  Dashboard  │◀───▶│  Supabase   │
                    │  (Vercel)   │     │    (DB)     │
                    └─────────────┘     └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │ Pi Service  │
                                        │ (Bun+Hono)  │
                                        └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │ tmux + Claude│
                                        │   Sessions  │
                                        └─────────────┘
```

## Quick Start

### Prerequisites

- Raspberry Pi 5 with Claude Code installed
- Tailscale with Funnel enabled
- Accounts: Telnyx, ElevenLabs, Supabase, n8n

### Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/yourusername/claude-voice-commander
   cd claude-voice-commander
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Deploy Supabase schema**
   ```bash
   # In Supabase SQL Editor, run:
   # supabase/migrations/001_initial_schema.sql
   ```

4. **Start Pi service**
   ```bash
   npm run dev:pi
   ```

5. **Enable Tailscale Funnel**
   ```bash
   tailscale funnel --bg 3000
   ```

6. **Import n8n workflows**
   - Import `n8n-workflows/*.json` into your n8n instance
   - Configure credentials (Telnyx, ElevenLabs, Supabase)
   - Update webhook URLs

7. **Test it!**
   - Call your Telnyx number
   - Say "Start a new project called test"

## Project Structure

```
claude-voice-commander/
├── packages/
│   ├── pi-service/     # Bun + Hono API on Raspberry Pi
│   ├── dashboard/      # Next.js dashboard on Vercel
│   └── shared/         # Shared TypeScript types
├── supabase/           # Database migrations
├── n8n-workflows/      # Workflow JSON exports
└── docs/               # Voice prompts, patterns, setup guides
```

## Voice Commands

| Say This | Does This |
|----------|-----------|
| "Start a new project" | Creates tmux session, prompts for name |
| "What's running?" | Lists all active sessions |
| "Check on the API project" | Reports status of specific session |
| "Tell Claude to focus on tests" | Sends instruction to session |
| "Stop the frontend" | Sends Ctrl+C to session |
| "Kill the auth project" | Terminates session completely |
| "That's all for now" | Ends the call |

## Development

```bash
# Run Pi service locally
npm run dev:pi

# Run dashboard locally
npm run dev:dashboard

# Type check all packages
npm run typecheck

# Build all packages
npm run build
```

## Configuration

See `.env.example` for all configuration options.

Key settings:
- `MAX_SESSIONS`: Maximum concurrent tmux sessions (default: 5)
- `POLL_INTERVAL_MS`: Output monitoring interval (default: 1500ms)
- `DND_SCHEDULE`: Do Not Disturb hours (e.g., "23:00-07:00")

## Customization

- **Voice prompts**: Edit `docs/VOICE-PROMPTS.md`
- **Detection patterns**: Edit `docs/PATTERNS.md`
- **n8n workflows**: Modify imported workflows in n8n UI

## License

MIT

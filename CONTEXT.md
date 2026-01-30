# Context — Claude Voice Commander

## Domain

A voice-controlled interface for managing Claude Code sessions running on a Raspberry Pi. Users call a phone number to create, monitor, and interact with autonomous coding sessions. The system calls the user back when Claude needs human input.

## Glossary

| Term | Definition |
|------|-----------|
| **Session** | A tmux window running Claude Code on the Pi |
| **Attention Item** | A detected event (error, question, completion) that may require human input |
| **Attention Queue** | Priority-ordered buffer of attention items awaiting notification |
| **Batch Window** | Time delay before notifying the user, varies by priority (30s–5min) |
| **DND Mode** | Do Not Disturb — suppresses outbound calls during configured hours |
| **Output Monitor** | Polling loop that reads tmux output and runs pattern detection |
| **State Persistence** | Local JSON file + Supabase sync for surviving reboots |
| **Notification Cascade** | Fallback chain: Call → Voicemail → SMS → Slack → Email |

## External Services

| Service | Role | Auth |
|---------|------|------|
| **Telnyx** | Voice calls (Call Control API), SMS, built-in STT | API key + Connection ID |
| **ElevenLabs** | Text-to-speech for outbound voice responses | API key |
| **Supabase** | PostgreSQL DB, Realtime subscriptions, Storage (TTS audio) | URL + anon key |
| **n8n** | Workflow orchestration (webhook → STT → intent → Pi API → TTS → Telnyx) | Self-hosted or cloud |
| **Tailscale Funnel** | Exposes Pi service to the internet securely | Tailscale account |
| **Claude API** | Intent classification in n8n (Haiku model) | Anthropic API key |

## Architecture Constraints

- Pi service must work offline (Supabase sync is best-effort)
- Maximum 5 concurrent tmux sessions
- Output polling interval: 1500ms
- Caller ID is the only voice authentication mechanism
- Sessions use `--dangerously-skip-permissions` flag
- n8n handles all webhook routing; Pi service is a pure REST API

## Database Tables (Supabase)

`sessions`, `attention_items`, `decisions`, `call_logs`, `sms_logs`, `audit_logs`, `dnd_config`, `notification_queue`, `voice_prompts`

Realtime enabled on: `sessions`, `attention_items`, `decisions`, `audit_logs`

## Key File Locations

| Path | Contents |
|------|----------|
| `packages/pi-service/src/` | All Pi service source code |
| `packages/shared/src/types.ts` | Domain types shared across packages |
| `packages/dashboard/` | Next.js dashboard (not yet scaffolded) |
| `n8n-workflows/` | Exported n8n workflow JSON files |
| `docs/PATTERNS.md` | Output detection regex patterns |
| `docs/VOICE-PROMPTS.md` | All spoken text templates |
| `docs/SETUP-PI.md` | Raspberry Pi setup instructions |
| `supabase/migrations/` | Database schema SQL |
| `~/.claude-commander/state.json` | Local persisted state (on Pi) |

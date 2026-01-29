# Progress Log

## Session: January 27, 2026

### What We Did
1. **Detailed requirements interview** - Covered technical stack, UX preferences, edge cases, and development approach
2. **Created implementation plan** - 5-phase roadmap saved to `.claude/plans/validated-inventing-iverson.md`
3. **Scaffolded entire monorepo** - All foundational files created and tested

### Key Decisions Made
| Topic | Decision |
|-------|----------|
| STT | Telnyx built-in (not Deepgram) |
| Voice API | Telnyx Call Control (not TeXML) |
| Pi Service | Bun + Hono |
| Latency target | < 2 seconds |
| Conversation style | Push-to-talk |
| Attention batching | Tiered (30s errors → 5min completions) |
| Fallback priority | Slack DM |
| Reboot behavior | Persist state, manual resume |
| Security | Caller ID only |
| Development | Hybrid (Claude generates core, you customize) |

### Files Created
- **35 files** across monorepo structure
- Full Supabase schema with all tables
- Pi service with working health endpoint
- All TypeScript types defined
- Customizable voice prompts and detection patterns
- n8n workflow placeholders

### Tested & Verified
- `npm install` - Dependencies installed
- `bun run dev` - Server starts on port 3000
- Health endpoint returns status
- API key auth blocks unauthorized requests
- Session creation returns stub response

### Committed
```
e274d16 - init: scaffold Claude Voice Commander monorepo project
```

---

---

## Session: January 29, 2026

### What We Did
1. **Implemented session-manager.ts** — Full tmux session lifecycle (create, send, stop, kill, resume, output capture, reconcile)
2. **Rewrote tmux.ts** — Replaced Bun `$` template literals with `Bun.spawn` for reliable arg passing; added `-l` (literal) flag for sendKeys
3. **Implemented output-monitor.ts** — Polling loop with pattern detection, anti-patterns for Claude Code UI chrome, change detection via hash, deduplication, session status updates
4. **Wired up all routes** — Session routes and attention routes now call real services instead of returning stubs
5. **Fixed attention-queue.ts** — Removed invalid type imports, added logging
6. **Installed tmux** via Homebrew (wasn't on Mac)
7. **Extensive local testing** — E2E: create session → Claude boots → send message → detect errors → attention queue populates → batch timer fires

### Key Fixes
| Issue | Fix |
|-------|-----|
| Bun `$` template literals unreliable with tmux args | Rewrote all tmux functions to use `Bun.spawn` with explicit arg arrays |
| `sendKeys` text not submitted to Claude Code | Split into literal text (`-l` flag) + separate Enter key |
| False positives on Claude UI lines (`❯`, `╭│╰─`) | Added anti-pattern filters for Claude Code chrome |
| `⏺` prefix blocking Claude's output content | Strip `⏺` before pattern matching instead of filtering |
| Attention routes returning stub `[]` | Wired to actual `attentionQueue` service |
| `attention-queue.ts` importing const values as types | Removed `ATTENTION_WINDOWS_MS`, `MAX_ATTENTION_WINDOW_MS` from type import |

### Files Modified
- `packages/pi-service/src/services/session-manager.ts` — Full implementation
- `packages/pi-service/src/services/output-monitor.ts` — Full implementation with anti-patterns
- `packages/pi-service/src/services/attention-queue.ts` — Fixed imports, added logging
- `packages/pi-service/src/lib/tmux.ts` — Complete rewrite (Bun.spawn)
- `packages/pi-service/src/routes/sessions.ts` — Wired to sessionManager
- `packages/pi-service/src/routes/attention.ts` — Wired to attentionQueue
- `packages/pi-service/src/index.ts` — Starts output monitor, graceful shutdown

### Tested & Verified
- Session creation → real tmux + Claude Code running
- `GET /sessions` lists real sessions
- `POST /sessions/:id/send` delivers messages to Claude
- `POST /sessions/:id/stop` sends Ctrl+C
- `POST /sessions/:id/kill` destroys tmux session
- `GET /sessions/:id/output` captures terminal content
- Archive logging to `~/.claude-commander/archives/`
- Duplicate session name rejection
- Output monitor: no false positives on Claude welcome screen
- Output monitor: detects `Error:` patterns as priority 5
- Attention queue: items populated with context, batch timer fires
- Anti-patterns: `❯` prompt lines, UI borders, status bar all filtered

---

## Session: January 29, 2026 (Evening)

### What We Did
1. **Wired state-persistence into app lifecycle** — restoreState on boot, auto-save every 30s, saveState on shutdown
2. **Created Supabase project** — `claude-voice-commander` (msqhstkdltiabqntjyqh) in us-east-1
3. **Deployed full schema** — 9 tables, indexes, triggers, Realtime enabled on 4 tables
4. **Connected Pi service to Supabase** — Best-effort sync for sessions, decisions, audit logs
5. **Tested Supabase connection** — Boot audit log + session sync verified end-to-end
6. **Created `tts-audio` Supabase Storage bucket** — Public bucket for ElevenLabs mp3 files
7. **Built 01-inbound-call.json** — Complete 30-node n8n workflow with full conversation loop

### Key Decisions
| Topic | Decision |
|-------|----------|
| TTS | ElevenLabs (not Telnyx built-in) |
| STT | Telnyx built-in gather |
| Audio hosting | Supabase Storage public bucket |
| Call state | Telnyx client_state (base64 JSON) |
| Intent model | Claude 3.5 Haiku |
| Supabase sync | Best-effort, fire-and-forget (won't block local ops) |

### Files Modified
- `packages/pi-service/src/index.ts` — State persistence lifecycle
- `packages/pi-service/src/services/state-persistence.ts` — Supabase sync, mkdir fix
- `packages/pi-service/.env` — Real Supabase credentials
- `n8n-workflows/01-inbound-call.json` — Full workflow (933 lines)
- `TASKS.md` — Updated progress

### Commits
```
d880730 - feat: wire state persistence and connect Supabase
a62629a - feat: build inbound call n8n workflow with full conversation loop
```

---

## Next Session

### Immediate Next Steps
1. Set up n8n instance (self-hosted or cloud)
2. Import workflow, configure credentials (Telnyx, ElevenLabs, Anthropic)
3. Set up Telnyx account + phone number + Call Control connection
4. Set up Tailscale Funnel on Pi
5. Test inbound call flow end-to-end

### Phase 1 Remaining Work
- [ ] Set up n8n instance
- [ ] Configure Telnyx account + credentials
- [ ] Configure ElevenLabs credentials
- [ ] Configure Anthropic API key in n8n
- [ ] Set up Tailscale Funnel on Pi
- [ ] Test inbound call flow
- [ ] End-to-end: call in → create session

### Commands to Resume
```bash
cd /Users/enzohoyos/Projects/claude-pi/call-me/claude-voice-commander
npm run dev:pi
```

### Reference Files
- Plan: `.claude/plans/validated-inventing-iverson.md`
- Workflow plan: `.claude/plans/melodic-swimming-wren.md`
- Voice prompts: `docs/VOICE-PROMPTS.md`
- Detection patterns: `docs/PATTERNS.md`
- Pi setup: `docs/SETUP-PI.md`

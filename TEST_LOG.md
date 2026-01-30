# Test Log

## Manual Tests Performed

### January 29, 2026 — Pi Service Core

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | `GET /health` returns 200 | PASS | |
| 2 | Unauthenticated request returns 401 | PASS | |
| 3 | `POST /sessions` creates tmux session + Claude Code | PASS | |
| 4 | `GET /sessions` lists real sessions | PASS | |
| 5 | `POST /sessions/:id/send` delivers message to Claude | PASS | Required `-l` flag fix |
| 6 | `POST /sessions/:id/stop` sends Ctrl+C | PASS | |
| 7 | `POST /sessions/:id/kill` destroys tmux session | PASS | |
| 8 | `GET /sessions/:id/output` captures terminal content | PASS | |
| 9 | Duplicate session name rejected | PASS | |
| 10 | Output monitor: no false positives on Claude welcome screen | PASS | Anti-patterns added |
| 11 | Output monitor: detects `Error:` as priority 5 | PASS | |
| 12 | Attention queue: items populated with context | PASS | |
| 13 | Attention queue: batch timer fires | PASS | |
| 14 | Archive logging to `~/.claude-commander/archives/` | PASS | |
| 15 | State persistence: boot restore + Supabase sync | PASS | |
| 16 | Supabase: audit log written on boot | PASS | |

---

## Known Issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Bun `$` template literals unreliable with tmux args | High | FIXED — rewrote with Bun.spawn |
| 2 | `sendKeys` text not submitted without `-l` flag | High | FIXED |
| 3 | Claude UI chrome lines caused false positive detections | Medium | FIXED — anti-patterns added |

---

## Test Coverage Gaps

- [ ] End-to-end: inbound call → session creation (needs Telnyx + n8n)
- [ ] Outbound call flow (not yet implemented)
- [ ] SMS fallback (not yet implemented)
- [ ] Dashboard Realtime subscriptions
- [ ] DND mode enforcement
- [ ] Concurrent session limit (5 max)
- [ ] Reboot recovery with real Pi

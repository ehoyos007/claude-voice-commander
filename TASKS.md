# Tasks

## Phase 1: Foundation (Current)

### Infrastructure
- [x] Scaffold monorepo structure
- [x] Create shared types package
- [x] Create Pi service scaffold
- [x] Create Supabase schema
- [x] Create Supabase project
- [x] Deploy schema to Supabase
- [ ] Set up Tailscale Funnel on Pi

### Pi Service Implementation
- [x] Health endpoint
- [x] Session routes (wired to session manager)
- [x] Attention routes (wired to attention queue)
- [x] tmux.ts wrappers (rewritten with Bun.spawn)
- [x] config.ts validation
- [x] Implement session-manager.ts (create tmux sessions with Claude)
- [x] Implement output-monitor.ts (polling loop + pattern detection)
- [x] Implement state-persistence.ts (local JSON + Supabase sync)
- [x] Connect to Supabase (sessions, decisions, audit logs)

### n8n Workflows
- [x] Build 01-inbound-call workflow (30 nodes, full conversation loop)
- [ ] Configure Telnyx credentials (need account + phone number)
- [ ] Configure ElevenLabs credentials
- [ ] Configure Claude API for intent classification
- [ ] Set up n8n instance
- [ ] Test inbound call flow

### Testing
- [x] Health endpoint works
- [x] Auth middleware works
- [x] tmux session creation works
- [x] sendKeys delivers messages to Claude Code
- [x] Output monitor detects errors (p5) with no false positives
- [x] Attention queue populates + batch timer fires
- [ ] End-to-end: call → create session

---

## Phase 2: Outbound Calls (Upcoming)

- [ ] Implement attention-queue.ts batching logic
- [ ] Pattern detection in output-monitor.ts
- [ ] Build 02-outbound-call workflow
- [ ] Voicemail detection
- [ ] SMS fallback (03-sms-handler)
- [ ] Response routing

---

## Phase 3: Persistence & Notifications

- [x] Local state persistence
- [x] Reboot detection
- [ ] Slack notifications
- [ ] Resend email integration
- [ ] DND mode

---

## Phase 4: Dashboard

- [ ] Scaffold Next.js with create-next-app
- [ ] Session overview page
- [ ] Live terminal viewer
- [ ] Call history with playback
- [ ] Supabase Realtime integration

---

## Phase 5: Polish

- [ ] End-to-end testing
- [ ] Error handling
- [ ] Voice prompt refinement
- [ ] Documentation updates

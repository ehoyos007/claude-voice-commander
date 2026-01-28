# Tasks

## Phase 1: Foundation (Current)

### Infrastructure
- [x] Scaffold monorepo structure
- [x] Create shared types package
- [x] Create Pi service scaffold
- [x] Create Supabase schema
- [ ] Create Supabase project
- [ ] Deploy schema to Supabase
- [ ] Set up Tailscale Funnel on Pi

### Pi Service Implementation
- [x] Health endpoint
- [x] Session routes (stubs)
- [x] Attention routes (stubs)
- [x] tmux.ts wrappers
- [x] config.ts validation
- [ ] Implement session-manager.ts (create tmux sessions with Claude)
- [ ] Implement output-monitor.ts (polling loop)
- [ ] Implement state-persistence.ts (local JSON)
- [ ] Connect to Supabase

### n8n Workflows
- [ ] Build 01-inbound-call workflow
- [ ] Configure Telnyx credentials
- [ ] Configure ElevenLabs credentials
- [ ] Configure Claude API for intent classification
- [ ] Test inbound call flow

### Testing
- [x] Health endpoint works
- [x] Auth middleware works
- [ ] tmux session creation works
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

- [ ] Local state persistence
- [ ] Reboot detection
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

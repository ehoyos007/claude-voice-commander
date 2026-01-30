# n8n Workflow Manual Build Guide

Since JSON import is failing, use this guide to recreate each workflow manually in n8n.

---

## Credentials to Create First

Before building any workflows, create these credentials in **Settings > Credentials**:

| Name | Type | Key Header | Value |
|------|------|------------|-------|
| **Telnyx API** | Header Auth | `Authorization` | `Bearer YOUR_TELNYX_API_KEY` |
| **ElevenLabs API** | Header Auth | `xi-api-key` | `YOUR_ELEVENLABS_API_KEY` |
| **Anthropic API** | Header Auth | `x-api-key` | `sk-ant-YOUR_KEY` |
| **Supabase Service Key** | Header Auth | `Authorization` | `Bearer YOUR_SUPABASE_SERVICE_KEY` (also add `apikey` header with same value) |
| **Pi Service API** | Header Auth | `X-API-Key` | `YOUR_PI_API_KEY` |

All credentials use the **Header Auth** generic credential type in n8n.

---

## Workflow 01: Inbound Call Handler

### Goal

Handle incoming phone calls to the Telnyx number. The user calls in, speaks a command, Claude classifies the intent, the Pi service executes it, and a spoken response is played back. This loops until the user says goodbye.

### Flow Diagram

```
Telnyx webhook → Respond 200 → Route Event Type
                                 ├─ call.initiated → Answer Call
                                 ├─ call.answered → Check Attention → Build Greeting → TTS → Upload → Play
                                 ├─ call.gather.ended → Extract State → Has Speech?
                                 │                                        ├─ Yes → Build Prompt → Claude Classify → Parse Intent → Route Intent
                                 │                                        │                                                         ├─ create_session → Pi API → Build Response ─┐
                                 │                                        │                                                         ├─ list_sessions  → Pi API → Build Response ─┤
                                 │                                        │                                                         ├─ check_status   → Pi API → Build Response ─┤
                                 │                                        │                                                         ├─ send_message   → Pi API → Build Response ─┤
                                 │                                        │                                                         ├─ stop_session   → Pi API → Build Response ─┤
                                 │                                        │                                                         ├─ kill_session   → Pi API → Build Response ─┤
                                 │                                        │                                                         ├─ resume_session → Pi API → Build Response ─┤
                                 │                                        │                                                         ├─ get_errors     → Pi API → Build Response ─┤
                                 │                                        │                                                         ├─ end_call       → Build Goodbye → TTS → Upload → Play → Hangup
                                 │                                        │                                                         └─ unknown        → Build Response ─────────┤
                                 │                                        │                                                                                                     │
                                 │                                        │                                               Build Response → TTS → Upload Audio → Play Response ──┘
                                 │                                        └─ No (timeout) → Handle Timeout → TTS → Upload → Play
                                 ├─ call.playback.ended → Gather Speech (loop back to listen)
                                 └─ call.hangup → Prepare Call Log → Supabase Log
```

### Nodes (build in this order)

---

#### Node 1: Telnyx Voice Webhook
- **Type:** Webhook
- **Method:** POST
- **Path:** `telnyx-voice`
- **Response Mode:** Using "Respond to Webhook" node

This is the entry point. Telnyx sends all call events here.

---

#### Node 2: Respond 200
- **Type:** Respond to Webhook
- **Respond With:** JSON
- **Response Body:** `{}`

Immediately returns 200 to Telnyx (required — Telnyx times out otherwise).

**Connection:** Webhook → Respond 200

---

#### Node 3: Route Event Type
- **Type:** Switch
- **Routing Field:** `{{ $json.data.event_type }}`
- **Outputs (5 branches + fallback):**

| Output | Condition | Connects To |
|--------|-----------|-------------|
| 0 | `event_type` equals `call.initiated` | Answer Call |
| 1 | `event_type` equals `call.answered` | Check Attention Queue |
| 2 | `event_type` equals `call.gather.ended` | Extract State & Transcript |
| 3 | `event_type` equals `call.playback.ended` | Gather Speech |
| 4 | `event_type` equals `call.hangup` | Prepare Call Log |
| fallback | anything else | (nothing) |

**Connection:** Respond 200 → Route Event Type

---

#### Node 4: Telnyx — Answer Call
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://api.telnyx.com/v2/calls/{{ $json.data.payload.call_control_id }}/actions/answer`
- **Auth:** Telnyx API credential
- **Body (JSON):**
```json
{
  "client_state": "{{ Buffer.from(JSON.stringify({history:[],lastIntent:null,sessionContext:{},turnCount:0})).toString('base64') }}"
}
```

Answers the incoming call and initializes conversation state as base64-encoded `client_state`.

**Connection:** Route Event Type (output 0) → Answer Call

---

#### Node 5: Pi — Check Attention Queue
- **Type:** HTTP Request
- **Method:** GET
- **URL:** `http://YOUR_PI_URL:3000/attention`
- **Auth:** Pi Service API credential

Checks if there are pending attention items to mention in the greeting.

**Connection:** Route Event Type (output 1) → Check Attention Queue

---

#### Node 6: Build Greeting (Code)
- **Type:** Code (JavaScript)
- **Purpose:** Builds a greeting string based on pending attention items count.
- **Logic:**
  - If pending items > 0: "Hey! I've got N things waiting for you. Want to handle those first, or start something new?"
  - If pending items == 0: "Hey! What would you like to work on?"
- **Outputs:** `greeting`, `callControlId`, `clientState` (base64), `pendingCount`
- **Key references:** Gets `call_control_id` from `$('Telnyx Voice Webhook').first().json`

**Connection:** Check Attention Queue → Build Greeting

---

#### Node 7: ElevenLabs — Greeting TTS
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://api.elevenlabs.io/v1/text-to-speech/3sfGn775ryaDXhFWHwBg`
- **Auth:** ElevenLabs API credential
- **Body (JSON):**
```json
{
  "text": "<the greeting text>",
  "model_id": "eleven_turbo_v2",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```
- **Response:** Set to **File** format, output property name: `audioData`

Replace `3sfGn775ryaDXhFWHwBg` with your chosen ElevenLabs voice ID.

**Connection:** Build Greeting → ElevenLabs Greeting TTS

---

#### Node 8: Supabase — Upload Greeting Audio
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://YOUR_SUPABASE_URL/storage/v1/object/tts-audio/CALL_CONTROL_ID-greeting.mp3`
- **Auth:** Supabase Service Key credential
- **Body:** Binary data from `audioData` field
- **Extra Header:** `Content-Type: audio/mpeg`

Requires a Supabase Storage bucket called `tts-audio` (create it as public in Supabase dashboard).

**Connection:** ElevenLabs Greeting TTS → Upload Greeting Audio

---

#### Node 9: Telnyx — Play Greeting
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://api.telnyx.com/v2/calls/CALL_CONTROL_ID/actions/playback_start`
- **Auth:** Telnyx API credential
- **Body (JSON):**
```json
{
  "audio_url": "https://YOUR_SUPABASE_URL/storage/v1/object/public/tts-audio/CALL_CONTROL_ID-greeting.mp3",
  "client_state": "<base64 state>"
}
```

Plays the greeting audio to the caller. When playback finishes, Telnyx sends `call.playback.ended` event back to the webhook.

**Connection:** Upload Greeting Audio → Play Greeting

---

#### Node 10: Telnyx — Gather Speech
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://api.telnyx.com/v2/calls/{{ $json.data.payload.call_control_id }}/actions/gather`
- **Auth:** Telnyx API credential
- **Body (JSON):**
```json
{
  "type": "speech",
  "language": "en-US",
  "speech_model": "default",
  "end_silence_timeout_millis": 1500,
  "timeout_millis": 15000,
  "client_state": "{{ $json.data.payload.client_state }}"
}
```

Starts listening for user speech. Passes through `client_state` from the previous event. When speech ends (or times out), Telnyx sends `call.gather.ended` back to the webhook.

**Connection:** Route Event Type (output 3 — `call.playback.ended`) → Gather Speech

---

#### Node 11: Extract State & Transcript (Code)
- **Type:** Code (JavaScript)
- **Purpose:** Decodes `client_state` from base64, extracts the speech transcript, detects timeouts, appends to conversation history.
- **Inputs from:** `$('Telnyx Voice Webhook').first().json.data.payload`
- **Key fields:**
  - `payload.client_state` → base64 decode to get `state` object (history, lastIntent, sessionContext, turnCount)
  - `payload.speech.transcript` → the user's spoken text
  - `payload.speech.confidence` → STT confidence score
- **Timeout detection:** If transcript is empty/blank, set `timedOut = true`
- **History:** Appends `{ role: 'user', content: transcript }`, keeps last 10 turns
- **Outputs:** `callControlId`, `transcript`, `speechConfidence`, `timedOut`, `state`, `turnCount`

**Connection:** Route Event Type (output 2 — `call.gather.ended`) → Extract State & Transcript

---

#### Node 12: Has Speech? (Switch)
- **Type:** Switch
- **Condition:** `{{ $json.timedOut }}`
- **Output 0:** `timedOut == false` → Build Intent Prompt (has speech)
- **Output 1:** `timedOut == true` → Handle Timeout

**Connection:** Extract State → Has Speech?

---

#### Node 13: Handle Timeout (Code)
- **Type:** Code (JavaScript)
- **Logic:**
  - Increments `consecutiveTimeouts` counter
  - If 2+ consecutive timeouts: text = "I'll let you go for now. Call back when you're ready!" + set `shouldHangup = true`
  - Otherwise: text = "Still there? I didn't hear anything."
- **Outputs:** `callControlId`, `text`, `shouldHangup`, `state`, `clientState`

The timeout response feeds into the same TTS → Upload → Play pipeline as normal responses.

**Connection:** Has Speech? (output 1) → Handle Timeout → ElevenLabs Response TTS

---

#### Node 14: Build Intent Prompt (Code)
- **Type:** Code (JavaScript)
- **Purpose:** Constructs the system prompt and user message for Claude intent classification.
- **System prompt defines these intents:**
  - `create_session` — Start a new coding project
  - `list_sessions` — See running sessions
  - `check_status` — Status of specific session
  - `send_message` — Send instruction to running session
  - `stop_session` — Ctrl+C a session
  - `kill_session` — Terminate a session
  - `resume_session` — Resume a preserved session
  - `get_errors` — Check attention/error items
  - `schedule_callback` — Request a callback
  - `end_call` — Hang up
  - `unknown` — Can't determine
- **Extracted fields:** `sessionName`, `message`, `callbackTime`
- **User message** includes conversation history (if any) + current transcript
- **Outputs:** `systemPrompt`, `userMessage`, `callControlId`, `transcript`, `state`

**Connection:** Has Speech? (output 0) → Build Intent Prompt

---

#### Node 15: Claude — Classify Intent
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://api.anthropic.com/v1/messages`
- **Auth:** Anthropic API credential
- **Extra Header:** `anthropic-version: 2023-06-01`
- **Body (JSON):**
```json
{
  "model": "claude-3-5-haiku-latest",
  "max_tokens": 300,
  "system": "<system prompt from previous node>",
  "messages": [
    { "role": "user", "content": "<user message from previous node>" }
  ]
}
```

Returns JSON with `intent`, `sessionName`, `message`, `callbackTime`.

**Connection:** Build Intent Prompt → Claude Classify Intent

---

#### Node 16: Parse Intent (Code)
- **Type:** Code (JavaScript)
- **Purpose:** Parses Claude's JSON response. Extracts `intent`, `sessionName`, `message`, `callbackTime`. Falls back to `unknown` on parse errors.
- **Outputs:** `intent`, `sessionName`, `message`, `callbackTime`, `confidence`, `callControlId`, `transcript`, `state`

**Connection:** Claude Classify Intent → Parse Intent

---

#### Node 17: Route Intent (Switch)
- **Type:** Switch
- **Routing Field:** `{{ $json.intent }}`
- **Outputs (9 branches + fallback):**

| Output | Intent | Connects To |
|--------|--------|-------------|
| 0 | `create_session` | Pi: Create Session |
| 1 | `list_sessions` | Pi: List Sessions |
| 2 | `check_status` | Pi: Check Status |
| 3 | `send_message` | Pi: Send Message |
| 4 | `stop_session` | Pi: Stop Session |
| 5 | `kill_session` | Pi: Kill Session |
| 6 | `resume_session` | Pi: Resume Session |
| 7 | `get_errors` | Pi: Get Attention Queue |
| 8 | `end_call` | Build Goodbye |
| fallback | unknown | Build Response |

**Connection:** Parse Intent → Route Intent

---

#### Nodes 18–25: Pi Service API Calls

All use HTTP Request type, Pi Service API credential, and the Pi service base URL.

| Node | Method | Endpoint | Body |
|------|--------|----------|------|
| **Pi: Create Session** | POST | `/sessions` | `{ "name": sessionName, "initialPrompt": message }` |
| **Pi: List Sessions** | GET | `/sessions` | — |
| **Pi: Check Status** | GET | `/sessions/:sessionId` | — |
| **Pi: Send Message** | POST | `/sessions/:sessionId/send` | `{ "message": "..." }` |
| **Pi: Stop Session** | POST | `/sessions/:sessionId/stop` | — |
| **Pi: Kill Session** | POST | `/sessions/:sessionId/kill` | — |
| **Pi: Resume Session** | POST | `/sessions/:sessionId/resume` | — |
| **Pi: Get Attention Queue** | GET | `/attention` | — |

All set **Never Error** = true (so the workflow continues even on 4xx/5xx).

Session ID comes from `$('Parse Intent').item.json.state.sessionContext.sessionId`.

**Connection:** Each Pi node → Build Response

---

#### Node 26: Build Response (Code)
- **Type:** Code (JavaScript)
- **Purpose:** Takes the Pi API result + the intent and constructs a natural language response.
- **Response examples by intent:**
  - `create_session` → "Got it, my-project is up and running. What should Claude work on first?"
  - `list_sessions` → "You've got 2 sessions running. my-app is actively working. api-server is idle."
  - `send_message` → "Done, I've passed that along to my-project."
  - `get_errors` → "You've got 3 items needing attention. Error on my-app: ..."
  - `unknown` → "Sorry, I didn't quite catch that. Could you say it again?"
- **State update:** Appends assistant response to history, resets `consecutiveTimeouts`, updates `sessionContext`
- **Outputs:** `responseText`, `callControlId`, `state`, `clientState` (base64), `intent`

**Connection:** All Pi API nodes → Build Response

---

#### Node 27: ElevenLabs — Response TTS
- **Type:** HTTP Request (same config as Greeting TTS)
- **URL:** `https://api.elevenlabs.io/v1/text-to-speech/3sfGn775ryaDXhFWHwBg`
- **Body text:** `$json.responseText`
- **Response:** File format → `audioData`

**Connection:** Build Response → ElevenLabs Response TTS | Handle Timeout → ElevenLabs Response TTS

---

#### Node 28: Supabase — Upload Response Audio
- **Type:** HTTP Request
- **URL:** `https://YOUR_SUPABASE_URL/storage/v1/object/tts-audio/CALL_CONTROL_ID-TIMESTAMP.mp3`
- **Body:** Binary `audioData`
- **Header:** `Content-Type: audio/mpeg`

**Connection:** ElevenLabs Response TTS → Upload Response Audio

---

#### Node 29: Telnyx — Play Response
- **Type:** HTTP Request
- **URL:** `https://api.telnyx.com/v2/calls/CALL_CONTROL_ID/actions/playback_start`
- **Body:** `{ "audio_url": "...", "client_state": "..." }`

When playback finishes, Telnyx fires `call.playback.ended` → loops back to Gather Speech (node 10).

**Connection:** Upload Response Audio → Play Response

---

#### Node 30: Build Goodbye (Code)
- **Type:** Code (JavaScript)
- **Logic:** If active sessions exist: "Alright, Claude's on it. I'll call if anything else comes up!" Otherwise: "Talk soon!"
- **Outputs:** `responseText`, `callControlId`, `state`, `clientState`

**Connection:** Route Intent (output 8 — `end_call`) → Build Goodbye

---

#### Nodes 31–34: Goodbye Pipeline

Same pattern as the response pipeline:

1. **ElevenLabs: Goodbye TTS** — generates goodbye audio
2. **Supabase: Upload Goodbye Audio** — uploads to storage
3. **Telnyx: Play Goodbye** — plays to caller
4. **Telnyx: Hangup After Goodbye** — POST to `.../actions/hangup`

**Connection chain:** Build Goodbye → TTS → Upload → Play → Hangup

---

#### Node 35: Prepare Call Log (Code)
- **Type:** Code (JavaScript)
- **Purpose:** Extracts call metadata for logging (direction, call IDs, caller number, hangup cause).

**Connection:** Route Event Type (output 4 — `call.hangup`) → Prepare Call Log

---

#### Node 36: Supabase — Log Call
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://YOUR_SUPABASE_URL/rest/v1/calls`
- **Auth:** Supabase Service Key
- **Extra Header:** `Prefer: return=minimal`
- **Body:** The call log JSON from previous node

**Connection:** Prepare Call Log → Supabase Log Call

---

## Workflow 02: Outbound Call Handler (Placeholder)

### Goal

When the Pi service detects attention items (errors, questions, completions) that need user input, it POSTs to this webhook. The workflow initiates an outbound call to the user, presents the items via TTS, and gathers responses.

### Trigger
- **Webhook:** POST `/pi-events`
- **Source:** Pi service posts `attention.batch_ready` and `system.boot` events

### Planned Flow (Not Yet Implemented)
1. Receive event from Pi service
2. Route by event type
3. Initiate outbound Telnyx call to the user's number
4. Answering Machine Detection (AMD)
   - **Human:** Iterate attention items, ElevenLabs TTS for each, gather speech responses
   - **Machine:** Leave voicemail summary, send SMS with details, schedule retry
5. Verify response clarity with Claude API
6. Route responses back to Pi API (`POST /attention/:id/resolve`)
7. On failure, trigger Workflow 04 (notification fallback)

---

## Workflow 03: SMS Handler (Placeholder)

### Goal

Handle inbound SMS messages from the user's phone. Allows quick text-based responses to attention items without calling.

### Trigger
- **Webhook:** POST `/telnyx-sms`
- **Source:** Telnyx messaging webhook

### Planned Flow (Not Yet Implemented)
1. Parse incoming SMS body
2. Match to pending attention items (by reference code or context)
3. Route response to Pi API
4. Send confirmation SMS back to user
5. Update attention item as resolved in Supabase

---

## Workflow 04: Notification Fallback (Placeholder)

### Goal

When phone calls and SMS fail to reach the user, fall back to other channels.

### Trigger
- **Webhook:** POST `/notification-fallback`
- **Source:** Workflow 02 triggers this on call failure

### Planned Flow (Not Yet Implemented)
1. Send Slack DM notification with attention item summary
2. Send email via Resend API
3. Log notification status in Supabase `notifications` table
4. Handle delivery failures and retry

---

## Supabase Storage Setup

Workflow 01 stores TTS audio files in Supabase Storage. You need to:

1. Go to Supabase Dashboard > Storage
2. Create a bucket called **`tts-audio`**
3. Set it to **Public** (Telnyx needs to fetch the audio URL)
4. The bucket will accumulate audio files — consider adding a lifecycle policy or cleanup cron

---

## Key Constants

| Constant | Value | Used In |
|----------|-------|---------|
| ElevenLabs Voice ID | `3sfGn775ryaDXhFWHwBg` | All TTS nodes |
| ElevenLabs Model | `eleven_turbo_v2` | All TTS nodes |
| Claude Model | `claude-3-5-haiku-latest` | Intent classification |
| Speech silence timeout | 1500ms | Gather Speech |
| Speech total timeout | 15000ms | Gather Speech |
| Max conversation history | 10 turns | Extract State code |
| Consecutive timeout limit | 2 | Handle Timeout code |

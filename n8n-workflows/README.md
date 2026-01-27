# n8n Workflows

This directory contains n8n workflow exports for Claude Voice Commander.

## Workflows

| File | Purpose | Trigger |
|------|---------|---------|
| `01-inbound-call.json` | Handle incoming phone calls | Telnyx webhook |
| `02-outbound-call.json` | Call user with attention items | Pi webhook |
| `03-sms-handler.json` | Handle SMS responses | Telnyx webhook |
| `04-notification-fallback.json` | Send Slack/email notifications | Pi webhook |

## Import Instructions

1. Open your n8n instance
2. Go to **Workflows** → **Import from File**
3. Select the JSON file
4. Update credentials:
   - Telnyx API credentials
   - ElevenLabs API credentials
   - Supabase credentials
   - Claude API credentials
   - Slack webhook URL
   - Resend API credentials
5. Update webhook URLs to match your n8n instance
6. Activate the workflow

## Required Credentials

### Telnyx
- API Key (`KEY_xxx`)
- Connection ID (for Call Control)
- Phone Number

### ElevenLabs
- API Key
- Voice ID: `3sfGn775ryaDXhFWHwBg`

### Claude API
- API Key (`sk-ant-xxx`)

### Supabase
- Project URL
- Service Key

### Slack
- Webhook URL for notifications

### Resend
- API Key (`re_xxx`)
- From email address

## Webhook URLs

After importing, note these webhook URLs from n8n:

| Workflow | URL Pattern |
|----------|-------------|
| Inbound Call | `https://your-n8n.com/webhook/telnyx-voice` |
| SMS Handler | `https://your-n8n.com/webhook/telnyx-sms` |
| Pi Events | `https://your-n8n.com/webhook/pi-events` |

Configure these in:
1. **Telnyx Portal** → Voice Connection → Webhook URL
2. **Telnyx Portal** → Messaging Profile → Webhook URL
3. **Pi Service** `.env` → `N8N_WEBHOOK_URL`

## Workflow Architecture

```
INBOUND CALL FLOW:
Phone call → Telnyx → n8n (01-inbound-call)
                        ↓
                    Answer + Record
                        ↓
                    Gather Speech (Telnyx STT)
                        ↓
                    Claude API (intent classification)
                        ↓
                    Route to Pi API
                        ↓
                    Generate response (ElevenLabs TTS)
                        ↓
                    Play audio (Telnyx)
                        ↓
                    Loop or Hangup

OUTBOUND CALL FLOW:
Pi detects attention → POST to n8n (02-outbound-call)
                        ↓
                    Initiate call (Telnyx)
                        ↓
                    AMD check (human/machine)
                        ↓
                    Human: Present items, gather responses
                    Machine: Leave voicemail, send SMS
                        ↓
                    Route responses to Pi
                        ↓
                    Fallback: Slack/email (04-notification-fallback)
```

## Customization

### Voice Prompts
Edit the ElevenLabs text nodes to change what Claude says. Reference `docs/VOICE-PROMPTS.md` for all prompts.

### Intent Classification
The Claude API node uses a system prompt to classify intents. Customize in the workflow if you need different commands.

### Retry Logic
Outbound call retry is configured in workflow 02. Default: retry after 30 minutes if voicemail.

### Notification Cascade
Workflow 04 handles the cascade: voicemail → SMS → Slack → email. Adjust timing and channels as needed.

## Troubleshooting

### Webhook not receiving events
1. Check n8n workflow is **activated**
2. Verify webhook URL in Telnyx portal
3. Check n8n execution logs for errors

### Telnyx calls failing
1. Verify Telnyx credentials
2. Check Call Control Connection ID is correct
3. Ensure phone number is assigned to the connection

### ElevenLabs audio issues
1. Verify API key
2. Check voice ID exists
3. Try Flash v2.5 model for lower latency

### Claude API errors
1. Verify API key
2. Check rate limits
3. Review system prompt for issues

## Testing

### Test Inbound
1. Call your Telnyx number
2. Check n8n execution logs
3. Verify intent classification
4. Confirm Pi API receives request

### Test Outbound
1. Create a test attention item via Pi API
2. Wait for batch window (or trigger manually)
3. Check n8n execution logs
4. Verify call is placed

### Test SMS
1. Send SMS to your Telnyx number
2. Check n8n execution logs
3. Verify response is routed to Pi

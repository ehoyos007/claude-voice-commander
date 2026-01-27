# Voice Prompts Configuration

This file contains all voice scripts that ElevenLabs will speak. Customize these to match your preferred tone and personality.

## Voice Settings

| Setting | Value |
|---------|-------|
| Voice ID | `3sfGn775ryaDXhFWHwBg` |
| Model | `eleven_turbo_v2` (low latency) |
| Stability | 0.5 |
| Similarity Boost | 0.75 |

## Tone Guidelines

- Professional but warm, like a capable work assistant
- Not robotic, not overly casual
- Concise and action-oriented
- Uses natural contractions ("I'll", "you've", "what's")

---

## Greetings

### INBOUND_GREETING
> Hey! What would you like to work on?

### INBOUND_GREETING_WITH_PENDING
> Hey! I've got {count} thing(s) waiting for you. Want to handle those first, or start something new?

### OUTBOUND_GREETING
> Hey Enzo! I've got {count} thing(s) that need your attention across {project_count} project(s).

### OUTBOUND_GREETING_URGENT
> Hey Enzo, quick heads up - there's an error on {project_name} that needs your attention.

---

## Session Commands

### SESSION_CREATING
> Got it, starting a new session called {name}...

### SESSION_CREATED
> {name} is up and running. What should Claude work on first?

### SESSION_CREATED_WITH_PROMPT
> {name} is running and I've sent over your instructions. Claude's on it.

### SESSION_LIST_INTRO
> You've got {count} session(s) running.

### SESSION_LIST_ITEM
> {name} is {status_description}.

### SESSION_LIST_EMPTY
> No sessions running right now. Want to start one?

### SESSION_NOT_FOUND
> I couldn't find a session called {name}. Want me to list what's running?

### SESSION_STATUS
> {name} is {status_description}. {activity_summary}

### SESSION_STOPPED
> Done, I've interrupted {name}. It's paused now.

### SESSION_KILLED
> Got it, {name} is shut down.

### SESSION_RESUMED
> {name} is back up and running.

### SESSION_LIMIT_REACHED
> You've already got {max} sessions running. Kill one first, or tell me which one to use.

### SESSION_ALREADY_EXISTS
> There's already a session called {name}. Want me to use that one, or pick a different name?

---

## Attention Items

### PRESENT_QUESTION
> On the {session} project, Claude is asking: "{question}"

### PRESENT_ERROR
> There's an error on {session}: {error}. Want me to read more details?

### PRESENT_COMPLETION
> Good news! {session} finished: {summary}

### PRESENT_BLOCKING
> The {session} project is stuck and needs your input: {description}

### MULTIPLE_ITEMS_INTRO
> Let's go through them one by one.

### NEXT_ITEM
> Next up...

### ALL_ITEMS_HANDLED
> That's everything! I'll call if anything else comes up.

---

## Clarification

### CLARITY_CHECK
> Got it - {summary}. Just to make sure Claude has enough to work with: {followup}

### CONFIRM_RESPONSE
> I heard "{response}". Is that right?

### DIDNT_UNDERSTAND
> Sorry, I didn't catch that. Could you say it again?

### NEED_MORE_DETAIL
> Could you be a bit more specific? Claude needs to know {what_needed}.

### WHICH_SESSION
> Which project should I apply that to? You've got {session_list} running.

---

## Messages to Sessions

### MESSAGE_SENT
> Done, I've passed that along to {session}.

### MESSAGE_SENT_MULTIPLE
> Got it, I've updated {session_list}.

---

## Voicemail

### VOICEMAIL_MESSAGE
> Hey Enzo, it's Claude. I've got {count} question(s) on {projects}. Check your texts for details, or call back when you can. Talk soon!

### VOICEMAIL_URGENT
> Hey Enzo, urgent one - there's an error on {project} that's blocking progress. Check your texts or call back when you get this.

---

## Errors & Recovery

### SYSTEM_ERROR
> Hmm, something went wrong on my end. Let me try that again.

### CONNECTION_ERROR
> I'm having trouble connecting to the Pi right now. Want me to try again?

### SESSION_NOT_RESPONDING
> That session isn't responding. Should I restart it?

### TIMEOUT
> Still there? I didn't hear anything.

### EXTENDED_SILENCE
> I'll let you go for now. Call back when you're ready!

---

## Endings

### CALL_END_WORKING
> Alright, Claude's on it. I'll call if anything else comes up!

### CALL_END_GOODBYE
> Talk soon!

### CALL_END_IDLE
> Got it, sessions are standing by. Call if you need anything!

### CALL_END_SCHEDULED
> Will do! I'll call you back at {time}.

---

## DND & Availability

### DND_ENABLED
> Do Not Disturb is on. I'll queue any questions until you call back or it turns off at {time}.

### DND_DISABLED
> Do Not Disturb is off. I'll call if anything needs attention.

---

## Callbacks

### CALLBACK_SCHEDULED
> Done, I'll call you back at {time}.

### CALLBACK_REMINDER
> You asked me to check in. Here's what's happening...

---

## Thinking Phrases

Use these when processing to avoid dead air:

- "Let me check on that..."
- "One moment..."
- "Looking into that now..."
- "Checking the status..."

---

## Notes for Customization

1. **Variables** are wrapped in `{curly_braces}` and will be replaced at runtime
2. **Keep responses short** - voice is slower than reading
3. **Use contractions** - sounds more natural
4. **Test with ElevenLabs** - some phrases sound better than others
5. **Consider the phone context** - users might be driving, walking, etc.

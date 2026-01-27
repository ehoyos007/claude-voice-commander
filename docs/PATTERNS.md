# Output Detection Patterns

This file defines regex patterns used to detect when Claude needs attention. Customize these based on your workflow and Claude's output patterns.

## Pattern Priority

| Priority | Type | Window | Description |
|----------|------|--------|-------------|
| 5 | Error | 30 sec | Unrecoverable errors, crashes |
| 4 | Blocking | 60 sec | Claude stuck, needs input to proceed |
| 3 | Question | 2 min | General questions, clarifications |
| 2 | Minor | 3 min | Low-impact decisions |
| 1 | Completion | 5 min | Task finished, FYI only |

---

## Question Patterns (Priority 3)

These patterns indicate Claude is asking a question and waiting for input.

```regex
# Ends with question mark
/\?$/m

# Common question phrases
/what would you like me to/i
/should I/i
/do you want me to/i
/would you prefer/i
/which (?:one|option|approach)/i
/how should I/i
/where should I/i
/when should I/i

# Clarification requests
/please clarify/i
/could you clarify/i
/I need more information about/i
/can you specify/i

# Choice prompts
/option \d:|choice \d:/i
/a\) .+ b\) .+/i
```

---

## Error Patterns (Priority 5)

These patterns indicate an error that needs immediate attention.

```regex
# Generic error markers
/error:/i
/ERROR:/
/failed:/i
/FAILED:/

# Exceptions and traces
/exception:/i
/traceback/i
/stack trace/i
/at .+:\d+:\d+/  # Stack trace line

# Permission issues
/permission denied/i
/access denied/i
/unauthorized/i
/forbidden/i

# Resource issues
/cannot |unable to /i
/not found/i
/does not exist/i
/no such file/i

# Node/System errors
/ENOENT|EACCES|EPERM|ECONNREFUSED/i

# Fatal errors
/fatal:/i
/panic:/i
/critical:/i
/abort/i

# Build/compile errors
/compilation failed/i
/build failed/i
/syntax error/i
/type error/i

# Test failures
/test failed/i
/assertion failed/i
/expected .+ but got/i
```

---

## Completion Patterns (Priority 1)

These patterns indicate Claude has finished a task.

```regex
# Explicit completion
/task complete/i
/done!/i
/finished/i
/completed successfully/i

# Success indicators
/all tests pass/i
/build succeeded/i
/deployed successfully/i

# Checkmarks and confirmations
/✓|✔|☑/
/\[done\]/i
/\[complete\]/i
/\[success\]/i

# Summary phrases
/here's what I did/i
/I've completed/i
/the changes have been/i
```

---

## Blocking Patterns (Priority 4)

These patterns indicate Claude is stuck and cannot proceed.

```regex
# Explicit waiting
/waiting for (?:input|response|confirmation)/i
/awaiting (?:input|response|your)/i
/blocked on/i

# Input requests
/please (?:provide|enter|specify|confirm)/i
/I need you to/i
/requires your input/i

# Cannot proceed
/cannot proceed without/i
/need(?:s)? (?:your|more) input/i
/before I can continue/i
```

---

## Minor Patterns (Priority 2)

These patterns indicate low-priority questions or optional decisions.

```regex
# Optional choices
/optionally/i
/if you'd like/i
/you might want to/i

# Suggestions
/I suggest/i
/you could also/i
/alternatively/i

# Non-blocking questions
/just checking/i
/quick question/i
/minor thing/i
```

---

## Anti-Patterns (Ignore)

These patterns should NOT trigger attention items, even if they match other patterns.

```regex
# Log output (not actual errors)
/\[INFO\]|\[DEBUG\]|\[WARN\]/i
/logging error/i
/error handling/i

# Documentation/comments
/^#|^\/\/|^\*/
/TODO:|FIXME:|NOTE:/

# Test descriptions (not failures)
/should .+ when/i
/it\(['"].+['"]\)/  # Jest/Mocha test descriptions

# Historical references
/previously failed/i
/was an error/i
/fixed the error/i
```

---

## Custom Patterns

Add your project-specific patterns here:

```regex
# Example: Specific to your codebase
# /MyApp: Question/i
# /MyApp: Error/i

# Example: Framework-specific
# /Next\.js build error/i
# /Prisma migration/i
```

---

## Testing Patterns

To test your patterns, use the Pi service endpoint:

```bash
# Test pattern detection
curl -X POST http://localhost:3000/debug/detect-pattern \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"content": "Should I use JWT or session cookies?"}'
```

Or test locally:

```typescript
import { detectAttentionType } from './lib/patterns';

const result = detectAttentionType('Should I use JWT or session cookies?');
console.log(result);
// { type: 'question', priority: 3, matchedLine: 'Should I use JWT...' }
```

---

## Notes

1. **Patterns are checked in priority order** (errors first)
2. **Only the last 20 lines are checked** to avoid false positives from historical output
3. **Case insensitive** by default (use `/i` flag)
4. **Multiline mode** enabled where appropriate (use `/m` flag)
5. **Test thoroughly** - bad patterns lead to missed items or spam calls

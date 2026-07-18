# Voice Privacy Rules

1. **No full account numbers** in speech service payloads
2. **No raw audio storage** unless user opts in (not implemented in v1)
3. **Delete audio immediately** after browser transcription
4. **Transcripts** stored only when user sends a message (CFO conversation)
5. **Logs** mask amounts > 4 digits in production debug
6. **Authentication** required for microphone-backed commands
7. **No auto-execute** — confirmation required for all financial updates
8. **Permissions-Policy** allows microphone only on app origin

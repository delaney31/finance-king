# Voice Audit and Undo Spec

## Audit log

Every confirmed voice command creates an `AuditLog` entry:

- action: `VOICE_FINANCIAL_COMMAND_APPLIED`
- metadata: parsed command, previousValues, originalTranscript, previousSnapshotId, confirmedAt, requestId

Audit logs are never silently deleted.

## Undo

`undoVoiceFinancialCommand(userId, auditId)`:

1. Load audit metadata
2. Reverse transactions (delete or restore)
3. Restore prior balances
4. Create CHANGE_UNDONE activity events
5. Create undo audit record (`VOICE_FINANCIAL_COMMAND_UNDONE`)
6. Recalculate financial state
7. Return metric changes

Transfers undo both sides together.

## Privacy

- Raw audio deleted after transcription (default)
- Confirmed transcript stored in activity + audit
- Full account numbers never sent to speech services
- Mask last-four only in logs

## User settings

- `retainVoiceTranscripts` preference (default: true)
- Disable voice in settings

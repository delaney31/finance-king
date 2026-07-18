# Account Voice Implementation Checklist

## Phase 1 — UI discoverability
- [x] Reusable `VoiceMicrophoneButton` with accessible label
- [x] Account voice sheet with context preselection
- [x] Mic on account cards (all types)
- [x] Mic on credit card cards
- [x] Mic on account detail page
- [x] Mic on transactions, bills, calendar
- [x] Coach mark (first use)

## Phase 2 — Parser
- [x] VoiceFinancialCommand Zod schema
- [x] Natural transaction parser
- [x] Context account boost
- [x] Payee extraction
- [x] Account alias resolution (existing)

## Phase 3 — Apply
- [x] applyVoiceFinancialCommand transactional handler
- [x] Balance snapshots
- [x] Account activity events
- [x] Audit logs
- [x] Financial state recalculation
- [x] Undo support

## Phase 4 — Data
- [x] Payee model
- [x] AccountActivityEvent model
- [x] Payee learning on confirm

## Phase 5 — Tests
- [x] Unit: parser, payee, activity, apply
- [x] Integration: required phrase examples
- [ ] Playwright E2E (browser speech mock)

## Phase 6 — Deferred
- [ ] Spoken confirmation (off by default)
- [ ] Recurring transaction auto-suggest UI

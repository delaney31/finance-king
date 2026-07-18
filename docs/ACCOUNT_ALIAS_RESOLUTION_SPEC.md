# Account Alias Resolution Spec

## Data model

`AccountAlias` links casual phrases to `FinancialAccount` records. One account may have many aliases.

Sources: `SYSTEM` (generated), `USER` (settings), `AI_LEARNED` (from clarification choices).

## Scoring

| Signal | Points |
|--------|--------|
| Exact normalized alias match | +100 |
| Institution + account type | +80 |
| Business entity match | +75 |
| Nickname substring | +70 |
| Last four digits | +70 |
| Ownership / designation | +30 |
| Fuzzy alias (Levenshtein) | up to +50 |
| Recent usage | +10 |

Incompatible account types (e.g. credit card for checking transfer source) are disqualified.

## Clarification

`requiresClarification: true` when top two candidates are within 15 points or top score < 70.

Preserve parsed amount, date, and intent while user selects account.

## System aliases

Generated from institution, nickname, account type, business entity, last four, and known institution nicknames (PenFed, Wells, Mercury, Amex, Truist, JadeSystems, Pacific Luxe).

## Learned aliases

When user picks an account from clarification, save phrase → account with `source: AI_LEARNED`.

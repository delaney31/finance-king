# Spoken Number Parsing Spec

Implementation: `src/lib/nlp/spoken-numbers.ts`, `src/lib/nlp/spoken-dates.ts`

## Numbers

| Spoken | Numeric |
|--------|---------|
| twenty-six thousand four hundred fifty | 26450 |
| five grand | 5000 |
| twenty-nine hundred | 2900 |
| thirteen hundred | 1300 |
| fifty-two hundred | 5200 |
| five point five thousand | 5500 |

## Rules

1. Convert word numbers before digit regex in parser
2. Flag ambiguous phrases ("four thousand and fifty cents") for review
3. Preserve existing `$26,450` digit formats
4. Handle "k" / "grand" multipliers

## Dates

| Spoken | Resolved |
|--------|----------|
| August fifth | 2026-08-05 |
| August thirteenth | 2026-08-13 |
| tomorrow | user timezone + 1 day |
| next Friday | next Friday in timezone |
| end of month | last day of current month |

Timezone from `UserPreference.timezone` or browser default.

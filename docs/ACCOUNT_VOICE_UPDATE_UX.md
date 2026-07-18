# Account Voice Update UX

## Goal

Users must immediately understand that every account can be updated by voice. The microphone is visible, labeled, and context-aware.

## Microphone placement

| Surface | Label | Context |
|---------|-------|---------|
| Checking/savings/business account cards | Update by voice | Preselects account |
| Credit card cards | Record activity by voice | Preselects card account |
| Loan cards | Record activity by voice | Preselects loan account |
| Account detail header | Tell Finance King what changed | Preselects account |
| Transaction activity (empty + list) | Add transaction by voice | Preselects account |
| Ask My CFO composer | Speak naturally | No preselection |
| Financial calendar | Record activity by voice | No preselection |
| Upcoming bills | Record payment by voice | Suggests bill payee |

## Account-card behavior

1. User taps **Update by voice** on PenFed Checking.
2. Account voice sheet opens with account name, masked ending, current balance.
3. User says: "I paid State Farm twelve hundred dollars."
4. System infers account (PenFed), payee (State Farm), amount ($1,200), category (Insurance), date (today), status (Cleared).
5. Confirmation preview shown — nothing applied until user confirms.

## Account voice sheet

- Account name + masked ending
- Current balance
- Microphone (tap or hold on mobile)
- Live transcript
- Suggested example phrases (account-type specific)
- Cancel / Record again / Review update
- Footer: "Updates are always reviewed before they change your account."

## Context priority

When opened from an account card, that account receives strongest matching priority (+50 score boost). Explicit spoken references to another account override after confirmation with a warning.

## Discoverability

- "Update by voice" under each account balance
- First-use coach mark (dismissible, stored in localStorage)
- Settings → Voice preferences
- Onboarding tip on accounts page

## Mobile

- Large tap target (min 44px)
- Hold-to-speak with haptic feedback where available
- Tap-to-start / tap-to-stop for accessibility

## Confirmation

Never auto-apply. Always show preview with balance before/after and impacted metrics.

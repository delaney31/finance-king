# Ask My CFO — UX Redesign

## Principle

**One clear answer first. Details only when requested.**

The default view should be understandable in 5 seconds. The interface should feel like texting a calm, financially intelligent advisor—not reading an accounting dashboard.

## Compact mode (default)

| Section | Content |
|---------|---------|
| Question | User's original question |
| Verdict | Large status: GO AHEAD, WAIT, NOT YET, etc. |
| Advice | Conversational one-liner |
| Reason | Single sentence why |
| Metrics | Exactly 3: Safe today, After action, Risk |
| Checks | Up to 4 protection checks with icons |
| Action | "Show details" accordion |

## Detailed mode (on demand)

Expanded accordion sections:

- Calculations
- Month-end / year-end impact (large purchases only in compact)
- Upcoming bills
- Assumptions
- Snapshot date
- Recommended account

## Visual

- One dominant answer card (navy/gold)
- Large verdict typography
- Generous spacing
- No technical intent labels
- Request limit hidden unless &lt; 10 remaining (info menu)

## Implementation

- `CFOCompactAnswer` built server-side from `CFOAssistantResponse` + tool results
- `compact-presenter.ts` handles verdict validation against engine data
- `CfoCompactAnswerCard` replaces stacked cards
- Composer shortened; placeholder: "Ask about spending, bills, or debt…"

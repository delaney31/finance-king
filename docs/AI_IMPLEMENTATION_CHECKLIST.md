# Ask My CFO — Implementation Checklist

## Phase 1

- [x] Architecture documentation
- [x] Prisma AI models
- [x] AI provider abstraction (OpenAI + rules fallback)
- [x] Intent classification
- [x] Financial tool layer
- [x] Safe-to-spend questions
- [x] Can-I-afford-it questions
- [x] Explain-metric questions
- [x] Structured response validation
- [x] Ask My CFO UI panel
- [x] API routes
- [x] Suggested questions (demo seed)
- [x] Unit tests
- [x] Integration tests
- [x] Playwright tests

## Phase 2

- [ ] Debt payment recommendations
- [ ] Overdraft risk assistant
- [ ] Income delay simulation
- [ ] Monthly financial review
- [ ] Conversation history UI
- [ ] Feedback system
- [ ] Streaming responses

## Phase 3

- [ ] Proactive daily briefing
- [ ] Weekly CFO review
- [ ] Goal coaching
- [ ] Smart notifications
- [ ] Subscription usage limits

## Verification (each phase)

```bash
npm run lint
npm run type-check
npm run test
npm run test:e2e
```

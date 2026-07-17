# AI Error Map

User-safe messages mapped from internal errors. Implementation: `src/lib/ai/pipeline/error-map.ts`

| Category | User Message | Retryable |
|----------|--------------|-----------|
| `AI_CONFIGURATION` | AI configuration is incomplete. Finance King still completed the calculation. | No |
| `AI_TIMEOUT` | The AI explanation timed out. Here is the result from Finance King's financial engine. | Yes |
| `AI_RATE_LIMIT` | The AI service is temporarily busy. Your financial data was not changed. | Yes |
| `AI_QUOTA` | AI credits are unavailable. Finance King completed the calculation without AI prose. | No |
| `AI_NETWORK` | The AI service is temporarily unavailable. Your financial data was not changed. | Yes |
| `VALIDATION_FAILED` | I could not validate the AI response, so I'm showing the calculation directly. | Yes |
| `FINANCIAL_ENGINE` | I couldn't load your current financial snapshot. No records were changed. | Yes |
| `FINANCIAL_ENGINE_TIMEOUT` | Loading your financial data took too long. Please try again. | Yes |
| `RATE_LIMIT` | Daily AI request limit reached. | No |
| `DUPLICATE_REQUEST` | This question is already being processed. | No |
| `REQUEST_CANCELLED` | Request was cancelled. | Yes |
| `UNAUTHORIZED` | Please sign in to use Ask My CFO. | No |

## Never Exposed

- Stack traces
- OpenAI response bodies
- API keys
- Full account numbers
- Database records
- Auth tokens

# AI Observability Plan

## Request ID

Every request receives `requestId = crypto.randomUUID()` at API entry. Propagated through stage logs and stored in `aIRecommendation.metadata`.

## Stage Logging

```ts
type CFORequestStage =
  | "REQUEST_RECEIVED"
  | "AUTH_STARTED" ...
  | "REQUEST_TIMED_OUT";
```

Logged via `createStageLogger()` in `src/lib/ai/pipeline/stages.ts`.

Each log includes: `requestId`, `userId`, `stage`, `timestamp`, `durationMs`, optional `intent`, `toolName`, `model`, `errorCategory`.

## Development Debug Panel

`CfoRequestDebugPanel` shows request ID and current client state machine value when `NODE_ENV === "development"`.

## Metrics (in-memory)

`src/lib/ai/pipeline/metrics.ts` tracks:

- Request count
- Fallback rate
- Average recent latency
- Last error category
- Last success timestamp

Exposed at `GET /api/health/ai`.

## Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | App + database + redis + storage |
| `GET /api/health/financial-engine` | DB reachable, snapshot table |
| `GET /api/health/ai` | Provider config, metrics (no billable call) |
| `POST /api/admin/health/ai` | Authenticated small AI test |

## Redaction Rules

Never log: account numbers, routing numbers, card numbers, SSNs, API keys, screenshots, full DB records, auth tokens.

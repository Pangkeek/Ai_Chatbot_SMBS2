# Task8 — Gemini / OpenAI failover

## Enable

Run `npm run db:migrate:postgres` before starting the new release. Migration
`005_ai_handover.sql` adds the handover reason and internal notification owner;
the runtime refuses to start against an older schema. No migration runs in an API request.

Configure these **server-side** environment variables and restart the application:

```dotenv
AI_MODE=dual
GEMINI_API_KEY=<server-secret>
GEMINI_MODEL=<enabled-model-supporting-structured-output>
OPENAI_API_KEY=<server-secret>
OPENAI_MODEL=<enabled-model-supporting-structured-output>
```

Both providers and explicit model IDs are required. Use models available to your
accounts that support the JSON schema used in the adapters. No model is selected
automatically. Docker Compose passes these variables to the application. On Render,
set them in the service environment and run the normal predeploy migration; this
change does not deploy or provision services. Never use `NEXT_PUBLIC_` for keys.

`AI_MODE=offline` uses local extractive answers. `AI_MODE=http` uses the existing
`RAG_GENERATOR_URL` / `RAG_GENERATOR_TOKEN` service. When `AI_MODE` is omitted,
the presence of `RAG_GENERATOR_URL` selects HTTP mode, otherwise offline. An HTTP
failure retains the previous extractive behavior. A lone Gemini key does not enable
dual mode. Invalid dual configuration fails initialization rather than silently
running with incomplete failover. The AI context preview only reports configuration;
it does not call either provider or confirm provider availability.

## Answer and failure policy

Exact FAQ matches and questions without relevant evidence bypass external AI.
Other questions send the existing system prompt and retrieved evidence only from
the current shop. Gemini uses `generateContent`; OpenAI uses the Responses API
with `store:false`. Both use structured JSON containing `text`, `sourceChunkIds`
and `insufficient`. The server still verifies that the answer is a verbatim excerpt
from exactly one supplied chunk, at most 5,000 characters. Structured JSON alone
does not establish grounding. There is no streaming or conversation history upload.

The gateway tries Gemini, then OpenAI. Invalid JSON, incomplete responses, unsupported
quotes, and nontransient HTTP errors immediately move to the backup. Network errors,
timeouts, HTTP 408/429/5xx get at most two retries per provider: 250ms then 500ms
backoff plus up to 20% jitter. `Retry-After` is honored only within the remaining
budget; otherwise the gateway moves to the backup without retrying early.

Each HTTP attempt including its response body has a 4s timeout. A provider has a
14s budget and the total generation budget is 28s. LINE generation also uses the
remaining DB-clock reply window minus 12s for persistence/delivery (45s cutoff).
Requests without generation time remaining go straight to the failure policy.
Cancellation from lease loss or shutdown aborts requests/backoff and never starts
a backup or creates a handover. Timers, event listeners and late results are cleaned
up or discarded. Provider calls and LINE delivery never hold a database transaction.

After three consecutive failed logical requests to a provider (not three individual
attempts), its circuit opens for 30s. After that, one concurrent probe is allowed;
success closes the circuit and failure reopens it. Circuit state is shared within
each server process and resets on restart. Multiple processes have independent
circuits; this release does not provide a distributed breaker.

`insufficient:true` is a successful no-evidence result, not an outage. A safety refusal
hands over immediately without attempting to bypass the refusal through another
provider. If both providers are unavailable, return `AI_UNAVAILABLE`; dual mode does
not conceal that outage with an extractive answer.

## Handover and delivery

The worker locks and checks the conversation and its job lease, then atomically
checkpoints `reply_method=handover` and changes `bot_mode` from `active` to `human`.
The conversation records `handover_reason=AI_UNAVAILABLE` or `AI_SAFETY_REFUSAL`.
The notice for an outage is:

> ขออภัย ระบบตอบอัตโนมัติขัดข้อง ขณะนี้ส่งเรื่องให้เจ้าหน้าที่ดูแลต่อแล้ว

Only the job which owns that handover can send the notice. Other jobs record the
customer message but do not answer. A restarted worker reuses the saved notice
without calling AI again. Any explicit change to conversation status or bot mode
clears the internal notification owner and reason, including `human` to `human`,
so an old notice cannot be sent after an admin has taken over. State is rechecked
at the send checkpoint; an HTTP request already dispatched cannot be recalled.

The conversation stays `human` if the LINE reply token is missing, the window
expires, or delivery fails. No assistant message is recorded as delivered unless
delivery succeeds. An uncertain send is terminal and is never automatically
retried. The simulator applies the same handover policy. The existing conversation
API exposes the reason read-only; ownership tokens remain internal. Re-enable the
bot with the existing conversation PATCH setting `bot_mode` to `active`.

Task8 does not add an external admin notification channel or the task9–10 inbox
and agent messaging UI. A human state means the conversation awaits an agent;
it does not assert that an agent has read or accepted it.

## Verification and operation

- `node --test tests/ai-gateway.test.js` tests providers, retry, circuit transitions,
  deadlines, refusal and redacted logs without network or paid API calls.
- `npm run test:runtime` includes `tests/ai-handover.test.js`, with real PostgreSQL
  transactions in isolated test schemas. It covers failover, concurrent handover,
  restart, admin intervention, lease loss, cutoff, failed send and simulator behavior.
- `npm run test:postgres:schema`, `npm run test:import`, `npm run api:check`, and
  `npm run build` validate migrations, legacy import, contract and production build.
- `AI_GATEWAY` structured logs contain provider/model, attempt, elapsed time, error
  code and circuit transition. They omit keys, customer text, prompts and upstream
  error bodies. `LINE_JOB` logs continue to identify delivery failures by job ID.

Before a live demo, configure both accounts and test against an isolated LINE
channel with shop-specific evidence. Verify a successful normal answer, then induce
a primary error in the mock integration test and a dual outage to demonstrate
handover. Automated tests do not verify account permissions or model availability.

To disable external generation, set `AI_MODE=offline` and restart. Keep the additive
migration in place; do not edit migration history. Existing `human` conversations
remain human until an admin explicitly resumes them. When rolling application code
back to an older release, drain/pause the worker first so it cannot process task8
handover jobs using older bot-mode rules.

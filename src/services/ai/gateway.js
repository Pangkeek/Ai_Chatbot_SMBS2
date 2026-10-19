import { setTimeout as delay } from 'node:timers/promises';
import { validateGeneratedAnswer } from './answerValidation.js';
import { AiError } from './providers.js';

export { AiError } from './providers.js';

// Also bounds injected transports which ignore AbortSignal. Late results are discarded.
async function bounded(action, { signal, timeoutMs }) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  let timer, abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => { controller.abort(signal.reason); reject(signal.reason); };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      const error = new AiError('AI_TIMEOUT', { retryable: true });
      controller.abort(error); reject(error);
    }, timeoutMs);
  });
  try { return await Promise.race([Promise.resolve().then(() => action(controller.signal)), cancelled]); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export function createAiGateway({ providers, attemptTimeoutMs = 4000, providerBudgetMs = 14000,
  totalBudgetMs = 28000, maxRetries = 2, backoffMs = 250, breakerThreshold = 3, breakerCooldownMs = 30000,
  now = Date.now, random = Math.random, sleep = (ms, signal) => delay(ms, undefined, { signal }),
  log = event => console.info('AI_GATEWAY', JSON.stringify(event)),
}) {
  const circuits = providers.map(() => ({ failures: 0, openUntil: 0, probing: false, generation: 0 }));
  const writeLog = event => { try { log(event); } catch { /* Logging cannot interrupt delivery. */ } };
  return {
    failurePolicy: 'handover',
    async generate(input) {
      const emit = event => writeLog({ ...event, ...(input.jobId ? { jobId: input.jobId } : {}) });
      input.signal?.throwIfAborted();
      const deadline = Math.min(input.deadlineAt ?? Infinity, now() + totalBudgetMs);
      for (const [index, provider] of providers.entries()) {
        input.signal?.throwIfAborted();
        if (now() >= deadline) break;
        const circuit = circuits[index];
        if (circuit.probing || circuit.openUntil > now()) continue;
        const generation = circuit.generation;
        const probe = circuit.openUntil !== 0;
        if (probe) {
          circuit.probing = true;
          emit({ event: 'circuit', provider: provider.name, state: 'half_open' });
        }
        const providerDeadline = Math.min(deadline, now() + providerBudgetMs);
        let failure;
        try {
          for (let attempt = 0; attempt <= (probe ? 0 : maxRetries); attempt++) {
            input.signal?.throwIfAborted();
            if (now() >= providerDeadline) break;
            const startedAt = now();
            try {
              const result = await bounded(signal => provider.generate({ ...input, signal }), {
                signal: input.signal, timeoutMs: Math.max(1, Math.min(attemptTimeoutMs, providerDeadline - now())),
              });
              input.signal?.throwIfAborted();
              if (now() >= providerDeadline) throw new AiError('AI_TIMEOUT', { retryable: true });
              const answer = validateGeneratedAnswer(result, input.context, { strict: true });
              if (!answer) throw new AiError('AI_INVALID_ANSWER');
              // A request admitted before the circuit opened cannot close a newer open circuit.
              if (generation === circuit.generation) { circuit.failures = 0; circuit.openUntil = 0; }
              emit({ event: 'attempt', provider: provider.name, model: provider.model, attempt: attempt + 1,
                durationMs: now() - startedAt, code: 'OK' });
              if (probe) emit({ event: 'circuit', provider: provider.name, state: 'closed' });
              return { ...answer, provider: provider.name, model: provider.model, attempts: attempt + 1 };
            } catch (error) {
              input.signal?.throwIfAborted();
              // Only transport failures are retried; unknown exceptions are not trusted.
              failure = error instanceof AiError ? error : new AiError(
                error instanceof TypeError || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error?.code)
                  ? 'AI_NETWORK' : 'AI_PROVIDER_ERROR',
                { retryable: error instanceof TypeError || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error?.code) });
              emit({ event: 'attempt', provider: provider.name, model: provider.model, attempt: attempt + 1,
                durationMs: now() - startedAt, code: failure.code });
              if (failure.code === 'AI_SAFETY_REFUSAL') throw failure;
              if (!failure.retryable || attempt === maxRetries || probe) break;
              const waitMs = Math.max(failure.retryAfterMs, backoffMs * 2 ** attempt * (1 + random() * 0.2));
              if (now() + waitMs >= providerDeadline) break;
              await sleep(waitMs, input.signal);
            }
          }
          // Count failed logical requests, not each retry. A probe failure reopens immediately.
          if (generation === circuit.generation) {
            circuit.failures++;
            if (probe || circuit.failures >= breakerThreshold) {
              circuit.generation++;
              circuit.openUntil = now() + breakerCooldownMs;
              emit({ event: 'circuit', provider: provider.name, state: 'open' });
            }
          }
        } finally { if (probe) circuit.probing = false; }
      }
      throw new AiError('AI_UNAVAILABLE');
    },
  };
}

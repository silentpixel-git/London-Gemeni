# packages/ai

The seam between the engine and the models (plan §2.9, ADR-0002, ADR-0003).

| File | Owner | Holds |
|---|---|---|
| `types.ts` | design | `Ai` (select, narrate), `SelectInput`, `NarrationChunk`, `AiConfig`, `PromptBundle`, env keys |
| `prompts.ts` | prompt design | `buildSelectPrompt`, `buildNarratePrompt` → `PromptBundle` |
| `gate.ts` | prompt design | `gateNarration`: the invention gate |
| `gemini.ts` | plumbing | Gemini adapter over `@google/genai`: sends a `PromptBundle`, validates the reply with Zod, retries once |
| `recorded.ts` | plumbing | Fixture adapter: replays JSON recordings keyed by a hash of the input; records when a real provider is wrapped |
| `index.ts` | plumbing | `createAi(config)` and `configFromEnv(env)` |

Rules of the seam:

- `packages/engine` never imports this package.
- Adapters never add instructions to a prompt. Prompt text lives in `prompts.ts` only.
- Every reply is validated with the Zod schema (`Selection`, `NarrationResult`) before it leaves the adapter. A `Selection` naming an id outside the Candidate Set is replaced by `{kind:'none'}` in the adapter, and the turn endpoint validates again.
- `narrate` streams `text` deltas as they arrive and ends with one `done` chunk carrying the parsed `NarrationResult`. If the gate rejects the result, the endpoint asks once more with the inventions named; a second rejection falls back to the Beats alone.

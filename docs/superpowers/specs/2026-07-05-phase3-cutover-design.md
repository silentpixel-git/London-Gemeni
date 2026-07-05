# Phase 3 Cutover — AI Parser Default-On + Legacy Path Deletion (Design)

**Date:** 2026-07-05
**Predecessor:** `docs/superpowers/specs/2026-07-04-phase3-tool-call-parser-design.md`
(which explicitly deferred this cutover: "default the flag on in production, and
in a separate commit delete `resolveTargetWithAI` and the flag's off-branch").
The corpus gate that spec demanded has passed (92% tool-call accuracy, 0
enum-validation failures against live Gemini).

## Goal

Make the Phase 3 tool-calling parse fallback the production path, delete the
legacy `resolveTargetWithAI` examine/talk-only fallback it supersedes, and keep
a build-time kill switch for emergency rollback.

## Decisions (settled with the user, 2026-07-05)

1. **Rollout: kill switch, one branch.** The flag inverts — AI parser is ON
   unless `VITE_AI_PARSER='off'`. Legacy path deleted in the same branch.
   Rollback = set the env var to `off` in Vercel + redeploy; no code revert.
2. **intentParser.ts: orphan cleanup only.** The 766-line regex parser stays
   intact as the free instant fast path. Only code orphaned by the legacy-path
   deletion goes. If nothing is orphaned, the file is untouched and the roadmap
   item "shrink intentParser" is retired as a no-op.
3. **Verification: full gate.** Offline suites + live `qa:parser` (all gates
   green) + a manual dev-server smoke session, then the standard whole-branch
   review pair.

## Changes

### 1. Flag inversion (`hooks/useGameState.ts`)

- Line ~135: `AI_PARSER_ENABLED = (import.meta.env.VITE_AI_PARSER ?? '') !== 'off'`.
- `vite.config.ts` define line (73) stays byte-identical.
- Production consequence: the var is unset in Vercel, so the next deploy turns
  the AI parser on with **zero env changes**. `'on'` (if ever set) also means on.
- `.env.example`: document `VITE_AI_PARSER=off` as the emergency kill switch.

### 2. Legacy path deletion (four layers)

| Layer | File | Delete |
|---|---|---|
| Hook | `hooks/useGameState.ts` | `resolveTargetWithAI` (~lines 42–126) + `targetResolveCache`; turn-loop branch collapses to `intent = AI_PARSER_ENABLED ? await resolveIntentWithAI(...) : intent` |
| Client service | `services/AIService.ts` | `resolveTargetObject` method (~151–169) |
| Gateway | `api/ai.ts` | `case 'resolveTarget'` (~85) + its header-comment line |
| Server core | `server/aiCore.ts` | `resolveTargetObject` (~784) plus any prompt/constants only it consumes |

Kill-switch-off semantics: pure regex parser; misses stay in-character engine
misses. Degraded but safe — identical to a Gemini outage, since
`aiService.parseAction` already returns `{ intent: null }` on any failure and
the turn keeps the regex intent. No new error handling needed.

### 3. `scripts/qa-parser.ts` rework — test what production runs

The hybrid pass (object-miss recovery) and NPC tier-2 pass currently call the
deleted `resolveTargetObject`. Both re-route through the production fallback:
`needsAiParse` gate is implicit (these are known misses), candidates via
`buildParseCandidates`, resolution via `aiService.parseAction` (same direct
`server/aiCore` import the tool-call pass already uses). Raw inputs are the
full commands (`examine <text>` / `talk to <text>`), matching what
`resolveIntentWithAI` sends in production (`intent.raw`).

Regression gates keep their floors — this branch may not lower any bar:

- Object deterministic: 0.75 (`GATE`)
- NPC tier-1 deterministic: 0.90 (`NPC_GATE`)
- Tool-call accuracy: 0.75 (`TC_GATE`)

The recovery passes stay informational (no new gate), as today.

### 4. `engine/intentParser.ts` — orphan cleanup only

`unresolved_target` stays: `needsAiParse` and the engine both consume it.
Expected outcome: zero or near-zero deletions.

### 5. Comment/doc hygiene

- Update "Deleted-at-cutover" / `resolveTargetWithAI` references in
  `hooks/useGameState.ts` (~128–134) and `engine/parseFallback.ts` comments.
- `engine/stories/types.ts`: if any scaffolding comments still say "Phase 3",
  reword to "future phases" (the predecessor spec asked for this; verify
  whether commit 7fb7574 already covered it).
- Update the rebuild-roadmap memory after merge.

## Out of scope

- Deleting the flag entirely (later trivial cleanup once production has soaked).
- Any intentParser alias-table slimming (would trade free instant hits for
  paid AI calls).
- One-model-call-per-turn architecture (parser deleted) — still future work.
- Narration path, story data, UI.

## Verification gate (all must pass before PR)

1. `npm run lint && npm run qa:validate && npm run qa:engine && npm run build`
2. `npm run qa:parser` **live** (GEMINI_API_KEY from the main checkout's
   `.env.local`): object ≥ 75%, NPC tier-1 ≥ 90%, tool-call ≥ 75%, zero
   enum-validation failures.
3. Manual smoke session on the dev server: paraphrased inputs ("peer beneath
   the bedframe"-style) resolve through the AI fallback; plus one run with
   `VITE_AI_PARSER=off` confirming the pure-regex degraded mode works.
4. Whole-branch review: `engine-logic-reviewer` + `engineering-reviewer` in
   parallel; fix Critical/Important findings.

## Rollout

Merge to main → Vercel production deploy → AI parser live (var unset = on).
Post-deploy: one live production spot-check (paraphrased input resolves; no
gateway errors in Vercel logs). Rollback path: set `VITE_AI_PARSER=off` in
Vercel (Production), redeploy.

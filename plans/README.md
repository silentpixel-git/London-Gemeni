# Animation improvement plans

Output of the full UI animation audit (improve-animations skill), commit `f97684a`, 2026-07-14. The audit report with all findings lives in the session plan file; each plan below is self-contained for an executor with zero context.

## Execution order & status

| # | Plan | Findings | Depends on | Status |
|---|------|----------|------------|--------|
| 1 | [001-high-feel-breaking.md](001-high-feel-breaking.md) | H1 dead `animate-in` classes, H2 command spring, H3 reduced-motion, H4 global `*` transition, H5 typewriter skip + early-onComplete | — | DONE |
| 2 | [002-medium-noticeably-off.md](002-medium-noticeably-off.md) | M5 motion tokens, M1 dropdown origin, M2 modal entrances, M3 sidebar slide, M4 streaming `transition-all`, M6 bounce→pulse, M7 dropdown easing, M8 toast exit | Plan 001 (plugin) | DONE |
| 3 | [003-low-polish.md](003-low-polish.md) | L1 GameOver hover, L2 dead caret transition, L3 diary overlay blur, L4 curtain (no change, documented), L5 Begin Act tokens | Plan 002 Step 0 (tokens); L2 assumes Plan 001 Step 4 | TODO |
| 4 | [004-polish-missed-opportunities.md](004-polish-missed-opportunities.md) | MO1 diary badge, MO2 sidebar room fade, MO3 diary accordion, MO4 scene-header settle | Plans 001 + 002 Step 0 | TODO |

## Notes for whoever executes

- Run plans strictly in order — 001 installs `tailwindcss-animate` and the reduced-motion CSS that 002/004 rely on; 002 Step 0 creates `components/motionTokens.ts` used by 003/004.
- After each plan: `npm run lint`, then the plan's own feel-check list in the dev server (`.claude/launch.json` → `London Bleeds — Dev Server`).
- Update the Status column here (TODO → DONE) as plans land.
- Per project memory: playtest player-facing changes before calling them done — the feel-checks are not optional.

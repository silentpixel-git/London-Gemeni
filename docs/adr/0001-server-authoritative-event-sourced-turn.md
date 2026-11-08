---
status: accepted
---

# Server-authoritative, event-sourced turn

The current engine runs in the browser, keeps a mutable snapshot (flag bag, inventory strings, NPC states) and saves it to Supabase slots; only AI calls cross to the server. Resume-fidelity bugs (NPC memory not rehydrated) and the impossibility of replaying a reported bug both come from that shape. We decided that a turn is one server request: the server parses, resolves, appends Events to an append-only Investigation log and streams narration; the browser renders. State is nothing but the replay of the log.

## Considered options

- **Client engine, server only for AI (status quo).** Rejected: with AI-first parsing every turn already needs the server, so a client engine costs two round-trips per turn, and the log would be written from the browser.
- **Hybrid (client resolves, server narrates and logs).** Rejected: three hops per turn and two copies of the engine to keep in step.
- **Snapshot plus a side log for QA.** Rejected: two things to keep in sync; the log drifts from truth exactly when it is needed.

## Consequences

- The same engine runs in the turn endpoint, in QA scripts and in the editor's preview, in Node.
- Any bug report is reproducible by replaying its Investigation's Events.
- Investigation state cannot be edited directly in the database; corrections are compensating Events.
- Cold starts and network latency are now on the critical path of every turn, so the turn endpoint must stream early.

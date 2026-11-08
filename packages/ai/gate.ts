// The invention gate (ADR-0002): prose may not contain a proper noun or a
// numeric specific that appears in neither the turn's context nor the
// Investigation's Observations. Owned by the prompt designer.
//
// STATUS: placeholder. The port of scripts/qa-invention.ts's findInventions
// to the new NarrationContext lands here; until then the gate passes everything.
import type { NarrationContext, NarrationResult } from '../schema';

export interface GateVerdict { ok: boolean; inventions: string[] }

export function gateNarration(_ctx: NarrationContext, _result: NarrationResult): GateVerdict {
  return { ok: true, inventions: [] };
}

// Pure narration-text helpers. No React, no AI, no mutable game state (static
// story constants only) — safe to import from the hook and from the QA
// harness alike.

import { ACT_NAMES } from '../engine/gameData';
import { ACT_ROMAN } from '../constants';

/**
 * Inject an authored line as its own paragraph immediately after a streamed
 * Markdown `### …` heading. Used to splice deterministic, authored prose — the
 * opening's fixed line, and each act's arrival "bridge" — into AI-streamed
 * narration that the model never sees and cannot alter.
 *
 * Mid-stream the heading line may not be terminated by a newline yet; in that
 * case we prepend, and the line snaps into place once the newline arrives. An
 * empty `line` is a no-op, so callers can pass a bridge that may not exist.
 *
 * Since headings became feed chrome (see formatActHeading) the streamed text
 * normally has no heading — callers strip first, so this degrades to a plain
 * prepend; the heading branch remains as a second net.
 */
export function injectAfterHeading(text: string, line: string): string {
  if (!line) return text;
  const match = text.match(/^(###[^\n]*\n\n?)/);
  return match ? match[1] + line + text.slice(match[1].length) : line + text;
}

/**
 * Chrome heading for scene-entry narrations — "Prologue: The Baker Street
 * Vigil", "Act III: The Double Event". Rendered by NarrativeFeed above the
 * prose (its CSS uppercases it), set only by the opening / act-arrival /
 * resume generators, never on ordinary turns.
 */
export function formatActHeading(act: number): string {
  const prefix = act === 0 ? 'Prologue' : `Act ${ACT_ROMAN[act] ?? act}`;
  const name = ACT_NAMES[act];
  return name ? `${prefix}: ${name}` : prefix;
}

/**
 * Defensive net: the prompts no longer ask for a `### ACT …` heading, but a
 * disobedient generation may still emit one. Remove a leading `###` line —
 * including a partial one still streaming (no terminating newline yet), which
 * strips to nothing until the line completes.
 */
export function stripLeadingActHeading(text: string): string {
  if (!text.startsWith('###')) return text;
  const nl = text.indexOf('\n');
  if (nl === -1) return '';
  return text.slice(nl + 1).replace(/^\n+/, '');
}

// Pure narration-text helpers. No React, no AI, no game state — safe to import
// from the hook and from the QA harness alike.

/**
 * Inject an authored line as its own paragraph immediately after a streamed
 * Markdown `### …` heading. Used to splice deterministic, authored prose — the
 * opening's fixed line, and each act's arrival "bridge" — into AI-streamed
 * narration that the model never sees and cannot alter.
 *
 * Mid-stream the heading line may not be terminated by a newline yet; in that
 * case we prepend, and the line snaps into place once the newline arrives. An
 * empty `line` is a no-op, so callers can pass a bridge that may not exist.
 */
export function injectAfterHeading(text: string, line: string): string {
  if (!line) return text;
  const match = text.match(/^(###[^\n]*\n\n?)/);
  return match ? match[1] + line + text.slice(match[1].length) : line + text;
}

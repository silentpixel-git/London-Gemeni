/**
 * engine/visibility.ts
 *
 * What is actually in a room right now. LocationDefinition.interactables is the
 * full authored inventory of a location; this filters it against the session's
 * flags so that container contents and objects that have not yet arrived are
 * invisible to narration, parsing, and every resolver.
 *
 * Story-auditing scripts (qa-validate, build-story-map) deliberately do NOT use
 * this — they need the full authored list.
 */

import type { StoryManifest } from './stories/types';

export function visibleInteractables(
  story: StoryManifest,
  locationId: string,
  flags: Record<string, boolean>,
): string[] {
  const all = story.locations[locationId]?.interactables ?? [];
  return all.filter(id => {
    const gate = story.objectVisibility[id];
    return !gate || flags[gate] === true;
  });
}

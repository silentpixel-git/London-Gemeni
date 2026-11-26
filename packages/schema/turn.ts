// The body of POST /api/turn (server/TURN.md): a player's line, an idle Tick,
// a resume, or a new Investigation. The server parses it; the client sends it.
import { z } from 'zod';
import { Id } from './common.js';

export const TurnRequest = z.union([
  z.object({ investigationId: z.string().min(1), text: z.string().trim().min(1) }).strict(),
  z.object({ investigationId: z.string().min(1), tick: z.literal(true) }).strict(),
  z.object({ investigationId: z.string().min(1), resume: z.literal(true) }).strict(),
  z.object({ start: z.object({ storyId: Id, name: z.string().trim().min(1) }).strict() }).strict(),
]);
export type TurnRequest = z.infer<typeof TurnRequest>;

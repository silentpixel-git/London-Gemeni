/**
 * api/ai.ts
 *
 * Vercel serverless function — the AI gateway.
 *
 * Every Gemini call the game makes goes through this single POST endpoint, so
 * GEMINI_API_KEY lives only in the server environment (never in the client
 * bundle). The client counterpart is services/AIService.ts.
 *
 * Ops:
 * - narrate       → NDJSON stream (one JSON line per narration update)
 * - ping | holmes | hint | journal  → { text }
 * - leadDiary     → { title, body }
 * - resolveTarget → { objectId }
 * - parseAction   → { intent, invalidArgs }
 *
 * In dev, the same handler is mounted on the Vite dev server by the
 * ai-dev-gateway plugin in vite.config.ts.
 */

import { aiService } from '../server/aiCore.js';

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    switch (body.op) {
      case 'ping':
        return Response.json({ text: await aiService.ping() });

      case 'narrate': {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const update of aiService.stream(body.ctx as never)) {
                // fullJson is internal to the core; the client only needs these.
                const line = JSON.stringify({
                  narrative: update.narrative,
                  isComplete: update.isComplete,
                  parsed: update.parsed,
                });
                controller.enqueue(encoder.encode(line + '\n'));
              }
            } catch (err) {
              console.error('api/ai narrate:', err);
              controller.enqueue(
                encoder.encode(JSON.stringify({ error: 'Narration failed.' }) + '\n')
              );
            }
            controller.close();
          },
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }

      case 'holmes':
        return Response.json({
          text: await aiService.consultHolmesMultiClue(
            body.allDiscoveredClues as never,
            body.newlyFoundNames as never,
            body.currentAct as never,
          ),
        });

      case 'hint':
        return Response.json({ text: await aiService.getWatsonHint(body.target as never) });

      case 'journal':
        return Response.json({ text: await aiService.generateJournalEntry(body.summary as never) });

      case 'leadDiary':
        return Response.json(await aiService.generateLeadDiaryEntry(body.context as never));

      case 'resolveTarget':
        return Response.json(
          await aiService.resolveTargetObject(
            body.rawInput as never,
            body.intentType as never,
            body.candidates as never,
            body.entityNoun as never,
          ),
        );

      case 'parseAction':
        return Response.json(
          await aiService.parseAction(body.rawInput as never, body.candidates as never),
        );

      default:
        return Response.json({ error: `Unknown op: ${String(body.op)}` }, { status: 400 });
    }
  } catch (err) {
    console.error(`api/ai ${String(body.op)}:`, err);
    return Response.json({ error: 'AI request failed.' }, { status: 500 });
  }
}

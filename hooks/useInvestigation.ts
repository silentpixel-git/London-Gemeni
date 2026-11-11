/**
 * hooks/useInvestigation.ts
 *
 * The game's state on the client after the cut-over (plan §4 Phase 4). The
 * server owns the Investigation (ADR-0001); this hook only holds what it last
 * said: the feed, the PlayerView, and the prose streaming for the turn in
 * flight. Nothing here knows a Story.
 *
 *  - One request at a time (the server refuses a second with 409 anyway).
 *  - A turn's `done.feed` replaces whatever streamed; a resume replaces the
 *    whole feed. Both come from the server's feedOf, so a reload or a second
 *    browser renders exactly what was seen.
 *  - Idle Ticks: after IDLE_TICK_MS with no key pressed and no turn, while the
 *    tab is visible, the world moves on; at most MAX_IDLE_TICKS in a row until
 *    the player acts again, so an abandoned tab does not narrate forever.
 *  - The last opened Investigation is remembered per browser and resumed on load.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventPayload, FeedItem, PlayerView } from '../packages/schema/index.js';
import { InvestigationRepository, type InvestigationSummary } from '../services/InvestigationRepository';
import { postTurn, TurnRefused, type TurnBody, type TurnLine } from '../services/turnClient';
import type { GameHistoryItem } from '../types';

/** The Story a new Investigation starts on: the Whitechapel Story, which opens on Act 0. */
export const DEFAULT_STORY: string = import.meta.env.VITE_DEFAULT_STORY || 'whitechapel_1888';
export const IDLE_TICK_MS = 120_000;
const MAX_IDLE_TICKS = 3;
const IDLE_POLL_MS = 5_000;
const LAST_KEY = 'lb:lastInvestigation';

/** The turn in flight: the player's line at once, then prose as it streams. */
interface Pending { player?: string; text: string }

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_KEY, id);
    else localStorage.removeItem(LAST_KEY);
  } catch { /* storage unavailable: nothing to remember */ }
}
function recall(): string | null {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

/** The feed (plus the turn in flight) in the shape NarrativeFeed renders. */
export function historyFrom(feed: FeedItem[], pending: Pending | null): GameHistoryItem[] {
  const items: GameHistoryItem[] = feed.map(f =>
    f.kind === 'player' ? { role: 'user', text: f.text }
    : f.kind === 'prose' ? { role: 'assistant', text: f.text, location: f.location, actHeading: f.actHeading }
    : { role: 'assistant', text: `**${f.name}**` });
  if (pending?.player !== undefined) items.push({ role: 'user', text: pending.player });
  if (pending) items.push({ role: 'assistant', text: pending.text });
  return items;
}

export function useInvestigation({ userId }: { userId: string | null }) {
  const [investigationId, setInvestigationId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [investigations, setInvestigations] = useState<InvestigationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Initial load for this user finished (list fetched, last Investigation resumed or not). */
  const [isReady, setIsReady] = useState(false);
  /** Whether POST /api/turn answered the last request: the header's Engine dot. null before the first. */
  const [engineOk, setEngineOk] = useState<boolean | null>(null);
  /** The engine Events of the latest turn, for presentation cues (audio). */
  const [lastEvents, setLastEvents] = useState<EventPayload[]>([]);

  const busy = useRef(false);
  const idRef = useRef<string | null>(null);
  const lastActivity = useRef(Date.now());
  const idleTicks = useRef(0);

  const open = useCallback((id: string | null, nextName: string) => {
    idRef.current = id;
    setInvestigationId(id);
    setName(nextName);
    remember(id);
  }, []);

  const refreshList = useCallback(async () => {
    try { setInvestigations(await InvestigationRepository.list()); }
    catch (err) { console.error('investigations list:', err); }
  }, []);

  /** Run one request; false when another is in flight or it was refused. */
  const run = useCallback(async (body: TurnBody, player?: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setIsBusy(true);
    setError(null);
    const isTick = 'tick' in body;
    if (!isTick) setPending({ player, text: '' });
    let resync = false;
    let ok = true;
    const onLine = (line: TurnLine) => {
      if (line.kind === 'events') {
        if ('start' in body) open(line.investigationId, body.start.name);
        setLastEvents(line.events);
      } else if (line.kind === 'text') {
        setPending(p => ({ player: p?.player, text: (p?.text ?? '') + line.delta }));
      } else if (line.kind === 'done') {
        setFeed(f => [...f, ...line.feed]);
        setView(line.view);
        setPending(null);
      } else if (line.kind === 'error') {
        // The server closed the turn with its Beats; fetch the canonical feed.
        resync = true;
        setError('The narration failed; the turn was recorded without it.');
      }
    };
    try {
      await postTurn(body, onLine);
      setEngineOk(true);
    } catch (err) {
      ok = false;
      // A refusal (busy, not found, signed out) is the endpoint answering; anything else is it not.
      setEngineOk(err instanceof TurnRefused && err.status < 500);
      setPending(null);
      if (err instanceof TurnRefused && err.status === 409) {
        if (!isTick) setError('The last turn is still being written. Try again in a moment.');
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      busy.current = false;
      setIsBusy(false);
      lastActivity.current = Date.now();
    }
    if (resync && idRef.current) {
      setPending(null);
      await resume(idRef.current); // eslint-disable-line @typescript-eslint/no-use-before-define
    }
    return ok;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Load an Investigation's whole feed and view. Read-only on the server. */
  const resume = useCallback(async (id: string): Promise<boolean> => {
    try {
      let got: Extract<TurnLine, { kind: 'resume' }> | null = null;
      await postTurn({ investigationId: id, resume: true }, line => { if (line.kind === 'resume') got = line; });
      const line = got as Extract<TurnLine, { kind: 'resume' }> | null;
      if (!line) return false;
      open(id, line.name);
      setFeed(line.feed);
      setView(line.view);
      setPending(null);
      setLastEvents([]);
      idleTicks.current = 0;
      lastActivity.current = Date.now();
      return true;
    } catch (err) {
      if (err instanceof TurnRefused && err.status === 404) {
        if (recall() === id) remember(null);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
  }, [open]);

  const start = useCallback(async (investigationName: string) => {
    setFeed([]);
    setView(null);
    idleTicks.current = 0;
    const ok = await run({ start: { storyId: DEFAULT_STORY, name: investigationName } });
    void refreshList();
    return ok;
  }, [run, refreshList]);

  const send = useCallback(async (text: string) => {
    if (!idRef.current) return;
    idleTicks.current = 0;
    await run({ investigationId: idRef.current, text }, text);
  }, [run]);

  const remove = useCallback(async (id: string) => {
    try {
      await InvestigationRepository.remove(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    if (id === idRef.current) {
      open(null, '');
      setFeed([]);
      setView(null);
    }
    await refreshList();
  }, [open, refreshList]);

  // A new user (sign-in, sign-out, a fresh guest): forget everything, list theirs, resume their last.
  // The remembered id is left alone here: it is what gets resumed below.
  useEffect(() => {
    idRef.current = null;
    setInvestigationId(null);
    setName('');
    setFeed([]);
    setView(null);
    setPending(null);
    setInvestigations([]);
    setIsReady(false);
    if (!userId) return;
    let cancelled = false;
    (async () => {
      await refreshList();
      const last = recall();
      if (last && !cancelled) await resume(last);
      if (!cancelled) setIsReady(true);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Idle Ticks.
  useEffect(() => {
    const onKey = () => { lastActivity.current = Date.now(); };
    window.addEventListener('keydown', onKey);
    const timer = window.setInterval(() => {
      if (!idRef.current || busy.current || document.visibilityState !== 'visible') return;
      if (idleTicks.current >= MAX_IDLE_TICKS || Date.now() - lastActivity.current < IDLE_TICK_MS) return;
      idleTicks.current++;
      void run({ investigationId: idRef.current, tick: true });
    }, IDLE_POLL_MS);
    return () => { window.removeEventListener('keydown', onKey); window.clearInterval(timer); };
  }, [run]);

  // No idle Ticks once the game has ended.
  useEffect(() => { if (view?.ended) idleTicks.current = MAX_IDLE_TICKS; }, [view?.ended]);

  return {
    investigationId, name, feed, pending, view, isBusy, investigations, error, isReady, lastEvents, engineOk,
    history: historyFrom(feed, pending),
    start, send, resume, remove, refreshList, clearError: () => setError(null),
  };
}

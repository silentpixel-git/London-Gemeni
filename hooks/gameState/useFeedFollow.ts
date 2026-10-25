/**
 * hooks/gameState/useFeedFollow.ts
 *
 * Keeps the typing line readable: new text fills the screen down to a follow
 * line (three-quarters of the feed, or just above the command dock if that is
 * higher), and only then does the feed scroll — by exactly the overshoot, so
 * prose moves up a line at a time instead of jumping to the bottom.
 *
 * The bottom padding is sized so the last line can always reach the follow
 * line. Following pauses when the reader scrolls back (wheel, touch, keys or
 * scrollbar) and resumes when they return to the end, or on the next command
 * or hint.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const FOLLOW_AT = 0.75;
const DOCK_GAP = 40; // clears the loading line that sits above the input

export function useFeedFollow(
  scrollRef: React.RefObject<HTMLDivElement>,
  contentRef: React.RefObject<HTMLDivElement>,
  dockRef: React.RefObject<HTMLElement>,
  historyLength: number,
) {
  const paused = useRef(false);
  const lastSetTop = useRef<number | null>(null); // scrollTop that follow() itself set

  const followLine = useCallback(() => {
    const feed = scrollRef.current;
    if (!feed) return 0;
    const f = feed.getBoundingClientRect();
    const line = f.top + f.height * FOLLOW_AT;
    const dock = dockRef.current;
    return dock ? Math.min(line, dock.getBoundingClientRect().top - DOCK_GAP) : line;
  }, [scrollRef, dockRef]);

  const follow = useCallback(() => {
    const feed = scrollRef.current;
    if (!feed || paused.current) return;
    const target = feed.querySelector<HTMLElement>('[data-caret]') ?? contentRef.current?.lastElementChild;
    if (!target) return;
    const over = target.getBoundingClientRect().bottom - followLine();
    if (over > 0) {
      feed.scrollTop += Math.ceil(over);
      lastSetTop.current = feed.scrollTop;
    }
  }, [scrollRef, contentRef, followLine]);

  // Bottom padding: enough for the last line to scroll up to the follow line.
  useEffect(() => {
    const feed = scrollRef.current;
    if (!feed) return;
    const sync = () => {
      const pad = feed.getBoundingClientRect().bottom - followLine();
      feed.style.paddingBottom = `${Math.max(0, Math.round(pad))}px`;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(feed);
    if (dockRef.current) ro.observe(dockRef.current);
    return () => ro.disconnect();
  }, [scrollRef, dockRef, followLine]);

  // The reader scrolling back wins over following, whatever the input. Scrolling
  // up from where follow() left the feed pauses; reaching the end again resumes.
  useEffect(() => {
    const feed = scrollRef.current;
    if (!feed) return;
    const onScroll = () => {
      const atEnd = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 2;
      if (atEnd) { paused.current = false; return; }
      if (lastSetTop.current !== null && feed.scrollTop < lastSetTop.current - 2) paused.current = true;
    };
    feed.addEventListener('scroll', onScroll, { passive: true });
    return () => feed.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  // A new command or hint: resume following and bring it into view.
  useLayoutEffect(() => {
    paused.current = false;
    lastSetTop.current = null; // a scene reset (scrollTo top) must not read as the reader scrolling back
    follow();
  }, [historyLength, follow]);

  return follow;
}

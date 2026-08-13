/**
 * THROWAWAY VERIFICATION HARNESS — not part of the app build.
 *
 * Drives the REAL TypewriterBlock against a simulated Gemini stream so the
 * caret placement and the 2.4x reveal rate can be verified without booting the
 * game. Served by the dev server at /prototypes/caret-check.html.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TypewriterBlock } from '../components/TypewriterBlock';

const PASSAGE = `The vellum-colored paper lay before me, its surface marred by a coarse, untidy hand that seemed to take a perverse pride in its own lack of refinement. I read the words 'From hell' at the head of the missive, my eyes tracing the jagged ink as the writer boasted of having fried and eaten the missing half of the kidney enclosed within the parcel.

"Observe the pressure of the nib, Watson," said Holmes, tilting the sheet toward the window. "He writes slowly, and he writes standing. A man at a desk does not gouge his paper so."

> *Somewhere east of the office, a church bell counts out eleven.*

**Objects of interest:** The Letter, The Parcel, Lusk's Ledger
**Possible exits:** Mile End Road, Whitechapel High Street`;

/** Chunk cadence approximating a live Gemini stream. */
function useSimulatedStream(full: string, runId: number) {
  const [text, setText] = useState('');
  const [streamMs, setStreamMs] = useState<number | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    setText('');
    setStreamMs(null);
    startedAt.current = performance.now();

    const step = () => {
      i = Math.min(full.length, i + Math.round(20 + Math.random() * 70));
      setText(full.slice(0, i));
      if (i >= full.length) {
        setStreamMs(Math.round(performance.now() - startedAt.current));
        return;
      }
      timer = setTimeout(step, 60 + Math.random() * 130);
    };

    timer = setTimeout(step, 700);
    return () => clearTimeout(timer);
  }, [full, runId]);

  return { text, streamMs, startedAt };
}

function Harness() {
  const [runId, setRunId] = useState(0);
  const { text, streamMs, startedAt } = useSimulatedStream(PASSAGE, runId);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const streamDone = text.length === PASSAGE.length;

  useEffect(() => { setRenderMs(null); }, [runId]);

  return (
    <div style={{ background: 'rgb(var(--lb-bg))', minHeight: '100vh', padding: '3rem 2rem' }}>
      <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem',
                      fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12,
                      color: 'rgb(var(--lb-muted))' }}>
          <button
            onClick={() => setRunId(n => n + 1)}
            style={{ background: '#111827', color: '#f9fafb', border: '1px solid #374151',
                     borderRadius: 999, padding: '0.35rem 0.9rem', font: 'inherit', cursor: 'pointer' }}
          >
            ⟳ replay
          </button>
          <span>
            real TypewriterBlock · stream {streamMs === null ? '…' : (streamMs / 1000).toFixed(1) + 's'}
            {' · render '}{renderMs === null ? '…' : (renderMs / 1000).toFixed(1) + 's'}
          </span>
        </div>

        <TypewriterBlock
          key={runId}
          text={text}
          isComplete={streamDone}
          onComplete={() => setRenderMs(m => m ?? Math.round(performance.now() - startedAt.current))}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);

# Diary Casebook Tabs + Lato Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `DiaryModal` as a four-tab casebook (Journal / Evidence / Persons / Documents) in the approved editorial style, and replace Open Sans with Lato as the app's sans-serif family.

**Architecture:** The diary stays a single read-only modal fed entirely by data the app already holds — no engine, hook, or persistence changes. Journal keeps the existing act-accordion; the three new tabs are pure derivations: Evidence from `entries` (kind `'clue'`) resolved against `CLUE_DEFINITIONS`, Persons from `PERSONS_OF_INTEREST` + `flags`, Documents from `inventory` mapped through `TAKEABLE_OBJECTS` → `DOCUMENT_TEXT`. Desktop gets a left "spine" with vertical thumb-tabs; mobile keeps the existing bottom-sheet (drag-to-close, slide-up entrance) with a horizontal tab ribbon under the header. The font swap is config-only (index.html + tailwind.config.js).

**Tech Stack:** React 19 + TypeScript, Tailwind (lb-* tokens), lucide-react. No test framework in this repo — each task verifies via `npm run lint` (tsc) plus a browser check on the dev server.

**Out of scope (explicitly):** the map modal (parked for a future session), any change to the main narrative feed typography, engine/story data, and Supabase.

**Design reference:** the approved mockup (artifact "London Bleeds — Satchel UI Mockup", iteration 7): marginalia ledger rows, no card/pill "soup", Playfair Display for headings/numerals only, Lato for all running text, cleared POI names struck through in crimson, documents stacked like evidence (never side-by-side).

**Commit note:** GPG signing fails in this shell (pinentry has no TTY). Ask the user before each commit and offer `--no-gpg-sign` (their stated preference).

---

## File Structure

- Modify: `index.html` — Google Fonts `@import` (swap Open Sans → Lato)
- Modify: `tailwind.config.js` — `fontFamily.sans`
- Modify: `constants.ts` — font-token comment
- Modify: `components/DiaryModal.tsx` — the whole feature; stays one file (follows repo convention of one component per file; ~450 lines after change, acceptable)
- Modify: `App.tsx` — pass `inventory` prop to `DiaryModal`

No new files. No test files (repo has no unit-test framework; `npm run lint` is the only automated gate).

---

### Task 1: Swap Open Sans → Lato

**Files:**
- Modify: `index.html:8`
- Modify: `tailwind.config.js:25`
- Modify: `constants.ts:7`

- [ ] **Step 1: Replace the Google Fonts import in `index.html`**

Replace the existing `@import` line (inside the `<style>` block in `<head>`):

```css
@import url('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Playfair:ital,wght@0,400;1,400&family=Patrick+Hand&display=swap');
```

Only the Open Sans segment changes; Playfair Display, Playfair, and Patrick Hand stay untouched. Note Lato has **no 600 weight** — the repo's 19 `font-semibold` usages will resolve to Lato 700 (slightly heavier than before). This is accepted; do not chase down `font-semibold` usages in this task.

- [ ] **Step 2: Update the Tailwind `sans` token in `tailwind.config.js`**

```js
      fontFamily: {
        sans:     ['"Lato"', 'sans-serif'],
        serif:    ['"Playfair Display"', 'serif'],
        playfair: ['"Playfair"', 'serif'],
      },
```

- [ ] **Step 3: Update the font-token comment in `constants.ts`**

Change line 7 from:

```ts
 * Font tokens:  font-sans (Open Sans), font-serif (Playfair Display)
```

to:

```ts
 * Font tokens:  font-sans (Lato), font-serif (Playfair Display)
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: exit 0, no output (tsc clean — nothing type-level changed).

Start the dev server (`npm run dev`, port 3000) and confirm in the browser that body text renders in Lato (humanist `g`/`a`, true italic in the command echoes) and nothing falls back to Times (a fallback serif body means the import line has a typo).

- [ ] **Step 5: Commit** (ask the user first; offer `--no-gpg-sign`)

```bash
git add index.html tailwind.config.js constants.ts
git commit --no-gpg-sign -m "feat(ui): swap Open Sans for Lato as the sans-serif family"
```

---

### Task 2: DiaryModal shell — spine, tabs, Journal panel

Restructure `components/DiaryModal.tsx` into the casebook shell. Journal content (the existing act-accordion) is preserved verbatim, just moved inside a tab panel. All existing behaviors are kept: ESC to close, body-scroll lock, mobile bottom-sheet entrance, drag-to-close, `newEntryIds` badges, leads pills.

**Files:**
- Modify: `components/DiaryModal.tsx`

- [ ] **Step 1: Add the tab type, tab state, and reset-on-open**

Below the existing imports/props, add:

```tsx
type DiaryTab = 'journal' | 'evidence' | 'persons' | 'documents';

const TABS: { id: DiaryTab; label: string }[] = [
  { id: 'journal',   label: 'Journal' },
  { id: 'evidence',  label: 'Evidence' },
  { id: 'persons',   label: 'Persons' },
  { id: 'documents', label: 'Documents' },
];
```

Inside the component, alongside `openAct`:

```tsx
const [activeTab, setActiveTab] = useState<DiaryTab>('journal');
```

And extend the existing open-effect so the diary always opens on Journal:

```tsx
useEffect(() => {
  if (isOpen) {
    setOpenAct(currentAct);
    setActiveTab('journal');
  }
}, [isOpen, currentAct]);
```

- [ ] **Step 2: Restructure the sheet layout**

Replace everything between the drag handle and the closing of the sheet `<div>` with the two-region layout. The existing header row becomes mobile-only; desktop gets the spine. The current entries block (act accordion, `actNumbers.map(...)`, empty-state paragraph, bottom fade) moves wholesale into the `journal` panel — do not rewrite its internals.

```tsx
{/* Mobile header (drag target) */}
<div
  className="flex sm:hidden items-center justify-between px-6 py-4 border-b border-lb-border"
  onTouchStart={handleDragStart}
  onTouchMove={handleDragMove}
  onTouchEnd={handleDragEnd}
>
  <span className="font-serif text-xl font-bold text-lb-primary">Watson's Diary</span>
  <button onClick={onClose} className="p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-bg rounded-md transition-colors" aria-label="Close">
    <X size={22} />
  </button>
</div>

{/* Mobile tab ribbon */}
<div className="flex sm:hidden border-b border-lb-border overflow-x-auto" role="tablist">
  {TABS.map(t => (
    <button
      key={t.id}
      role="tab"
      aria-selected={activeTab === t.id}
      onClick={() => setActiveTab(t.id)}
      className={`shrink-0 px-4 py-3 uppercase tracking-widest text-[11px] font-bold border-b-2 -mb-px transition-colors ${
        activeTab === t.id ? 'text-lb-accent border-lb-accent' : 'text-lb-muted border-transparent hover:text-lb-primary'
      }`}
    >
      {t.label}
    </button>
  ))}
</div>

<div className="flex flex-1 min-h-0">
  {/* Desktop spine */}
  <div className="hidden sm:flex w-44 shrink-0 flex-col border-r border-lb-border bg-lb-primary/[0.04] pt-6 pb-4">
    <div className="px-5 pb-5">
      <h2 className="font-serif text-2xl font-bold leading-tight text-lb-primary">Watson's<br />Diary</h2>
      <p className="mt-2 uppercase tracking-[0.2em] text-[10px] text-lb-muted">Whitechapel · 1888</p>
    </div>
    <div className="flex flex-col" role="tablist">
      {TABS.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={activeTab === t.id}
          onClick={() => setActiveTab(t.id)}
          className={`text-left px-5 py-3 border-l-[3px] uppercase tracking-widest text-[11px] font-bold transition-colors ${
            activeTab === t.id
              ? 'text-lb-primary border-lb-accent bg-lb-paper'
              : 'text-lb-muted border-transparent hover:text-lb-primary'
          }`}
        >
          {t.label}
          <span className="block normal-case tracking-normal font-normal text-[11px] opacity-70 mt-0.5">
            {tabCount(t.id)}
          </span>
        </button>
      ))}
    </div>
    <p className="mt-auto px-5 pt-4 text-[11px] italic text-lb-muted leading-relaxed">
      What he notices here is his own affair.
    </p>
  </div>

  {/* Panel */}
  <div className="relative flex-1 min-h-0 flex flex-col">
    <button
      onClick={onClose}
      className="hidden sm:block absolute top-3 right-3 z-20 p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-bg rounded-md transition-colors"
      aria-label="Close"
    >
      <X size={22} />
    </button>
    <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-5 sm:pt-6">
      {activeTab === 'journal' && ( /* existing accordion block, moved here unchanged */ )}
      {activeTab === 'evidence' && <EvidencePanel entries={entries} />}
      {activeTab === 'persons' && <PersonsPanel flags={flags} />}
      {activeTab === 'documents' && <DocumentsPanel inventory={inventory} />}
    </div>
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-lb-paper to-transparent sm:rounded-b-xl" />
  </div>
</div>
```

The three `*Panel` components and `tabCount` are defined in Tasks 3–5; for this task, stub them so the file compiles:

```tsx
const EvidencePanel: React.FC<{ entries: DiaryEntry[] }> = () => null;
const PersonsPanel: React.FC<{ flags: Record<string, boolean> }> = () => null;
const DocumentsPanel: React.FC<{ inventory: string[] }> = () => null;
```

and inside the component:

```tsx
const tabCount = (tab: DiaryTab): string => {
  switch (tab) {
    case 'journal':   return `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    case 'evidence':  return '';   // filled in Task 3
    case 'persons':   return '';   // filled in Task 4
    case 'documents': return '';   // filled in Task 5
  }
};
```

- [ ] **Step 3: Add the `inventory` prop**

Extend the props interface (it is consumed in Task 5, but wiring it now keeps `App.tsx` a one-touch change):

```tsx
interface DiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: DiaryEntry[];
  currentAct: number;
  flags: Record<string, boolean>;
  inventory: string[];
  newEntryIds?: Set<string>;
}
```

In `App.tsx` (the `<DiaryModal>` usage around line 249), add:

```tsx
inventory={gs.inventory}
```

- [ ] **Step 4: Update the file's doc comment**

Rewrite the header comment at the top of `DiaryModal.tsx` to describe the casebook: four tabs (Journal = auto-captured act accordion; Evidence = discovered-clue ledger; Persons = suspect ledger mirroring the NOTEBOOK verb; Documents = carried papers, verbatim), desktop spine / mobile ribbon, read-only.

- [ ] **Step 5: Verify**

Run: `npm run lint`
Expected: exit 0.

In the browser (dev server): open the diary — desktop shows the spine with four tabs, Journal renders the accordion exactly as before (leads pills, New badges, expand/collapse). The other three tabs render empty. Narrow the window below 640px: header row + horizontal ribbon appear, spine hides, drag-down still closes the sheet, ESC still closes.

- [ ] **Step 6: Commit** (ask the user first; offer `--no-gpg-sign`)

```bash
git add components/DiaryModal.tsx App.tsx
git commit --no-gpg-sign -m "feat(diary): casebook shell — spine/ribbon tabs, Journal panel"
```

---

### Task 3: Evidence panel — the marginalia ledger

Evidence is derived from the diary entries the engine already captures (`kind === 'clue'`, `refId` = clue id) — this works for guests too, since it never touches Supabase.

**Files:**
- Modify: `components/DiaryModal.tsx`

- [ ] **Step 1: Extend imports**

```tsx
import { resolveDiaryEntry, ACT_NAMES, ACT_PROGRESSION, CLUE_DEFINITIONS, LOCATIONS } from '../engine/gameData';
```

- [ ] **Step 2: Add the roman-numeral helper (module scope)**

```tsx
/** 1 → "I", 4 → "IV" … supports the full clue count (≤ 20). */
const roman = (n: number): string => {
  const map: Array<[number, string]> = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
};
```

- [ ] **Step 3: Implement `EvidencePanel`** (replaces the Task 2 stub)

```tsx
const EvidencePanel: React.FC<{ entries: DiaryEntry[] }> = ({ entries }) => {
  // Discovered clues, newest first. Numbering is chronological (oldest = No. I).
  const clues = entries
    .filter(e => e.kind === 'clue' && CLUE_DEFINITIONS[e.refId])
    .sort((a, b) => b.sequence - a.sequence);

  if (clues.length === 0) {
    return (
      <p className="text-[15px] text-lb-muted font-serif italic py-8 text-center">
        No evidence formally recorded yet.
      </p>
    );
  }

  return (
    <div>
      <p className="uppercase tracking-widest text-[11px] font-bold text-lb-accent mb-1">Case Notes</p>
      <h3 className="font-serif text-2xl font-bold text-lb-primary mb-2">Evidence</h3>
      {clues.map((entry, i) => {
        const def = CLUE_DEFINITIONS[entry.refId];
        const where = LOCATIONS[def.locationFound]?.name ?? def.locationFound;
        return (
          <div
            key={entry.id}
            className={`grid grid-cols-1 sm:grid-cols-[6.5rem_1fr] gap-1 sm:gap-5 py-4 ${i > 0 ? 'border-t border-lb-border' : ''}`}
          >
            <div className="sm:text-right pt-0.5">
              <span className="font-serif italic text-lb-accent">No. {roman(clues.length - i)}</span>
              <span className="block uppercase tracking-wider text-[10px] text-lb-muted mt-1 leading-relaxed">
                {where}
                {entry.timeLabel && <><br />{entry.timeLabel}</>}
              </span>
            </div>
            <div>
              <h4 className="font-serif text-lg font-bold text-lb-primary mb-1">{def.name}</h4>
              <p className="text-[15px] text-lb-primary/90 leading-relaxed">{def.diaryNote}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Fill in the evidence tab count** in `tabCount`:

```tsx
case 'evidence': {
  const n = entries.filter(e => e.kind === 'clue' && CLUE_DEFINITIONS[e.refId]).length;
  return `${n} recorded`;
}
```

- [ ] **Step 5: Verify**

Run: `npm run lint` — exit 0.

Browser: start a new game, examine the case files wall at Baker Street (grants clue_00), open the diary → Evidence tab shows "No. I / 221B Baker Street / <clock>" beside "The Silence Since September" with its diary note. Spine shows "1 recorded".

- [ ] **Step 6: Commit** (ask the user first; offer `--no-gpg-sign`)

```bash
git add components/DiaryModal.tsx
git commit --no-gpg-sign -m "feat(diary): Evidence tab — marginalia clue ledger"
```

---

### Task 4: Persons of Interest panel — the ruled ledger

Mirrors the engine's NOTEBOOK verb (`resolveNotebook` in `engine/resolvers/deduce.ts`): a POI appears once its `requiresFlag` is set; a cleared POI (its `clearedByFlag` set) is struck through with its `clearedNote`. Edmund is never listed pre-convergence by authored design — this panel must not invent anything beyond `PERSONS_OF_INTEREST`.

**Files:**
- Modify: `components/DiaryModal.tsx`

- [ ] **Step 1: Extend imports**

```tsx
import { PERSONS_OF_INTEREST } from '../engine/gameData';
```

(Already exported from `engine/gameData.ts:49`.)

- [ ] **Step 2: Implement `PersonsPanel`** (replaces the stub)

```tsx
const PersonsPanel: React.FC<{ flags: Record<string, boolean> }> = ({ flags }) => {
  const visible = PERSONS_OF_INTEREST.filter(p => !p.requiresFlag || flags[p.requiresFlag]);

  if (visible.length === 0) {
    return (
      <p className="text-[15px] text-lb-muted font-serif italic py-8 text-center">
        Watson has no names in his ledger yet.
      </p>
    );
  }

  return (
    <div>
      <p className="uppercase tracking-widest text-[11px] font-bold text-lb-accent mb-1">The Running Ledger</p>
      <h3 className="font-serif text-2xl font-bold text-lb-primary mb-2">Persons of Interest</h3>
      {visible.map((p, i) => {
        const cleared = Boolean(p.clearedByFlag && flags[p.clearedByFlag]);
        return (
          <div key={p.id} className={`py-4 ${i > 0 ? 'border-t border-lb-border' : ''}`}>
            <div className="flex items-baseline justify-between gap-4">
              <span
                className={`font-serif text-lg font-bold ${
                  cleared
                    ? 'text-lb-primary/55 line-through decoration-red-800/70 decoration-[1.5px]'
                    : 'text-lb-primary'
                }`}
              >
                {p.label}
              </span>
              <span
                className={`shrink-0 uppercase tracking-[0.2em] text-[10px] font-bold ${
                  cleared ? 'text-red-800/70' : 'text-lb-accent'
                }`}
              >
                {cleared ? 'Cleared' : 'Open'}
              </span>
            </div>
            <p className={`mt-1 text-[15px] leading-relaxed ${cleared ? 'text-lb-primary/55' : 'text-lb-primary/85'}`}>
              {cleared && p.clearedNote ? p.clearedNote : p.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
};
```

(The crimson uses Tailwind's stock `red-800` — there is no lb-* red token, and adding one is out of scope; `red-800/70` reads as ink in both themes.)

- [ ] **Step 3: Fill in the persons tab count** in `tabCount`:

```tsx
case 'persons': {
  const visible = PERSONS_OF_INTEREST.filter(p => !p.requiresFlag || flags[p.requiresFlag]);
  const cleared = visible.filter(p => p.clearedByFlag && flags[p.clearedByFlag]).length;
  return visible.length === 0 ? 'none yet' : `${cleared} cleared, ${visible.length - cleared} open`;
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint` — exit 0.

Browser: a fresh game shows whichever POIs have no `requiresFlag` (check against `PERSONS_OF_INTEREST` in `engine/stories/whitechapel-1888/suspects.ts` — entries gated on progression flags stay hidden). Progress far enough to set a `requiresFlag` (or temporarily verify by loading a mid-game save) and confirm new rows appear, and that a cleared POI renders struck-through with its `clearedNote`.

- [ ] **Step 5: Commit** (ask the user first; offer `--no-gpg-sign`)

```bash
git add components/DiaryModal.tsx
git commit --no-gpg-sign -m "feat(diary): Persons of Interest tab — suspect ledger"
```

---

### Task 5: Documents panel — carried papers, verbatim

Documents = inventory items that map to an entry in `DOCUMENT_TEXT`. `TAKEABLE_OBJECTS` (objectId → display name, `engine/stories/whitechapel-1888/clues.ts:456`) is inverted to find each carried item's object id. Items without document text (e.g. "Kidney Examination Notes") are simply not listed — this tab is for readable papers, not a bag manifest (the sidebar already shows the bag).

**Files:**
- Modify: `components/DiaryModal.tsx`

- [ ] **Step 1: Extend imports**

```tsx
import { TAKEABLE_OBJECTS, DOCUMENT_TEXT } from '../engine/gameData';
```

- [ ] **Step 2: Implement `DocumentsPanel`** (replaces the stub)

`DOCUMENT_TEXT` values use `*...*` around caption/heading lines (see `from_hell_letter`). Render those lines as small-caps captions; everything else as italic body. Blank lines separate paragraphs.

```tsx
/** Display name → object id, for looking up carried items in DOCUMENT_TEXT. */
const OBJECT_ID_BY_DISPLAY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(TAKEABLE_OBJECTS).map(([id, name]) => [name, id]),
);

const DocumentsPanel: React.FC<{ inventory: string[] }> = ({ inventory }) => {
  const docs = inventory
    .map(name => ({ name, objectId: OBJECT_ID_BY_DISPLAY_NAME[name] }))
    .filter((d): d is { name: string; objectId: string } => Boolean(d.objectId && DOCUMENT_TEXT[d.objectId]));

  if (docs.length === 0) {
    return (
      <p className="text-[15px] text-lb-muted font-serif italic py-8 text-center">
        Watson carries no papers worth rereading.
      </p>
    );
  }

  return (
    <div>
      <p className="uppercase tracking-widest text-[11px] font-bold text-lb-accent mb-1">Carried in the Medical Bag</p>
      <h3 className="font-serif text-2xl font-bold text-lb-primary mb-2">Documents</h3>
      {docs.map((doc, i) => (
        <div key={doc.objectId} className={`py-4 ${i > 0 ? 'border-t border-lb-border' : ''}`}>
          <h4 className="font-serif text-lg font-bold text-lb-primary mb-2">{doc.name}</h4>
          <div className="space-y-2">
            {DOCUMENT_TEXT[doc.objectId].split('\n').map((line, j) => {
              const trimmed = line.trim();
              if (trimmed === '') return null;
              const caption = trimmed.match(/^\*(.+)\*$/);
              return caption ? (
                <p key={j} className="uppercase tracking-wider text-[10px] text-lb-muted">{caption[1]}</p>
              ) : (
                <p key={j} className="italic text-[15px] text-lb-primary/90 leading-relaxed">{trimmed}</p>
              );
            })}
          </div>
        </div>
      ))}
      <p className="mt-5 pt-4 border-t border-lb-border text-[13px] italic text-lb-muted">
        Verbatim copies, in Watson's hand. He may read them as often as he likes.
      </p>
    </div>
  );
};
```

**Fair-play guardrail:** render document text exactly as authored — no highlighting, annotation, or emphasis of any word (the "prasarved" convergence belongs to the player; see game-direction: nothing may spoil or pre-announce it).

- [ ] **Step 3: Fill in the documents tab count** in `tabCount`:

```tsx
case 'documents': {
  const n = inventory.filter(name => {
    const id = OBJECT_ID_BY_DISPLAY_NAME[name];
    return id && DOCUMENT_TEXT[id];
  }).length;
  return `${n} carried`;
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint` — exit 0.

Browser: examine the newspaper pile in the prologue (grants the "Dear Boss" clipping — no `DOCUMENT_TEXT`, so Documents stays empty and shows the empty-state line: correct). Load or play to Act 4+, take the From Hell letter, open Documents → the letter renders with its caption line ("From Hell.") styling and italic body, unmodified spelling, no emphasis anywhere. Spine count reads "1 carried".

- [ ] **Step 5: Commit** (ask the user first; offer `--no-gpg-sign`)

```bash
git add components/DiaryModal.tsx
git commit --no-gpg-sign -m "feat(diary): Documents tab — carried papers, verbatim"
```

---

### Task 6: Final verification pass

- [ ] **Step 1: Full lint + QA suites**

Run: `npm run qa:all`
Expected: all suites pass (nothing in this plan touches engine/story data, so a failure means an accidental edit — investigate before proceeding).

- [ ] **Step 2: Cross-state browser sweep**

On the dev server, verify each of:
1. Fresh game (guest, signed out): all four tabs render; Evidence/Documents show empty states; no console errors.
2. Mid-game save (signed in): Evidence numbering ascends chronologically (oldest = No. I); Persons shows gated entries and struck-through cleared ones; Documents lists only text-backed papers.
3. Mobile width (<640px): ribbon scrolls horizontally, active tab underlined, drag-down closes, ESC closes, entrance slide-up plays.
4. Dark theme + dusk/midnight palettes (Settings): spine, ledger rules, and red strike-through remain legible in all four palettes.
5. `newEntryIds` badge: trigger a clue, reopen diary — "New" still appears on the Journal entry.

- [ ] **Step 3: Live playtest (required)**

Per project experience, automated review misses what a playtest finds: play the prologue start-to-finish with the diary open between actions, watching for anything the tabs get wrong mid-flow (counts lagging, entries missing, tab state surviving close/reopen).

- [ ] **Step 4: Dispatch the `engineering-reviewer` subagent** on the diff (component + config changes) before merging, per CLAUDE.md.

- [ ] **Step 5: Branch/PR** (ask the user how they want it: this repo's convention is a feature branch + PR to `main`, e.g. `feat/diary-casebook-tabs`)

---

## Self-Review Notes

- **Spec coverage:** tabs + content (Tasks 2–5), Lato swap (Task 1), no map (excluded), no main-feed typography change (excluded per user's final scope).
- **Guest-mode correctness:** Evidence deliberately derives from `entries` rather than `discoveredClueIds` — the latter is fetched from Supabase per-turn and is empty for guests (`hooks/useGameState.ts:381`).
- **Type consistency:** `EvidencePanel({ entries })`, `PersonsPanel({ flags })`, `DocumentsPanel({ inventory })` match the stubs in Task 2; `tabCount` cases are filled in the same task that adds each data source.
- **Known accepted trade-offs:** `font-semibold` renders as Lato 700 (no 600 cut exists); Tailwind stock `red-800` for the ledger strike (no lb red token); Documents omits carried items without authored text.

# Header/Sidebar Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move "Read Watson's Diary" from the sidebar into the top bar as an icon-only button next to the profile/gear controls, and add a new "Objects of Interest" section to the sidebar.

**Architecture:** Pure presentational changes to two existing components (`components/Sidebar.tsx`, `components/Header.tsx`) plus prop rewiring in `App.tsx`. No new engine state, no new data plumbing — "Objects of Interest" is computed the same way the sidebar already computes its exits list (a local lookup against `LOCATIONS[location].interactables`, mapped through the existing `OBJECT_DISPLAY_NAMES` table). No backend/API changes.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS with `lb-*` design tokens (`index.css`), `lucide-react` icons.

**Out of scope (backlog only, no code):** custom/AI-generated avatar images. Explored during mockups but explicitly deferred — do not touch avatar image handling in this plan.

---

## Locked design decisions this plan implements

1. **Sidebar section order:** Current Location → Medical Bag → Present in Location → **Objects of Interest (new)** → Avenues. The "Read Watson's Diary" button is removed from the sidebar entirely.
2. **Objects of Interest:** a static, non-interactive list (same bullet-dot style as the other sidebar sections) sourced from `LOCATIONS[location].interactables`, mapped to display names via `OBJECT_DISPLAY_NAMES` — identical data to what already appears in the narration text as "**Objects of interest:** ...".
3. **Top bar:** icon-only — diary button and profile/gear control, no visible name/role text. Name and role live only inside the profile dropdown (which already renders them under "Signed In As" — no change needed there).
4. **Diary icon button:** 40×40px circle, 2px outline (`border-lb-primary/30`), transparent fill, `BookOpenText` icon (20px) centered, hover state switches to accent color. Sits immediately left of the profile avatar (signed-in) or immediately left of the gear icon (guest).
5. **Notification badge:** solid `bg-lb-accent` circle, no ring/border, positioned at the top-right corner of the diary icon (not clipped — button must NOT have `overflow-hidden`). Shows the unread count, capped at "9+" for counts above 9. Hidden entirely when count is 0.
6. **Icon sizing parity:** profile avatar and sidebar-toggle button both bumped from 32px to the same 40×40px footprint as the diary icon, so all three controls in the header row are visually aligned.

---

## File Structure

- Modify: `components/Sidebar.tsx` — remove diary button + its props, reorder sections, add Objects of Interest section.
- Modify: `components/Header.tsx` — add diary icon button (shared between guest/signed-in layouts), remove inline name/role text, resize sidebar-toggle and profile-avatar controls to 40px.
- Modify: `App.tsx` — move `onOpenDiary`/`diaryUnreadCount` prop-passing from `<Sidebar>` to `<Header>`.

No new files. No test files — this codebase has no component test framework (`npm run lint` = `tsc --noEmit` is the only automated check; there is no vitest/jest setup and no existing `.test.tsx` files anywhere in the repo). Verification is via `npm run lint` (catches prop/type mismatches) plus manual visual checks in the running dev server, consistent with how UI changes are already verified in this project.

---

### Task 1: Remove diary button from Sidebar, reorder sections, add Objects of Interest

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Update the icon imports**

Replace the lucide-react import line (currently line 9):

```tsx
import { MapPin, Briefcase, DoorOpen, User, ScrollText, Feather, X, CloudFog, CloudDrizzle, CloudRain, Cloudy, Moon, type LucideIcon } from 'lucide-react';
```

with:

```tsx
import { MapPin, Briefcase, DoorOpen, User, Search, X, CloudFog, CloudDrizzle, CloudRain, Cloudy, Moon, type LucideIcon } from 'lucide-react';
```

(`ScrollText` and `Feather` were only used by the diary button being removed; `Search` is the new Objects of Interest section icon.)

- [ ] **Step 2: Import `OBJECT_DISPLAY_NAMES`**

Replace the gameData import line (currently line 10):

```tsx
import { LOCATIONS, NPCS, NPC_ALIASES } from '../engine/gameData';
```

with:

```tsx
import { LOCATIONS, NPCS, NPC_ALIASES, OBJECT_DISPLAY_NAMES } from '../engine/gameData';
```

- [ ] **Step 3: Remove `onOpenDiary` and `diaryUnreadCount` from `SidebarProps`**

In the `SidebarProps` interface, delete these two lines:

```tsx
  onOpenDiary: () => void;
  diaryUnreadCount: number;
```

- [ ] **Step 4: Remove the same two props from the destructured function signature**

In the `Sidebar` component's prop destructuring, delete these two lines:

```tsx
  onOpenDiary,
  diaryUnreadCount,
```

- [ ] **Step 5: Compute the Objects of Interest list**

Directly below the existing `visibleExits` computation (which reads `LOCATIONS[location]?.exits`), add:

```tsx
  // Objects of interest — same source data the narration line "**Objects of
  // interest:** ..." is built from (engine/GameEngine.ts buildContext()).
  const visibleObjects = (LOCATIONS[location]?.interactables || []).map(
    id => OBJECT_DISPLAY_NAMES[id] || id
  );
```

- [ ] **Step 6: Move the "Present NPCs" block before the "Available exits" block**

Currently the JSX order is: Current Location → Inventory → Available exits → Present NPCs → Diary button. Cut the entire "Present NPCs" `<div className="mb-8">...</div>` block (the one containing `<User size={18} />` and `presentNpcs.map`) and paste it so it comes immediately after the Inventory block and immediately before the "Available exits" block. Do not change the content of this block — only its position.

- [ ] **Step 7: Insert the new Objects of Interest section between NPCs and Avenues**

Immediately after the "Present NPCs" block (now positioned per Step 6) and immediately before the "Available exits" block, insert:

```tsx
        {/* Objects of interest — a reminder of what's in the current scene,
            mirrored from the narration text. Static list, not interactive. */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-lb-accent mb-4">
            <Search size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Objects of Interest</span>
          </div>
          {visibleObjects.length > 0 ? (
            <ul className="space-y-3">
              {visibleObjects.map((name, idx) => (
                <li key={idx} className="flex items-center gap-3 text-lb-primary opacity-90">
                  <div className="w-1.5 h-1.5 rounded-full bg-lb-accent" />
                  <span className="font-sans text-md">{name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-sans text-sm text-lb-primary opacity-70 italic">Nothing here catches the eye.</p>
          )}
        </div>
```

- [ ] **Step 8: Delete the "Watson's Diary" block entirely**

Delete the whole block (the comment, the wrapping `<div className="mb-8">`, and the IIFE button inside it) that starts with:

```tsx
        {/* Watson's Diary — opens the casebook modal. When there's a fresh entry
```

and ends with the button's closing `</div>` right before the outer `</div>\n\n      </div>\n    </div>\n  );` that closes the scrollable panel. After deletion, the scrollable content `<div>` should close directly after the Avenues (exits) section — there is no section after Avenues anymore.

- [ ] **Step 9: Type-check**

Run: `npm run lint`
Expected: no errors. If TypeScript complains about `visibleObjects` being unused or about missing props, re-check Steps 3-7 for a mismatched name.

- [ ] **Step 10: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "refactor(sidebar): remove diary button, reorder sections, add Objects of Interest"
```

---

### Task 2: Move diary + gear/avatar into an icon-only top bar row

**Files:**
- Modify: `components/Header.tsx`

- [ ] **Step 1: Add the `BookOpenText` icon import**

Replace the lucide-react import block (currently lines 15-19):

```tsx
import {
  PanelLeftClose, PanelLeftOpen, User as UserIcon,
  ChevronDown, ChevronLeft, ChevronRight, Save, FolderOpen, LogOut, LogIn, Pencil, RefreshCw,
  Settings,
} from 'lucide-react';
```

with:

```tsx
import {
  PanelLeftClose, PanelLeftOpen, User as UserIcon,
  ChevronDown, ChevronLeft, ChevronRight, Save, FolderOpen, LogOut, LogIn, Pencil, RefreshCw,
  Settings, BookOpenText,
} from 'lucide-react';
```

- [ ] **Step 2: Add `onOpenDiary` and `diaryUnreadCount` to `HeaderProps`**

In the `HeaderProps` interface, immediately after the `onRetryConnection: () => void;` line, add:

```tsx
  onOpenDiary: () => void;
  diaryUnreadCount: number;
```

- [ ] **Step 3: Destructure the two new props**

In the `Header` component's prop destructuring, immediately after `onRetryConnection,`, add:

```tsx
  onOpenDiary,
  diaryUnreadCount,
```

- [ ] **Step 4: Build the shared diary button JSX**

Immediately before the `return (` statement in the `Header` component body, add:

```tsx
  // Shared between the guest and signed-in layouts below — a plain JSX
  // value (not a nested component) so it doesn't remount on every render.
  const hasNewDiaryEntries = diaryUnreadCount > 0;
  const diaryButton = (
    <button
      onClick={onOpenDiary}
      className="relative w-10 h-10 rounded-full border-2 border-lb-primary/30 text-lb-primary flex items-center justify-center shrink-0 hover:border-lb-accent hover:text-lb-accent transition-colors"
      title="Read Watson's Diary"
      aria-label={hasNewDiaryEntries ? `Read Watson's Diary — ${diaryUnreadCount} new ${diaryUnreadCount === 1 ? 'entry' : 'entries'}` : "Read Watson's Diary"}
    >
      <BookOpenText size={20} />
      {hasNewDiaryEntries && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-lb-accent text-white text-[10px] font-bold leading-none">
          {diaryUnreadCount > 9 ? '9+' : diaryUnreadCount}
        </span>
      )}
    </button>
  );
```

- [ ] **Step 5: Resize the sidebar-toggle button to a matching 40px circle**

Replace (currently lines 87-92):

```tsx
        <button
          onClick={onToggleSidebar}
          className="p-2 text-lb-primary hover:bg-lb-primary/5 rounded-md"
        >
          {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
```

with:

```tsx
        <button
          onClick={onToggleSidebar}
          className="w-10 h-10 flex items-center justify-center text-lb-primary hover:bg-lb-primary/5 rounded-full shrink-0"
        >
          {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
```

- [ ] **Step 6: Add the diary button to the guest (unauthenticated) layout**

Replace (currently around lines 158-169, the opening of the `{!user && (...)}` block):

```tsx
        {!user && (
          <>
            <div className="relative">
              <button
                onClick={() => setIsGuestSettingsOpen(o => !o)}
                className="p-2 text-lb-muted hover:text-lb-accent hover:bg-lb-primary/5 rounded-md transition-colors"
                title="Settings"
                aria-label="Settings"
                aria-expanded={isGuestSettingsOpen}
              >
                <Settings size={18} />
              </button>
```

with:

```tsx
        {!user && (
          <>
            {diaryButton}
            <div className="relative">
              <button
                onClick={() => setIsGuestSettingsOpen(o => !o)}
                className="p-2 text-lb-muted hover:text-lb-accent hover:bg-lb-primary/5 rounded-md transition-colors"
                title="Settings"
                aria-label="Settings"
                aria-expanded={isGuestSettingsOpen}
              >
                <Settings size={18} />
              </button>
```

- [ ] **Step 7: Replace the signed-in profile trigger — icon-only, 40px avatar, diary button before it**

Replace (currently lines 197-227):

```tsx
        {user && (
          <div className="relative">
            <button
              onClick={() => { setIsProfileMenuOpen(o => !o); setIsConfirmingNewGame(false); setSettingsView(false); }}
              className="flex items-center gap-3 text-lb-primary group"
            >
              <div className="text-right hidden sm:block">
                <span className="block text-sm font-bold group-hover:text-lb-accent truncate max-w-[140px]">
                  {displayName}
                </span>
                <span className="text-[10px] uppercase tracking-widest opacity-60">
                  {displayRole}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-lb-primary text-lb-bg flex items-center justify-center overflow-hidden shrink-0">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon size={16} />
                )}
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
```

with:

```tsx
        {user && (
          <div className="flex items-center gap-3">
            {diaryButton}
            <div className="relative">
              <button
                onClick={() => { setIsProfileMenuOpen(o => !o); setIsConfirmingNewGame(false); setSettingsView(false); }}
                className="flex items-center gap-2 text-lb-primary group"
              >
                <div className="w-10 h-10 rounded-full bg-lb-primary text-lb-bg flex items-center justify-center overflow-hidden shrink-0">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon size={18} />
                  )}
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>
```

Note: `displayName` and `displayRole` are still used further down inside the dropdown's "Signed In As" block (around line 240) — do not remove those `const` declarations, only this inline text block.

- [ ] **Step 8: Close the two newly-opened wrapper `div`s**

The signed-in branch's JSX tree now has two extra opening `<div>`s from Step 7 (`<div className="flex items-center gap-3">` and `<div className="relative">`) that replaced a single `<div className="relative">`. Find the closing of this branch — currently:

```tsx
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
```

Replace with:

```tsx
                  </div>
                </div>
              </>
            )}
            </div>
          </div>
        )}
      </div>
    </header>
```

(This adds one extra closing `</div>` to match the extra wrapper opened in Step 7 — the outer one closes the `flex items-center gap-3` wrapper around `diaryButton` + the profile `relative` block.)

- [ ] **Step 9: Type-check**

Run: `npm run lint`
Expected: no errors, in particular no unbalanced-JSX errors. If you see "JSX element has no corresponding closing tag," recount the `<div>` nesting introduced in Steps 7-8 — this is the step most likely to have a mismatched tag.

- [ ] **Step 10: Commit**

```bash
git add components/Header.tsx
git commit -m "feat(header): add icon-only diary button, resize toggle/avatar to 40px"
```

---

### Task 3: Wire the diary props from App.tsx into Header instead of Sidebar

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Remove the diary props from the `<Sidebar>` call**

Replace (currently lines 151-164):

```tsx
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        location={gs.location}
        inventory={gs.inventory}
        currentAct={gs.currentAct}
        npcStates={gs.npcStates}
        introducedNpcs={gs.introducedNpcs}
        onOpenDiary={openDiary}
        diaryUnreadCount={diaryUnreadCount}
        displayTime={gs.displayTime}
        displayDate={gs.displayDate}
        weather={gs.weather}
      />
```

with:

```tsx
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        location={gs.location}
        inventory={gs.inventory}
        currentAct={gs.currentAct}
        npcStates={gs.npcStates}
        introducedNpcs={gs.introducedNpcs}
        displayTime={gs.displayTime}
        displayDate={gs.displayDate}
        weather={gs.weather}
      />
```

- [ ] **Step 2: Add the diary props to the `<Header>` call**

Replace (currently lines 167-187):

```tsx
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(s => !s)}
          connectionStatus={gs.connectionStatus}
          onRetryConnection={gs.retryConnections}
          isSaving={gs.isSaving}
          themeMode={gs.themeMode}
          onSetThemeMode={gs.setThemeMode}
          soundEffects={gs.soundEffects}
          onToggleSound={() => gs.setSoundEffects(v => !v)}
          ambientAudio={gs.ambientAudio}
          onToggleAmbient={() => gs.setAmbientAudio(v => !v)}
          user={user}
          userProfile={userProfile}
          onSave={() => gs.handleSaveGame()}
          onLoad={openSlotMenu}
          onNewGame={openSlotMenu}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenEditProfile={handleOpenEditProfile}
          onLogout={logout}
        />
```

with:

```tsx
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(s => !s)}
          connectionStatus={gs.connectionStatus}
          onRetryConnection={gs.retryConnections}
          isSaving={gs.isSaving}
          themeMode={gs.themeMode}
          onSetThemeMode={gs.setThemeMode}
          soundEffects={gs.soundEffects}
          onToggleSound={() => gs.setSoundEffects(v => !v)}
          ambientAudio={gs.ambientAudio}
          onToggleAmbient={() => gs.setAmbientAudio(v => !v)}
          user={user}
          userProfile={userProfile}
          onSave={() => gs.handleSaveGame()}
          onLoad={openSlotMenu}
          onNewGame={openSlotMenu}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenEditProfile={handleOpenEditProfile}
          onLogout={logout}
          onOpenDiary={openDiary}
          diaryUnreadCount={diaryUnreadCount}
        />
```

- [ ] **Step 3: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "refactor(app): pass diary props to Header instead of Sidebar"
```

---

### Task 4: Manual verification in the running app

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite starts without errors, prints a local URL (e.g. `http://localhost:5173`).

- [ ] **Step 2: Load the app and check the signed-in top bar**

Open the app while signed in (or sign in via the existing auth flow). Confirm:
- Top-right shows exactly two controls: an outlined 40px circle with the open-book icon, then a 40px filled circle avatar + chevron. No name/role text is visible in the bar itself.
- If there are unread diary entries, the book icon shows a solid accent-colored badge with no border/ring, in the top-right corner of the circle (not clipped inside it). Counts above 9 show "9+".
- Clicking the profile avatar opens the dropdown, and "Dr. [Name]" + role now appear at the top of that dropdown under "Signed In As" (this was already there — confirm it wasn't accidentally duplicated or removed).
- Clicking the book icon opens Watson's Diary modal, same as the old sidebar button did.

- [ ] **Step 3: Check the guest (signed-out) top bar**

Sign out, or open in a private/incognito window. Confirm:
- Top-right shows the diary icon immediately left of the gear icon, both at matching size, then the "Sign In" pill.
- Clicking the gear still opens the guest settings popover as before.
- Clicking the diary icon still opens Watson's Diary.

- [ ] **Step 4: Check the sidebar**

With the sidebar open, confirm the section order top-to-bottom is: Current Location → Medical Bag → Present in Location → Objects of Interest → Avenues. Confirm there is no "Read Watson's Diary" button anywhere in the sidebar anymore. Confirm the Objects of Interest list matches whatever the current location's narration text lists after "**Objects of interest:**" in the story panel.

- [ ] **Step 5: Check the sidebar-toggle icon**

Confirm the panel-toggle icon (top-left) now sits in a 40px circular hover area matching the size of the diary/profile icons on the right, even though it has no visible border.

- [ ] **Step 6: Fix any visual issues found**

If anything above doesn't match, fix it directly in `components/Sidebar.tsx` or `components/Header.tsx` and re-check. Do not commit broken states — amend the relevant Task's commit or add a small follow-up commit once fixed.

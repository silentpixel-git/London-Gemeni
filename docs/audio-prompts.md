# London Bleeds — Sound Generation Prompts

A generation brief for every audio file the game can play. Hand each prompt to your
audio generator (or a sound designer), then drop the resulting file at the path shown.
The code references these exact paths; a missing file is silently skipped — never an error.

## Shared specifications

**Ambient beds** (location + weather loops)
- **Seamless loop**, ~45–60 s, no audible seam at the wrap point.
- **No music / no melody** — texture only. It must sit *under* prose without pulling focus.
- Quiet and dynamic-range-controlled (target ≈ −24 LUFS). The player reads while this plays.
- Period-accurate to 1888 London — no cars, no electrical hum, no modern sirens.
- Stereo, `.mp3` (≈128–160 kbps). Optional `.ogg` sibling for Firefox if you want.

**SFX** (one-shots)
- Short (0.4–2.5 s), single gesture, clean tail, no loop.
- Slightly more present than the beds (target ≈ −18 LUFS) but never startling.
- Mono or stereo, `.mp3`.

> **POC status.** Only the **starred (★)** files are wired into the build right now
> (Baker Street, The Mortuary, Miller's Court, the two weather layers, and the three SFX).
> The rest are documented so the full set can be generated and added later.

---

## SFX — `public/audio/sfx/`

### ★ `clue-discovered.mp3`
A single soft, resonant violin pluck (pizzicato), warm and low — Holmes plays the violin, so
the instrument is in-world. One note, gentle attack, natural decay. A quiet "something just
connected" feeling, not a triumphant chime. ~1.5 s.

### ★ `item-pickup.mp3`
A short, dry rustle of paper and cloth — a document lifted from a desk, a garment shifted.
Tactile and unremarkable. No musical tone. ~0.6 s.

### ★ `act-bell.mp3`
A distant church bell tolling once, heard across foggy streets — slightly muffled, with a long
natural reverberant tail as if blocks away. Solemn, marking the turn of a chapter. ~2.5 s.

---

## Weather layers — `public/audio/weather/`

### ★ `rain.mp3`
Steady rain on cobblestones, brick, and gutters — no thunder, no wind gusts. Even and
continuous so it can loop and be played quietly (drizzle) or louder (downpour). ~50 s loop.

### ★ `fog-wind.mp3`
A low, soft wind moving through empty streets in heavy fog — muffled, hollow, the sound of cold
damp air. Faint, almost subliminal. No howling. ~50 s loop.

---

## Location ambient beds — `public/audio/ambient/`

### ★ `baker-street.mp3`  (221B Baker Street)
*Atmosphere: warm lamplight, tobacco smoke, the disorder of a working mind.*
Cozy interior: a fire crackling steadily in the grate, the slow tick of a mantel clock, the
faint muffled rumble of Baker Street traffic and the occasional hansom cab beyond the window.
Settled, safe, contemplative. ~55 s loop.

### ★ `mortuary.mp3`  (The Whitechapel Mortuary)
*Atmosphere: cold stone, formaldehyde, the silence of a room that has seen too much death.*
Oppressive near-silence with reverberant stone-room tone, a slow irregular drip of water onto
tile, the occasional distant metallic clink. Cold and still and wrong. ~55 s loop.

### ★ `millers-court.mp3`  (13 Miller's Court)
*Atmosphere: claustrophobic, quiet, deeply unsettling.*
A cramped court off a crowded street: muffled crowd murmur and footsteps on cobbles beyond the
walls, a distant dog barking, a far-off door. Close and hemmed-in, an uneasy quiet at the
centre. ~55 s loop.

---

The following beds are **not yet wired** (follow-up) but are specified for completeness.

### `dorset-street.mp3`  (Dorset Street)
*Foggy mornings, muddy roads, vendors and carts.* A crowded, impoverished Whitechapel street:
costermongers calling their wares, cartwheels in mud, a press of voices, children. Busy, poor,
alive. ~55 s loop.

### `h-division.mp3`  (H Division Police Station)
*Overcrowded, understaffed, running on cold tea and exhaustion.* A working station: footsteps
on bare boards, distant doors, low overlapping voices, a scratch of pen, a clearing throat.
Tired institutional bustle. ~55 s loop.

### `ten-bells.mp3`  (The Ten Bells public house)
*Sawdust floors, gas lamps low, cheap gin and wet wool.* A period pub: low murmured
conversation, clinking glasses, an out-of-tune upright piano somewhere, a stool scraping. Warm,
smoky, a little melancholy. ~55 s loop.

### `lusk-office.mp3`  (George Lusk's Office)
*Cluttered with papers and letters.* A small committee room: paper shuffling, a creaking chair,
a clock, faint street noise through a window. Quiet, busy-with-correspondence. ~55 s loop.

### `bond-office.mp3`  (Dr. Bond's Office)
*Clinical and quiet, forensic records and specimens.* A precise, hushed study: the scratch of a
pen, a ticking clock, a faint glass-and-instrument clink, muffled street beyond. Orderly and
cold. ~55 s loop.

### `private-asylum.mp3`  (The Private Asylum)
*Quiet, sterile, unsettlingly calm.* An institution outside London: long-corridor reverberant
silence, a far-off door, the faintest distant indistinct voice, soft wind at the windows.
Calm in a way that disturbs. ~55 s loop.

### `bucks-row.mp3`  (Buck's Row)
*Quiet and industrial, lined with warehouses.* A narrow empty street: low industrial hum from
distant works, footsteps echoing, a dog, sparse wind. Ordinary, and worse for it. ~55 s loop.

### `hanbury-street.mp3`  (Hanbury Street)
*Crowded working-class neighbourhood, a backyard of ordinary horror.* Tenement-yard ambience:
neighbours' muffled voices and footsteps through walls, a baby, a pump handle, washing-line
creak. Cramped domestic life. ~55 s loop.

### `dutfields-yard.mp3`  (Dutfield's Yard)
*Lively from the nearby club, but quiet within the yard.* Muffled singing and crowd from an
adjacent hall bleeding into an otherwise still, dark yard; cart, gate, footsteps. Liveliness
held at one remove. ~55 s loop.

### `working-mens-club.mp3`  (International Working Men's Club)
*Political discussion, cigarette smoke, crowded benches.* A meeting hall: a speaker's cadence
under the murmur of a crowd, applause swells, benches shifting, glasses. Charged and communal.
~55 s loop.

### `mitre-square.mp3`  (Mitre Square)
*Cold and isolated, echoing footsteps, dark alleys.* An enclosed stone square at night:
footsteps echoing off walls, faint dripping, a distant constable's boots, thin wind through
alley mouths. Exposed and lonely. ~55 s loop.

### `goulston-street.mp3`  (Goulston Street)
*Busy street with lingering tension.* A populous street with an undercurrent of unease: passing
voices and footsteps, a cart, a hush that keeps falling and lifting. Crowded but watchful.
~55 s loop.

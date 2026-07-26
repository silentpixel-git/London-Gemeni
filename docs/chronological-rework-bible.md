# The Whitechapel Diaries — Chronological Rework Bible

**Status: approved design.** All nine open decisions were settled in review on 26 July
2026 and are recorded in [§9](#9-settled-design-decisions); the acts in §4 are written to
match. Deliberate departures from history are collected in the
[Historical Bends Register](#11-historical-bends-register) — if a bend isn't listed there,
it's an error, not a choice.

This document supersedes the "reweave calendar" (8–22 November 1888, retrospective
structure) described in `engine/stories/whitechapel-1888/acts.ts` and
`docs/reweave-act-walkthrough.md`. Once this rework ships, `.claude/skills/game-direction`
(Part 2) and `.claude/skills/historian` (the "game's events" note) must be updated to match.

---

## 1. What this rework is

The story is restructured to follow the Whitechapel murders **chronologically, murder by
murder**, from the eve of the first killing (Bank Holiday Monday, 6 August 1888) to the
confrontation in late November. Holmes and Watson are involved from the beginning. Every
murder scene is visited fresh — hours old, police present — not reconstructed weeks later.
Each act is a contained episode that closes with a Baker Street fireside summation, and
each act's loud suspect is raised and cleared on-screen, in the order history raised and
cleared them.

### What does NOT change (fixed points)

These are inherited from the game direction and are not reopened by this rework:

1. **Edmund Halward is the murderer.** His camouflage is absence — never listed, never
   suspected, never spotlighted until the convergence names him.
2. **The "prasarved" convergence is the crown puzzle** (USE Edmund's forensic note WITH
   the From Hell letter, at Baker Street). Nothing may spoil, shortcut, or pre-announce it.
3. **Red herrings are raised fairly and cleared on-screen** — the moving-spotlight
   pattern (three beats: meet the theory, test it, clear the man) is kept and
   redistributed across the new timeline.
4. **The engine/AI contract is untouched.** This is a story-data rework; the few engine
   additions it needs are small and listed in §8 (the act-epilogue auto-cut, multi-day
   acts, and the weather vocabulary).
5. **The historical facts are the difficulty.** Real victims, real dates, real locations,
   real investigators. The fiction bends only where the invented culprit requires it,
   and every bend is registered in §11.
6. **Wrong deductions still produce cold-case endings**, with tailored rebuttals; the
   true ending remains the asylum and "I have always had an eye for light."

### The one structural rule that makes chronology work

**A murder always opens an act. It never closes one.**

Chronologically, Holmes fails five times — history demands it. Handled naively, every act
ends with the player being punished. So: acts end on *progress* — a suspect cleared, the
profile narrowed, Holmes's summation at the fire — and the next murder arrives as the
cold open of the *next* act, delivered by the act bridge ("Then, before dawn on the
Friday, word came…"). The player's rhythm is investigate → understand → rest → shock,
not investigate → fail → repeat.

The single authored exception: the double event (Act 4), where Holmes and Watson are in
Whitechapel *that night* and arrive at Dutfield's Yard minutes behind the killer. One
near-miss, at the story's midpoint, played for maximum tension — never repeated.

---

## 2. Master timeline — history → acts

| Real date | Real event | Act |
|---|---|---|
| Mon 6 Aug | Bank Holiday. Warm, rowdy evening. | **Act 0** opens |
| Tue 7 Aug, ~2:30 AM | Martha Tabram killed, George Yard Buildings (39 stab wounds; found 4:45 AM by John Reeves) | **Act 1** opens |
| Aug | Soldier identification parades fail; "Pearly Poll" fiasco | Act 1 spotlight |
| Fri 31 Aug, ~3:40 AM | Mary Ann Nichols killed, Buck's Row (found by Charles Cross & Robert Paul) | **Act 2** opens |
| ~1 Sep | Insp. Abberline seconded to Whitechapel to coordinate | Abberline enters |
| Sat 8 Sep, ~5:30 AM | Annie Chapman killed, 29 Hanbury Street backyard (found ~6 AM by John Davis) | **Act 3** opens |
| 10 Sep | John Pizer ("Leather Apron") arrested by Sgt Thick; alibied and released | Act 3 spotlight |
| 26–27 Sep | Coroner Baxter's inquest theory: an American offering £20 for anatomical specimens | Act 3 finale seed |
| 27 Sep | "Dear Boss" letter received by Central News (published 1 Oct — "Jack the Ripper" is born) | Act 4 texture |
| Sun 30 Sep, ~1:00 AM | Elizabeth Stride killed, Dutfield's Yard (interrupted by Diemschutz's cart) | **Act 4** opens |
| Sun 30 Sep, ~1:45 AM | Catherine Eddowes killed, Mitre Square (City Police jurisdiction) | Act 4 |
| Sun 30 Sep, ~2:55 AM | Apron piece found Goulston Street; graffito wiped on Warren's order before dawn | Act 4 |
| 16 Oct | George Lusk receives the "From Hell" letter with half a preserved kidney | **Act 5** opens |
| 25 Oct | Dr. Thomas Bond asked to review the whole series of murders | Bond (and Edmund, formally) enter |
| 7 Nov | Francis Tumblety arrested (indecency charges) | Act 6 texture |
| 8 Nov | Commissioner Warren resigns | Act 6 texture |
| Fri 9 Nov, morning | Mary Jane Kelly killed, 13 Miller's Court (found 10:45 AM by Thomas Bowyer; Lord Mayor's Show day) | **Act 6** opens |
| 12 Nov | George Hutchinson gives his "astrakhan man" statement to Abberline; discredited within days | Act 6 spotlight |
| ~20–24 Nov | Tumblety jumps bail, flees to France | Act 7 texture |
| Late Nov | *(fiction)* The convergence, the deduction, the asylum | **Act 7** |

Time between acts is carried by the existing act-bridge mechanism — the bridges already
skip days; now they skip weeks, and each one names the interval plainly in Watson's voice.

---

## 3. Act structure overview

Eight stages (0–7) instead of the current seven (0–6). `ACT_TIME_CONFIG`,
`ACT_PROGRESSION`, etc. are records keyed by number — an extra act is data, not engine
work. Each act is named for its loud theory; the last is named for the quiet truth.

| Act | Name | Date | Anchor | Spotlight suspect | Cleared by |
|---|---|---|---|---|---|
| 0 | The Bank Holiday | Mon 6 Aug, evening | 221B Baker Street | — (tutorial) | — |
| 1 | The Soldier | Tue 7 Aug, morning | George Yard Buildings | A soldier with a bayonet | Failed identification parades; wound analysis |
| 2 | The Slaughterman | Fri 31 Aug, morning | Buck's Row | Local slaughtermen / High Rip gangs | Alibis at Barber's yard; the cuts don't match a trade |
| 3 | Leather Apron | Sat 8 Sep, morning | 29 Hanbury Street | John Pizer | Alibied (dock fire beside a constable); cleared on-screen |
| 4 | The Double Event | Sun 30 Sep, night → dawn | Dutfield's Yard → Mitre Square → Goulston St | "The Juwes" / the foreigner panic | The graffito wiped; Holmes: "our man is not even noticed" |
| 5 | From Hell | Tue 16 Oct → late Oct | Lusk's office / Mile End | The Mad Doctor (Tumblety) rises; the Vanishing Gentleman seeded | *(not yet — carried into 6/7)* |
| 6 | The Stranger | Fri 9 Nov, morning | Dorset Street / Miller's Court | Hutchinson's astrakhan man; Hutchinson himself | Three-beat witness test (kept from reweave) |
| 7 | The Quiet Man | Late Nov | 221B → private asylum | Tumblety (flees), Bond (alibied), then the convergence → Edmund | True ending / cold-case endings |

Weather arc (`ACT_WEATHER`): warm summer night (0–1) → close August heat (1) → late-summer
rain (2) → mild autumn (3) → showery, cold night (4) → grey October damp (5) → overnight
rain into drizzle, the real 9 Nov record (6) → November fog for the finale (7). The
seasonal decline *is* the story's emotional arc; the prose should feel it getting darker
and colder act by act.

---

## 4. Act-by-act specifications

### Act 0 — The Bank Holiday (Mon 6 Aug 1888, evening, 221B)

**Purpose:** tutorial (EXAMINE / TALK / TAKE / SHOW, same verbs as the current vigil),
character establishment, and the calm before. No murder has happened. London is loud with
holiday crowds; the windows of 221B are open to a warm night.

**Situation:** Holmes is concluding another case, unnamed and referred to only in the
abstract — papers returned, a client satisfied (revised by the Acts 0–1 historian pass;
see §9.8). Holmes is in the post-case
trough Watson knows well: restless, contemptuous of the holiday's noise, complaining
that crime has grown dull and small.

**Tutorial beats (flag sketch):** examine the concluded case's file (EXAMINE), talk to
Holmes (TALK — he delivers the "crime has grown dull" irony), take the evening paper
(TAKE), show Holmes something in it (SHOW). Mrs. Hudson supper beat optional.

**Dramatic irony to plant, gently:** Holmes's boredom. The audience knows what tomorrow
brings; Watson does not. The act's last line of narration should let the warm night feel
briefly, unrepeatably safe.

**Finale:** none needed — the act *is* Baker Street. The bridge to Act 1 is the knock
before dawn.

### Act 1 — The Soldier (Tue 7 Aug, George Yard Buildings)

**The murder:** Martha Tabram, killed ~2:30 AM on the first-floor landing of George Yard
Buildings, found 4:45 AM by John Reeves. 39 stab wounds; Dr. Timothy Killeen's examination
suggests two blades — one consistent with a dagger or bayonet.

**The hook — how Holmes gets in (SETTLED: Reid, informally):** the user's brief says
Holmes and Watson are "called upon because of the nature of the murder." H Division's
Inspector Edmund Reid knows Holmes by reputation; with a frenzied-attack case and no
witnesses, he sends to Baker Street for a quiet, unofficial opinion before dawn. The
request is explicitly off the books — Reid wants a reading, not a consultant of record.

This keeps the police relationship warm from Act 1 and gives the game its Lestrade-shaped
door into every later crime scene: Reid vouches for Watson and Holmes in Acts 1–2 and
hands them on to Abberline when the Yard takes the case over in September. It also defers
the grand "never seen before" declaration to Act 2, where escalation earns it (§4, Act 2).

Reid must therefore be authored as a full NPC with an Act 1–2 schedule, not a one-scene
voice, and his handover to Abberline is an authored beat in Act 2's opening rather than a
silent substitution.

**Investigation content:** the landing (light from the staircase — first, invisible
planting of the light motif); the wound count and the two-blade question; Pearly Poll
(Mary Ann Connelly) as witness NPC; the soldier theory.

**Spotlight — the soldier:** raised by Poll's testimony (Tabram last seen with a
grenadier). Tested: the identification parades at the Tower and Wellington Barracks
collapse — Poll picks nobody, then the wrong men. Cleared: Holmes reads the wounds
against a bayonet's geometry and finds the theory wanting. The act teaches the game's
grammar: *the loud theory is not the answer.*

**Edmund's presence:** at the mortuary shell where Tabram lies — the clerk taking notes
for the divisional surgeon (see §5). Watson barely registers him. No name, no alias
beyond "the clerk." He remarks — to nobody — that the staircase gaslight would have been
poor at that hour. First sounding of "an eye for light."

**Finale at Baker Street:** Holmes at the fire, dissatisfied: the frenzy is real but the
pattern isn't visible yet. He files it. Bridge to Act 2: three quiet weeks, then Buck's Row.

### Act 2 — The Slaughterman (Fri 31 Aug, Buck's Row)

**The murder:** Mary Ann Nichols, found 3:40 AM by carmen Charles Cross and Robert Paul;
throat cut twice, abdominal mutilation found at the mortuary. Dr. Rees Llewellyn attends.
Inspectors Spratling and Helson; Abberline seconded to coordinate days later — his proper
entrance as an NPC.

**The escalation beat:** this is where "**this is something we have never seen before**"
lands (user's line, deliberately deferred from Act 1). The mutilation — discovered at
the mortuary, not the scene — is the moment the case changes shape. Llewellyn or
Abberline speaks the line; Holmes's silence answers it.

**Investigation content:** Buck's Row itself (a body found where beat constables pass
every half hour — the killer's confidence clue enters here, chronologically re-homed);
the mortuary examination; the connection question — is this the George Yard man?
Holmes argues yes on method-escalation grounds while the police resist.

**Spotlight — the slaughterman:** horse slaughterers from Barber's yard, working nearby
that night, were the immediate suspicion, alongside press panic about High Rip extortion
gangs. Tested and cleared: alibis check out; and Holmes demonstrates (mortuary beat)
that the cuts are not a trade's cuts — deliberate, exploratory, *learning*. Clue yield:
the campaign-pattern and anatomical-curiosity threads open.

**Edmund's presence:** the clerk again, at the second mortuary. Two scenes, same
invisible man. (The engine's NPC schedule places him; no prose ever counts him.) Second
sounding of the light motif: he observes, to nobody, that Buck's Row carries a single lamp
at its far end — and that a man's eyes adjust.

**Finale at Baker Street:** Holmes names the pattern for the first time — one hand, an
appetite growing. The word "campaign" enters Watson's diary. Bridge: eight days.

### Act 3 — Leather Apron (Sat 8 Sep, 29 Hanbury Street)

**The murder:** Annie Chapman, backyard of 29 Hanbury Street, found ~6 AM by John Davis.
Dr. George Bagster Phillips attends — and delivers his famous judgement that the
extraction shows *the work of an expert*, setting up the story's great medical
contradiction with Bond's later profile (a real, documented disagreement the fiction
inherits and uses).

**Investigation content:** the yard (the fence, the door, the timing against the
neighbours' movements); Phillips as the second medical voice; the missing uterus — the
first organ *taken*; the inquest, where Coroner Wynne Baxter airs the story of an
American offering £20 for anatomical specimens — the seed that will flower into
Tumblety's spotlight, planted here, two acts early, exactly as history planted it.

**Spotlight — Leather Apron:** the press's monster. The panic, the mob, Sgt Thick's
arrest of John Pizer on 10 September, and the on-screen clearing: the dock-fire alibi
beside a constable, the lodging-house witnesses. The existing Pizer material (his
humanizing scene, Holmes's "prejudice dressed as deduction" beat, the cold-case rebuttal
if the player later names him) migrates here nearly intact — this is its historically
correct home.

**Edmund's presence:** third mortuary, third set of notes. If the player has begun to
look — and nothing prompts them to — the record shows the same clerk's initials on all
three surgeons' paperwork. Never highlighted. (Fair-play: the evidence of his presence
exists from Act 3 onward for a player who rereads documents; the current
`clue_07_edmunds_presence` becomes reachable late-game by cross-reading.) Third sounding:
he notes that the work in the yard was finished before dawn came up — that whoever it was
did not wait for the light.

**Finale at Baker Street:** the act closes on the organ question. Holmes, at the fire:
the killer is no longer only killing — he is *collecting*. Against Baxter's £20 American
theory Holmes is unconvinced: a buyer explains the taking, not the manner of it.
Bridge: three weeks of silence, a city holding its breath, then the worst night.

### Act 4 — The Double Event (Sun 30 Sep, night)

**The structural exception:** the one act that opens *before* its murders, and the one
authored near-miss. It begins in the evening: the "Dear Boss" letter (received by the
Central News Agency on the 27th) has reached the police; Holmes dismisses it as
journalism — his documented press-hoax position, kept from the reweave. Then the night
unravels in real time: Dutfield's Yard (Stride; Diemschutz's cart; the interruption —
no mutilation), and while police swarm Berner Street, Mitre Square (Eddowes) forty-five
minutes later, one jurisdiction over — the City Police, Dr. Frederick Gordon Brown, a
kidney and uterus taken. Then Goulston Street before dawn: the apron piece, the chalked
graffito, and Warren's order to wipe it while Holmes stands there arguing for a
photograph. History says no.

**Why the near-miss is fair here:** the interruption at Dutfield's Yard is historical —
the killer *was* nearly caught, and killed again within the hour out of what reads as
compulsion. The game's near-miss dramatizes a real near-miss; it invents proximity, not
events. This act carries the story's midpoint despair: closest to him, and emptiest
handed.

**Spotlight — the foreigner:** the graffito, the anti-Jewish panic, Warren's fear of
riots. This act's "suspect" is a whole population, and its clearing beat is Holmes's
disgust: the mob's theory is the killer's camouflage. Existing capstone line, kept and
re-homed: *"our man is not even noticed."* Israel Schwartz's and Joseph Lawende's
part-glimpsed men give the act its witness texture — descriptions that contradict each
other, teaching the player to distrust description itself (armament for the Hutchinson
test in Act 6).

**Edmund's presence (SETTLED: mortuary aftermath only):** Edmund appears at the Golden
Lane mortuary after Eddowes is brought in — his fourth set of notes — and remarks, to
nobody, on how well the square's single lamp served the work. He does **not** appear at
Berner Street: the night scenes are crowded and fast, and a cameo in that crowd risks
spotlighting him at the worst possible moment. Fourth sounding of "an eye for light,"
and the most specific one before Act 6.

**Finale at Baker Street:** dawn, both exhausted. Holmes lays out the night's terrible
arithmetic — two murders, two jurisdictions, forty-five minutes — and the profile
sharpens: not a madman fleeing, but a man who *finished his errand*. The kidney is gone;
remember the kidney. Bridge: a fortnight of letters, hoaxes, and vigilance patrols.

### Act 5 — From Hell (16 Oct onward, the lull)

**The pivot act — no murder.** October's dread quiet. Two things happen, and both bend
the story toward its end:

1. **The Lusk letter.** George Lusk of the Whitechapel Vigilance Committee receives
   half a preserved human kidney and the "From Hell" letter — "prasarved it for you."
   The examination beats: the spelling, the preservation (spirits, a laboratory hand,
   *not* a showman's crude curio), the medical question of whether it is Eddowes's.
   The player takes possession of the letter's facts here; **the letter itself must end
   up retained/copied such that it is available at Baker Street for the Act 7
   convergence** (the crown puzzle's second component).
2. **Bond enters.** Late October, Dr. Thomas Bond is formally asked to review the whole
   series — historically true, and the story's masterstroke of camouflage: Edmund, the
   clerk who has haunted every mortuary since August, is now *regularized* as "Bond's
   assistant." His alias upgrades from "the clerk" to "Bond's assistant"; his presence,
   suspicious in retrospect, is officialized in plain sight. Bond's review — and his
   coming disagreement with Phillips about skill — gives the act its medical-world
   content (the current Act 2 mortuary/medical material largely migrates here).

**Spotlight — the Mad Doctor rises:** Baxter's £20 American story now has a name in
police gossip — Francis Tumblety, specimen collector, woman-hater, known to detectives.
He is *raised* here (interview/observation beat — the existing "this man is a
performance" material fits) but **not cleared** — his arrest and flight play out across
Acts 6–7, as they did in fact. Secondary seed: Abberline's file mentions a barrister of
good family gone erratic — the Vanishing Gentleman, planted for Act 7.

**Finale at Baker Street:** the convergence's dress rehearsal — per the fair-play
teaching rule, this act's summation includes a low-stakes USE X WITH Y beat (e.g. USE
Phillips's report WITH Bond's draft review, surfacing the skill contradiction). The
player has now performed the crown puzzle's verb once, with hint coverage, before it
counts. Holmes closes: the letters are noise, except one; the kidney was not sent by a
hoaxer; the hand that preserved it has done such work before.

### Act 6 — The Stranger (Fri 9 Nov, Miller's Court)

**The murder:** Mary Jane Kelly, 13 Miller's Court — the youngest victim, indoors, the
most terrible scene; found 10:45 AM by Thomas Bowyer on the morning of the Lord Mayor's
Show; Warren's resignation is that week's thunder. The existing Act 1 Miller's Court
material — the grate and burned clothing (the killer's use of light, now the motif's
loudest note), the bed, Bond's aftermath beat, the surgeon's-burden scene — migrates
here nearly whole. It was the strongest sequence in the reweave; the rework preserves
it and gains the horror of arrival *the same morning* rather than by reconstruction.

**Spotlight — the Stranger and the witness:** George Hutchinson comes forward on 12
November with his impossibly detailed astrakhan man. The existing three-beat witness
test (talk → USE account WITH archway → SHOW it back) is kept exactly — it is the
game's best-designed clearing, and Act 4's contradictory-witness lesson has armed the
player for it. Both the Stranger and Hutchinson himself rise and clear on-screen, as in
the current design. Tumblety texture: arrested the 7th, in custody as Kelly died —
the fact that will clear him of *this* murder even as the public convicts him of all.

**Edmund's presence:** with Bond at the scene and the post-mortem, fully in role. The
player has almost certainly stopped seeing him. That is the design. Fifth and final
sounding, the only one spoken indoors: the fire in Kelly's grate had burned fierce enough
to melt a kettle's spout, and he remarks — to nobody, over his notes — that this time
there was light enough to work by. Nobody answers. Act 7 does.

**Finale at Baker Street:** Bond's completed profile is read at the fire — the killer
had *no* surgical skill, cutting against Phillips, and Holmes for the first time agrees
with the lesser claim and voices the greater one: not a doctor — someone who *watched*
doctors. Someone who has been watching everything. The room goes quiet in the way rooms
do when a true thing has been said a step too late. Bridge: the days after.

### Act 7 — The Quiet Man (late Nov, 221B → the asylum)

The finale act, inheriting the current Acts 5–6 mechanics with their gates intact:

1. **The clearings complete:** Tumblety jumps bail and flees (Abberline beat — cleared:
   "the preservation does not match his crude curios"); the Vanishing Gentleman is run
   down and dissolves ("a shape is all it is"); Bond himself is raised by the player's
   own documents and alibied by Abberline. The board empties. Nobody is left — which is
   the answer, for the one who was never on it.
2. **The convergence (crown puzzle, unchanged):** at Baker Street, the document work —
   USE Edmund's forensic note WITH the From Hell letter; the hand matches;
   "prasarved." The quiet man has a name. The deduction gate (`successAct`,
   `DEDUCTION_THRESHOLD`, alias matching) carries over; wrong deductions route to the
   tailored cold-case endings, all of which remain valid — their texts need only date
   adjustments.
3. **The confrontation:** the private asylum, the patient records, the window, and
   "I have always had an eye for light." Unchanged, save that the light motif now
   resolves a thread the player has heard sounded — softly, five times — since a
   staircase in George Yard.

---

## 5. The Edmund re-anchor (the rework's one hard design problem)

**Problem:** Edmund's camouflage is "Bond's assistant," and his placement rule is
"follows Bond." But Bond historically enters in late October. A chronological story
needs Edmund *present from Act 1* — the whole convergence depends on his forensic note,
and the whole design depends on his invisible ubiquity.

**Recommended solution — the peripatetic mortuary clerk:** Edmund is a forensic
clerk-of-all-work who serves the divisional surgeons of the East End — Killeen, then
Llewellyn, then Phillips, then Brown — taking notes, filing reports, fetching, cleaning.
A fixture of the mortuary world that every doctor uses and no doctor employs; paperwork
in four hands bears his initials before anyone knows his name. When Bond is appointed to
review the series in late October, he naturally takes on the clerk who already holds
every file. The camouflage *improves*: his ubiquity is retroactively officialized, and
"Bond's assistant" (the current alias and following rule) is preserved from Act 5
onward, keeping the existing Act 6–7 mechanics untouched.

- Fiction cost: one invented arrangement (shared clerk), registered in §11. No real
  person displaced.
- Mechanical cost: `scheduleByAct` entries for Acts 1–4 (mortuary placements) and an
  alias change ("the clerk" → "Bond's assistant") at Act 5; `followingRule` gains
  nothing new — fixed placements until the follow rule starts.
- Design dividend: the motif discipline. Edmund gets **exactly one light remark per act he
  appears in** — Acts 1, 2, 3, 4 and 6 — always peripheral, never answered, and never
  escalating in explicitness. Act 5 is the exception: his regularization as "Bond's
  assistant" *is* that act's Edmund beat, and a remark on top of it would crowd the
  reveal-in-plain-sight. Five soundings before the asylum resolves the chord. A replaying
  player should feel ill.

**Rejected alternatives:** bending Bond into the case from August (a large, visible
historical bend that any Ripper-literate player will catch, and it damages Bond's
authentic late-entry beat); making Edmund a journalist or photographer (breaks
"laboratory hands" and the forensic-note convergence); making him Phillips's assistant
(collides with a real, documented figure's staff and loses the Bond mechanics).

---

## 6. Suspect spotlight — chronological redistribution

The reweave's roster survives; only the order changes, and two theories are added for
the suspect-poor early acts (both historical):

| Spotlight | Raised | Tested | Cleared | Notes |
|---|---|---|---|---|
| The soldier *(new)* | Act 1, Pearly Poll | Identification parades | Act 1 finale — wound geometry | New POI entry |
| The slaughterman / gangs *(new)* | Act 2, police canvass | Alibi checks | Act 2 mortuary beat — "not a trade's cuts" | New POI entry |
| Leather Apron (Pizer) | Act 3, the panic | Arrest, 10 Sep | Act 3, on-screen alibi — existing material | Migrates intact |
| The foreigner / "Juwes" | Act 4, the graffito | Warren's wipe | Act 4 capstone — "not even noticed" | A panic, not a person |
| The Mad Doctor (Tumblety) | Act 3 seed (Baxter) → Act 5 named | Act 5 interview — "a performance" | Act 7 — flees; preservation mismatch | Clearing deferred, as in history |
| The Stranger (astrakhan man) | Act 6, Hutchinson | USE account WITH archway | Act 6 — existing three-beat test | Migrates intact |
| Hutchinson himself | Act 6 | The vigil questioned | Act 6/7 — no medical knowledge | Migrates intact |
| The Vanishing Gentleman | Act 5 seed → Act 7 | The file runs dry | Act 7 — "a shape is all it is" | Migrates intact |
| Dr. Bond | Act 7, player-raised | SHOW reports to Abberline | Act 7 — movements accounted for | Migrates intact |
| **Edmund Halward** | **Never** — until the convergence | — | — | Absence is the camouflage |

All existing `wrongDeductionNote` cold-case texts remain valid. Two new ones are needed
only if the soldier/slaughterman theories are made accusable (recommend: no — they are
act-local theories, not endgame suspects; the deduction aliases stay as they are).

---

## 7. Clue and evidence migration

Principle: **no clue is cut; every clue is re-homed to the act where history surfaces
its evidence.** Coarse mapping (exact flag/trigger work is the game designer's pass):

| Evidence thread | Old home | New home |
|---|---|---|
| Killer's confidence (patrolled streets) | Act 2 reconstructions | Act 2 (Buck's Row, fresh) |
| Campaign pattern | Act 0 case wall | Acts 1–2, built live murder by murder |
| Anatomical knowledge / curiosity | Act 2 mortuary | Act 2–3 (Llewellyn, then Phillips) |
| Kidney removal; adjustable appearance | Acts 2–3 | Act 4 (Mitre Square / Brown) |
| Human kidney; preserved kidney; "prasarved" | Act 4 (Lusk) | Act 5 (16 Oct, its real date) |
| Edmund's presence (the initials) | Act 5 convergence area | Discoverable from Act 3; convergent in Act 7 |
| Account outruns light (Hutchinson) | Act 1 | Act 6 |
| Letter knows too much | Act 4 | Act 5 |
| Killer's use of light (the grate) | Act 1 Miller's Court | Act 6, as the motif's climax |
| Medical background ("watched, not qualified") | Act 2 | Act 6 finale (Bond's profile read) |

**Convergence integrity check (must hold through all data work):** Edmund's forensic
note (obtainable from Act 5's Bond-review material at the latest) and the From Hell
letter (Act 5) must both be present/retained at Baker Street in Act 7, with
`DEDUCTION_THRESHOLD` (currently 4) reachable via the redistributed critical path with
one clue of slack. The fair-play rehearsal of USE X WITH Y now happens twice before the
crown puzzle (Act 5 finale, Act 6 Hutchinson test) — an improvement over the current
single rehearsal.

---

## 8. Engine deltas (small)

1. **Act-epilogue auto-cut (new, small).** Each act's field flags completing triggers an
   authored hard cut back to 221B for the fireside summation, instead of forcing a manual
   walk home. Mechanically a mirror of the existing act-entry anchor cut
   (`computeActEntry` in `engine/resolvers/support.ts`): an `ACT_EPILOGUES: Record<number,
   string>` (act → epilogue location) plus a check when the penultimate flag set
   completes. The act *gate* then requires the epilogue talk
   (`talked_to_holmes_at_baker_street_act_N` as each act's final flag). Story-agnostic,
   manifest-configured — platform-clean per the game direction's scope rule.
   `consultHolmesMultiClue` already synthesizes gathered evidence and is the natural
   engine for each summation's content. Note the epilogue talk must be a *topic* ask
   (below), not a bare `talked_to_*` — pick the fact each summation turns on.
2. **Act count 0–7.** Pure data; verify nothing hardcodes six acts (walkthroughs, QA
   scripts, and `isFinalAct` logic read from the records — audit, not rewrite).
3. **Calendar span.** `ACT_TIME_CONFIG.displayDate` already carries arbitrary dates;
   August sunsets vs November sunsets should be reflected in each act's time-of-day
   periods and `ACT_WEATHER`.
4. **Multi-day acts (new — found by the Acts 0–1 historian pass).** An act cannot
   currently change date, and the real investigations do not fit inside one day: Tabram's
   identification parades are nine days after the murder. `ActTimeConfig` gains authored,
   flag-driven `days` steps. Every act wants this — the murders are three weeks apart and
   Act 5's lull is a month. Specified in the slice spec §1.4.
5. **Weather vocabulary.** `WeatherCondition` was authored for November and has no warm
   state; the rework opens in August. Adds `clear-warm` and `close`, plus matching
   `ATMOSPHERIC_SEEDS` entries (the condition string drives seed selection, not just the
   sidebar label).

Everything else — placement, rumors, facts, introductions, endings — is existing
machinery pointed at new data.

### 8b. Two mechanics that landed before this rework (author against them)

Both shipped ahead of the vertical slice and change how acts must be authored.

**TALK is topic-scoped.** A bare `talk to bond` is an opening exchange — it succeeds,
records `talked_to_<npc>_at_<loc>`, lets two or three subjects surface in the reply, and
gates *nothing*. Act progression, suspect clearing, scripted-line triggers and rumor
triggers all want `asked_<npc>_about_<factId>`, set only when the player names a subject:
`ask bond about mary kelly`. Subjects are the `topics` array on each `StoryFact`, so an NPC
can be asked only about what they know (`knownBy`) and what the act has opened
(`visibleFromAct`) — spoiler gating stays mechanical, and a fact sealed until Act 6 cannot
be asked for in Act 2.

Consequences for authoring each act:
- Every act gate that used to be "talk to X" now needs a **specific fact** to hang on, with
  `topics` written as noun phrases a player would actually type. Where no existing fact
  carries the act's turning thought, author one and gate it with `visibleFromAct` — that is
  how the three capstone facts (`holmes_tumblety_performance`, `holmes_preserving_hand`,
  `edmund_eye_for_light`) came to exist.
- The matching hint objective's `subject` must name the topic, or the player is told to
  talk to someone without being told what to raise.
- `qa:validate` fails an act gate whose fact is sealed past that act, has no topics, or
  isn't known by the NPC — and fails two facts sharing a topic phrase within one NPC's
  askable set.
- **Edmund's asylum confrontation is now the payoff of the light motif in the most literal
  way**: the Act 7 gate is `asked_edmund_about_edmund_eye_for_light`. The player must put
  the subject of light to him. The five peripheral soundings (§5) are what teach them to,
  which makes the motif load-bearing rather than decorative.

**NPC approaches now fire, and each act owes one designed beat.** Approaches were
invisible in play for two compounding reasons (a vignette veto that starved every
full-mode turn, and compact-mode turns that burned the one-shot flag without rendering the
prose). They now fire on full-mode turns only — a successful move or a look-around — with
their own required paragraph. For authoring:
- Exactly one approach per act carries `actBeat: true`: a designed story moment, selected
  ahead of ambient texture and exempt from the 30-minute cooldown. It must be pinned to one
  act, be `mundane`, carry no `requireFlags`/`forbidFlags`/`timePeriods` (a guaranteed beat
  may not be disableable), and sit at a location the act's spine requires — the anchor, in
  practice. `qa:validate` enforces all of it; `qa:engine` proves each one actually fires at
  its anchor.
- Ambient approaches keep working underneath as texture, cooldown-limited.
- The recession rule still holds and now matters more: Edmund must have mundane act beats
  like everyone else. An approach system where only the innocent initiate contact is a tell.

---

## 9. Settled design decisions

All nine open questions were resolved in review on 26 July 2026. They are recorded here
as the decisions of record; the acts in §4 are written to match.

1. **Tabram is in, and opens Act 1.** The 7 August start requires her, and the
   contemporary police *did* treat her as part of the series. "39 stab wounds, no pattern
   yet" is the overture: the story starts before anyone knows it has started. Ripper-canon
   purists will note she sits outside the canonical five, so the fiction states its
   position exactly once, in Act 2 — Holmes counts her, and the file stays open.
2. **The Act 1 hook is Inspector Reid, informally** (§4, Act 1). Reid is a full NPC across
   Acts 1–2 and hands the pair on to Abberline in Act 2's opening.
3. **"This is something we have never seen before" lands in Act 2**, at the mortuary,
   spoken over the Nichols mutilation. Act 1's frenzy reads as a different, lesser horror
   until Nichols connects them.
4. **Edmund appears only at the Golden Lane mortuary on double-event night** (§4, Act 4).
   No Berner Street crowd cameo — the risk of spotlighting him outweighs the replay value.
5. **Eight stages, Act 0–7.** The finale act carries the convergence, the deduction and
   the asylum, so the Kelly act keeps its air.
6. **The reweave content is archived, not deleted** — `docs/reweave-*.md` and the current
   act walkthroughs move to `docs/archive/` as historical design docs. Their beat-craft is
   the quarry this bible keeps borrowing from.
7. **Act 5 includes the Vigilance Committee patrol** — a playable night-walk, strong
   atmosphere, no murder. It is the one act with room for pure world, and it makes the
   October lull read as held breath rather than a gap.
8. **Act 0's concluding case is unnamed** — a matter referred to only in the abstract
   (§4, Act 0). *Superseded the original decision:* this was settled as a *Sign of Four*
   allusion, which the Acts 0–1 historian pass overturned. That story is canonically
   September 1888, a month after Act 0, and concluding it leaves Watson engaged to Mary
   Morstan and leaving Baker Street — which contradicts the premise that he is resident
   and available when the pre-dawn message arrives. See the slice spec §2.
9. **Edmund's light motif sounds once per act he appears in — five soundings** before the
   asylum resolves it (§5). Each is peripheral, addressed to nobody, and never answered.
   Acts 1, 2, 3, 4 and 6 carry one apiece; none escalates in explicitness.

---

## 10. Content migration checklist & QA plan

Files requiring rewrite or major edits (all under `engine/stories/whitechapel-1888/`
unless noted): `acts.ts` (time config, weather, anchors, names, bridges, progression —
full rewrite), `locations.ts` (new: George Yard Buildings, Buck's Row fresh-scene
variant, Hanbury Street yard, Mile End / Lusk office re-dated, mortuary variants;
re-dated: all existing), `npcs.ts` (schedules across eight acts for every NPC; new:
Reid, Pearly Poll, Llewellyn, optionally Killeen/Brown; Edmund's Acts 1–4 placements +
alias change), `facts.ts` (`visibleFromAct` re-map across the board), `clues.ts`
(trigger re-homing per §7), `rumors.ts` (new early-act theories; re-dated hops),
`events.ts` (Dear Boss publication, Warren resignation, Lord Mayor's Show, Tumblety
flight as world events), `hints.ts` + `diaryLeads.ts` (full coverage pass for every new
gate), `suspects.ts` (two new POI entries; date touches in cold-case texts),
`endings.ts` (date touches), `atmosphere.ts` (the seasonal arc), `constants.ts`.
Engine: the epilogue auto-cut (§8). Docs: new walkthroughs; archive reweave docs; update
both skills' story-facts sections. QA: `qa:validate` after every data file lands;
`qa:engine` scripted-intent suite rewritten against the new act graph; `qa:parser`
baseline re-recorded (new object/NPC vocabulary); `qa:hints` and `qa:diary-leads` for
the new gates; full `qa:all` green before any act is called done; `qa-playthrough` and
`game-reviewer` passes on the vertical slice.

**Sequencing (vertical slice first):** Acts 0–1 through the entire pipeline — spec →
historian review → mechanics → data → QA green → blind playthrough — before Acts 2–7
are authored. The slice validates the epilogue mechanic, the bridge-carried murder
openings, and the Edmund clerk placement, which are the rework's three novel moving parts.

---

## 11. Historical Bends Register

Deliberate fictions, each justified; anything not listed is unintended:

1. **Holmes and Watson exist** and shadow the investigation (the premise).
2. **Edmund Halward and the shared-clerk arrangement** are invented; the divisional
   surgeons' real staff are neither named nor displaced. The asylum is fictional.
3. **The killer's identity**: the fiction supplies an answer history never had. All real
   suspects are handled as history handled them — suspected, then cleared or lost.
4. **Proximity at the double event**: Holmes and Watson's near-miss is invented;
   the interruption itself (Diemschutz) is fact.
5. **Tabram is treated as the first of the series** — a genuine contemporary view,
   contested then and now; the game adopts it knowingly.
6. **Compression of Tumblety's November** (arrest, bail, flight) into the Act 6–7
   window; exact dates blurred by a few days.
7. **The Vanishing Gentleman** (Druitt-shaped): his dismissal and disappearance are
   nudged a week or two earlier than the record to fit a late-November endgame.
8. **Inquest timelines** (Baxter's £20 story, witness statements) may be voiced in-scene
   days before their formal inquest dates, where drama requires; content stays factual.

---

*Draft ends. On approval: resolve §9, then commission the vertical slice (Acts 0–1)
per §10.*

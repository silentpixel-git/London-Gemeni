# London Bleeds — Engine

The domain language of the text-adventure engine that runs London Bleeds: how the world, the player's turn, and the AI narrator relate. Story-specific names (Whitechapel, Holmes) are deliberately absent; this is the vocabulary any story on the engine shares.

## Language

### The turn

**Turn**:
One unit of play: a single player input (or a Tick) resolved by the engine and then narrated. Every change to the world happens inside a turn.

**Intent**:
The typed meaning of a player's input: a verb plus its targets, chosen from what the world currently offers. Never free text.
_Avoid_: command, action (reserved for the resolved outcome)

**Tick**:
A turn the player did not type: the world advancing on its own after a period of inactivity or an explicit wait. Resolved exactly like any other intent, so the world stays deterministic and replayable.
_Avoid_: idle event, real-time update

### Fact and flavour

**Fact**:
Something true in the world that the engine owns: a clue, an exit, an item's whereabouts, who knows what, where a person is. Only the engine may create or change a Fact.

**Flavour**:
Descriptive detail the narrator is allowed to improvise because it carries no Fact: the grain of a table, a passer-by's cough, period small talk. Flavour may never imply a Fact.

**Observation**:
A piece of Flavour that, once narrated, is written back into the world so later turns repeat it consistently. Improvisation becomes canon the moment it is spoken.
_Avoid_: STIM, stim observation

### World

**Story**:
Everything authored for one game: its locations, people, objects, facts, rules and beats, held as data the engine loads. The engine knows no particular Story.
_Avoid_: manifest, story data, content

**Object**:
Anything in the world the player can target by name: a thing in a location, a thing carried, a document. One identity whether it lies on a table or sits in the player's bag.
_Avoid_: interactable, takeable, inventory entry

**Item**:
An Object that can be carried. The player's inventory is the set of Items they hold.

**Period**:
A named stretch of the day that a Story declares, with its start time. Schedules and conditions refer to Periods; the engine knows nothing about dawn or dusk until a Story names them.
_Avoid_: time period, time of day

**Weather**:
A named weather state a Story declares. Acts and conditions refer to it by id.

**Candidate Set**:
Everything the player could mean right now: Objects here and carried, people present, exits, topics the addressed person can speak to. The parser must choose from it or decline.

### Rules

**Rule**:
An authored "when this, then that": a Trigger paired with Effects. The only way a Story changes the world beyond the built-in verbs; puzzles, scripted scenes, scheduled happenings and ambient life are all Rules.
_Avoid_: story event, world event, custom event, scripted line

**Trigger**:
The condition under which a Rule fires: an action on an Object, a flag becoming true, entering a location, a clock time, a Tick, combining Items, a person coming near.

**Effect**:
A change a Rule makes when it fires: set a flag, reveal or hide an Object, lock or unlock an exit, move or summon a person, give or take an Item, grant a Fact to a person, play a Beat, advance the act.

**Beat**:
An authored line or set of lines the narrator must carry into prose this turn. A Beat is a constraint on the narration, not the narration itself.

### Memory

**Disclosure Ledger**:
The engine's mechanical record, per person, of which Facts that person has told the player and which the player has told them. Written by the engine when a topic resolves, never by the narrator.
_Also called_: Ledger
_Avoid_: NPC memory, memory summary

**Transcript**:
The verbatim recent exchanges between the player and one person, kept alongside their Disclosure Ledger so the narrator can match tone and refer back to actual words.

### State

**Event**:
One record of something that happened in a game: a turn resolved, a Fact created, a Rule fired, a Tick passed. The game's state is nothing but the replay of its Events.
_Avoid_: log entry, save data, snapshot

**Investigation**:
One playthrough: a single ordered log of Events from the opening to the current turn, owned by one player account.
_Avoid_: save slot, game, session

## Relationships

- A **Turn** resolves exactly one **Intent** (a **Tick** is an Intent with no author).
- Resolving a Turn may create **Facts**; narrating a Turn may create **Observations**, never Facts.
- A **Disclosure Ledger** entry always points at a **Fact**; a **Transcript** points at nothing and proves nothing.
- A **Story** is made of locations, people, **Objects**, **Facts**, **Rules** and **Beats**; a **Rule** has one **Trigger** and one or more **Effects**.
- An **Investigation** is an ordered list of **Events**; replaying it yields the current state, the feed and the diary.
- The **Candidate Set** is computed from state each **Turn**; an **Intent** may only reference members of it.

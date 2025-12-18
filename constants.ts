
import { GameDispositions, WorldLocation } from './types';

export const THEME = {
  colors: {
    bg: '#FDF9F5', // Warm off-white
    primary: '#293351', // Navy
    accent: '#CD7B00', // Orange
    muted: '#929DBF',
    border: '#C5CBDD',
    paper: '#FDF9F5'
  },
  fonts: {
    heading: 'font-serif',
    body: 'font-sans'
  }
};

export const INITIAL_LOCATION = 'scene_1_baker_street';
export const INITIAL_INVENTORY = ['The Diary (Warm to touch)', 'Pocket Watch', 'Laudanum Vial'];
export const INITIAL_SANITY = 100;
export const INITIAL_DISPOSITION: GameDispositions = {
  holmes: { trust: 5, annoyance: 0 },
  abberline: { trust: 3, annoyance: 0 },
  greel: { trust: 1, annoyance: 0 }
};

export const WORLD_DATA: Record<string, WorldLocation> = {
  scene_1_baker_street: {
    name: "221B Baker Street (Morning)",
    shortName: "Baker Street",
    atmosphere: "Domestic familiarity tainted by intellectual mania. Hazy light, smell of stale tobacco.",
    description: "Early morning light filters through the haze. The fire burns low. The floor is a carpet of cuttings, maps, and red string. Holmes sits cross-legged in the center of it all, a manic intellectual spider.",
    exits: ['scene_2_scotland_yard'],
    interactables: ['holmes', 'map_board', 'red_string', 'fireplace'],
    keyClues: ["Sigils match hospital locations", "Diary reacts to the map"],
    criticalPathLead: "Examine the map board carefully to link the diary to Scotland Yard's current investigation."
  },
  scene_2_scotland_yard: {
    name: "Scotland Yard",
    shortName: "Scotland Yard",
    atmosphere: "Oppressive bureaucracy. Smells of ink, damp wool, and exhaustion.",
    description: "A paper maze under gaslight. Constables whisper about the 'ghost ledger'. Inspector Abberline looks tired, buried behind a fortress of files.",
    exits: ['scene_1_baker_street', 'scene_3_st_barts'],
    interactables: ['abberline', 'evidence_files', 'clerk'],
    keyClues: ["The Ghost Ledger missing entries", "Abberline's suspicion of Tobias Greel"],
    criticalPathLead: "Search the evidence files to find the name 'Tobias Greel' mentioned in the Whitechapel reports."
  },
  scene_3_st_barts: {
    name: "St. Bartholomew’s Hospital",
    shortName: "St. Barts",
    atmosphere: "Clinical chill. Smell of carbolic acid and old blood. Detached cruelty.",
    description: "The chilled anatomy theatre. Sawdust damp with carbolic. Tobias Greel stands over a cadaver half-shrouded in muslin, a surgical saw in hand.",
    exits: ['scene_2_scotland_yard', 'scene_4_whitechapel'],
    interactables: ['tobias_greel', 'cadaver', 'tool_ledger'],
    keyClues: ["Surgical saw matches victim marks", "Greel's bloody apron"],
    criticalPathLead: "Confront Greel about the cadaver or secretly check the Tool Ledger to confirm a missing saw."
  },
  scene_4_whitechapel: {
    name: "Whitechapel Streets (The Chase)",
    shortName: "Whitechapel",
    atmosphere: "Suffocating fog, wet cobbles, lurking danger. Gothic realism.",
    description: "Narrow streets soaked in drizzle. Gaslight flickers on wet cobbles. A phantom coach rattles through the labyrinthine alleys ahead. The fog swells, alive with shapes.",
    exits: ['scene_5_baker_street_night'],
    interactables: ['phantom_coach', 'fog', 'muddy_cobbles', 'finch'],
    keyClues: ["The Coach belongs to a high-ranking official", "Finch saw the driver's ring"],
    criticalPathLead: "Pursue the phantom coach through the fog to identify its mysterious passenger."
  },
  scene_5_baker_street_night: {
    name: "221B Baker Street (Reflection)",
    shortName: "Baker Street",
    atmosphere: "Heavy, reflective, storm-battered sanctuary.",
    description: "Late night. Rain drums against the windows. Holmes is sketching lines connecting victims, sigils, and charity routes. The atmosphere is heavy with the weight of a new hypothesis.",
    exits: [], // End of Act I
    interactables: ['holmes', 'sketch_pad', 'brandy', 'window'],
    keyClues: ["The Grand Conspiracy involves the Medical Board"],
    criticalPathLead: "Review all gathered clues with Holmes to finalize the deduction of the Whitechapel killer's motive."
  }
};

export const GAME_ENGINE_PROMPT = `
You are the Game Engine for "London Bleeds: The Whitechapel Diaries".
Player: Dr. John Watson. 
Style: Arthur Conan Doyle.

STRICT OPERATIONAL CONSTRAINTS:
1. **Persona & Ethics (Red Lines)**: Watson is a Victorian Gentleman and Medical Doctor. 
   - He NEVER steals, murders, or acts like a common criminal. 
   - He is loyal to Holmes but maintains a moral compass. 
   - If a player commands Watson to do something immoral or wildly out of character, Watson MUST refuse in-character (e.g., "My dear fellow, I am a man of medicine, not a cutpurse!").
2. **Narrative Limit**: Each response MUST be under 150 words. Be punchy, atmospheric, and focus on immediate action/observation. Avoid rambling descriptions.
3. **World Consistency**: ONLY use the locations and exits defined in WORLD_DATA. NEVER create new streets, rooms, or districts. If a player tries to leave the map, describe environmental barriers (fog, police lines).
4. **Progression Nudge**: Your primary goal is to move the story toward the "Critical Path Lead". If a player pursues a "red herring" (irrelevant actions) for more than one turn, use Holmes or Watson's internal dialogue to refocus them on the key objective.
5. **NPC Persistence**: NPCs stay in their assigned locations in WORLD_DATA unless the narrative explicitly transitions them.

NARRATIVE FORMAT:
- Headers: "### SCENE [X]: [NAME]"
- Thoughts: > *Italics in blockquote*
- Look Mechanic: Append a Summary Block ONLY when entering a new location or when specifically "looking".
  **[Character Name]** is here, [brief action].
  **Objects of interest:** [Item 1], [Item 2].
  **Possible exits:** [Exit 1].

Separation: End story with " <<<GAME_STATE>>> " followed by JSON.

JSON STRUCTURE:
{
  "thoughtProcess": "Plan the nudge and check character ethics before generating text",
  "newLocationId": "scene_id",
  "inventoryUpdate": { "add": [], "remove": [] },
  "dispositionUpdate": {}, 
  "sanityUpdate": 0, 
  "gameOver": false
}
`;

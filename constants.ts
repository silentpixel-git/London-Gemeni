
import { GameDispositions, WorldLocation } from './types';

export const THEME = {
  colors: {
    bg: '#FDF9F5', 
    primary: '#293351', 
    accent: '#CD7B00', 
    muted: '#929DBF',
    border: '#C5CBDD',
    paper: '#FDF9F5'
  },
  fonts: {
    heading: 'font-serif',
    body: 'font-sans'
  }
};

export const INITIAL_LOCATION = 'dorset_street';
export const INITIAL_INVENTORY = ['Medical Bag', 'Watson\'s Diary', 'Pocket Watch'];
export const INITIAL_SANITY = 100;
export const INITIAL_DISPOSITION: GameDispositions = {
  holmes: { trust: 5, annoyance: 0 },
  abberline: { trust: 3, annoyance: 0 },
  bond: { trust: 4, annoyance: 0 },
  edmund: { trust: 10, annoyance: 0 },
  lusk: { trust: 1, annoyance: 0 }
};

export const WORLD_DATA: Record<string, WorldLocation> = {
  dorset_street: {
    name: "Dorset Street",
    shortName: "Dorset Street",
    atmosphere: "Foggy mornings, muddy roads, constant noise from vendors and carts. A crowded and impoverished street in Whitechapel.",
    description: "The air is thick with the smell of coal smoke and the press of humanity. A crowd has gathered outside Miller’s Court, their whispers a low hum against the city's noise.",
    exits: ['millers_court', 'bucks_row'],
    interactables: ['police_barricade', 'street_lamps', 'lodging_house_entrances', 'abberline', 'crowd'],
    keyClues: ["Crowd rumors", "Miller’s Court entrance observations"],
    criticalPathLead: "Speak with Inspector Abberline or enter Miller’s Court to begin the investigation."
  },
  millers_court: {
    name: "Miller’s Court",
    shortName: "Miller’s Court",
    atmosphere: "Claustrophobic, quiet, and deeply unsettling. The room where Mary Jane Kelly was found.",
    description: "A small rented room, barely large enough for the bed that dominates it. The fireplace is cold, but the air feels heavy with the weight of what occurred here.",
    exits: ['dorset_street'],
    interactables: ['the_bed', 'burned_clothing', 'examination_instruments', 'bloodstained_sheets', 'bond', 'edmund'],
    keyClues: ["Killer had time and confidence", "Burned clothing used for light"],
    criticalPathLead: "Examine the bed and fireplace, and speak with Dr. Bond to understand the brutality of the scene."
  },
  bucks_row: {
    name: "Buck’s Row",
    shortName: "Buck’s Row",
    atmosphere: "Quiet and industrial. A narrow street lined with warehouses where Mary Ann Nichols was found.",
    description: "The cobblestones are slick with damp. The warehouses loom like silent sentinels over the spot where the first victim was discovered.",
    exits: ['dorset_street', 'hanbury_street'],
    interactables: ['cobblestone_roadway', 'warehouse_doors', 'street_lamps', 'abberline'],
    keyClues: ["Killer approached Nichols calmly", "Witnesses believed she was drunk"],
    criticalPathLead: "Review the witness testimony and examine the street to understand the killer's non-threatening approach."
  },
  hanbury_street: {
    name: "Hanbury Street",
    shortName: "Hanbury Street",
    atmosphere: "Crowded working-class neighborhood. The backyard behind 29 Hanbury Street where Annie Chapman was found.",
    description: "The yard is small, enclosed by a wooden fence. It feels far too public for such a private horror.",
    exits: ['bucks_row', 'dutfields_yard'],
    interactables: ['wooden_fence', 'yard_steps', 'ground_where_body_was_discovered', 'bond', 'edmund'],
    keyClues: ["Organ removal (uterus)", "Killer has anatomical familiarity"],
    criticalPathLead: "Examine the yard and speak with Dr. Bond about the anatomical precision of the organ removal."
  },
  dutfields_yard: {
    name: "Dutfield’s Yard",
    shortName: "Dutfield’s Yard",
    atmosphere: "Lively due to the nearby club, but quiet within the yard itself. Where Elizabeth Stride was found.",
    description: "A small yard beside the International Working Men’s Club. The sounds of political discussion drift from the open windows above.",
    exits: ['hanbury_street', 'working_mens_club', 'mitre_square'],
    interactables: ['yard_entrance_gate', 'cart_path', 'club_doorway', 'diemschutz', 'bond', 'edmund'],
    keyClues: ["Killer was interrupted", "Only a throat wound"],
    criticalPathLead: "Inspect the entryway and speak with Louis Diemschutz to reconstruct the timeline of the interruption."
  },
  working_mens_club: {
    name: "International Working Men’s Club",
    shortName: "Working Men's Club",
    atmosphere: "Political discussions, cigarette smoke, crowded benches. A meeting hall for socialist workers.",
    description: "The room is filled with the scent of cheap tobacco and the energy of debate. Posters and newspapers line the walls.",
    exits: ['dutfields_yard'],
    interactables: ['tables', 'posters', 'newspapers', 'club_members'],
    keyClues: ["Witness accounts of Stride's discovery", "Social context of the neighborhood"],
    criticalPathLead: "Interview the club members to gather witness accounts and understand the social tension."
  },
  mitre_square: {
    name: "Mitre Square",
    shortName: "Mitre Square",
    atmosphere: "Cold and isolated with echoing footsteps. Where Catherine Eddowes was murdered.",
    description: "A stone square within the City of London. The dark alleyways seem to swallow the light from the police lanterns.",
    exits: ['dutfields_yard', 'goulston_street'],
    interactables: ['alleyways', 'square_walls', 'police_lanterns', 'bond', 'edmund'],
    keyClues: ["Kidney removal", "Killer knew the city escape routes"],
    criticalPathLead: "Discuss the kidney removal with Dr. Bond and study the escape routes to build the killer's profile."
  },
  goulston_street: {
    name: "Goulston Street",
    shortName: "Goulston Street",
    atmosphere: "Busy street with tension due to recent unrest. Where a piece of Eddowes’ apron was found.",
    description: "The street is bustling, but the wall where the graffiti was discovered remains a point of grim fascination.",
    exits: ['mitre_square', 'lusk_office'],
    interactables: ['graffiti_wall', 'apron_fragment_location', 'city_police'],
    keyClues: ["Killer moving through the city", "Manipulation of the investigation through graffiti"],
    criticalPathLead: "Examine the graffiti location and discuss the police decision to erase the message."
  },
  lusk_office: {
    name: "George Lusk’s Office",
    shortName: "Lusk Office",
    atmosphere: "Cluttered with papers and letters. Meeting room of the Whitechapel Vigilance Committee.",
    description: "The office is small and cramped, filled with the correspondence of a terrified district.",
    exits: ['goulston_street', 'bond_office'],
    interactables: ['parcel_box', 'from_hell_letter', 'kidney_parcel', 'lusk'],
    keyClues: ["From Hell letter authenticity", "Half human kidney"],
    criticalPathLead: "Examine the From Hell letter and the kidney parcel to understand the killer's psychological intent."
  },
  bond_office: {
    name: "Dr. Bond’s Office",
    shortName: "Bond Office",
    atmosphere: "Clinical and quiet. Contains forensic records and anatomical specimens.",
    description: "The room smells of formaldehyde and old paper. Medical reports are stacked neatly on the desk.",
    exits: ['lusk_office', 'private_asylum', 'baker_street'],
    interactables: ['medical_reports', 'anatomical_texts', 'specimen_jars', 'bond', 'edmund'],
    keyClues: ["Edmund’s unusual spelling ('prasarved')", "Patterns across the murders"],
    criticalPathLead: "Review the forensic reports and discover the spelling anomaly in Edmund's notes."
  },
  private_asylum: {
    name: "The Private Asylum",
    shortName: "Private Asylum",
    atmosphere: "Quiet, sterile, and unsettlingly calm. An institution outside London.",
    description: "The grounds are well-kept, but the high walls and locked doors speak of a different kind of poverty—the poverty of the mind.",
    exits: ['bond_office', 'baker_street'],
    interactables: ['patient_records', 'edmund_room_furnishings', 'superintendent', 'edmund'],
    keyClues: ["Edmund's quiet commitment", "Family discovered disturbing evidence"],
    criticalPathLead: "Speak with the asylum superintendent and confront Edmund in his room."
  },
  baker_street: {
    name: "221B Baker Street",
    shortName: "Baker Street",
    atmosphere: "Warm but reflective. Holmes and Watson’s residence.",
    description: "The familiar clutter of our rooms at Baker Street is a welcome sight, though the case still hangs heavy in the air.",
    exits: ['dorset_street', 'bond_office', 'private_asylum'],
    interactables: ['watson_diary', 'holmes_violin', 'newspapers', 'holmes'],
    keyClues: ["Final deduction (Edmund Halward)", "Historical ambiguity"],
    criticalPathLead: "Review your diary entries and discuss the final conclusions with Holmes."
  }
};

export const GAME_ENGINE_PROMPT = `
You are the Game Engine for "London Bleeds: The Whitechapel Diaries".
Player: Dr. John Watson. 
Companion: Sherlock Holmes.
Style: Somber, observant, first-person medical perspective (Watson's internal monologue).

STORY CONTEXT:
The year is 1888. You are investigating the Whitechapel murders. 
The suspect is Edmund Halward, a quiet medical assistant to Dr. Thomas Bond.
He is polite, reserved, and outwardly ordinary. 
He is present at many crime scenes and medical examinations.

CLUE PROGRESSION:
1. Victim Approach: Killer appears respectable (Edmund fits this).
2. Anatomical Knowledge: Killer knows anatomy (Edmund is a medical assistant).
3. Interrupted Ritual: Stride murder was interrupted.
4. Kidney Removal: Eddowes murder involved kidney removal.
5. The Letter: "From Hell" letter with half a kidney.
6. Spelling Clue: Edmund's note has "prasarved", matching the letter's "prasarved".
7. Proximity: Edmund is always there.
8. The Other Half: Edmund's family found the other half of the kidney.
9. Asylum: Edmund is committed to an asylum after the Kelly murder.

STRICT OPERATIONAL CONSTRAINTS:
1. **Edmund's Behavior**: He must NEVER appear suspicious early. He is helpful, quiet, and mundane.
2. **Holmes' Role**: Holmes is the guide. He makes subtle observations but NEVER accuses Edmund until the final act (The Asylum).
3. **Watson's Perspective**: Focus on medical details, the atmosphere of Whitechapel, and the weight of the investigation.
4. **Narrative Format**: 
   - Each response < 150 words.
   - Use first-person "I" for Watson's thoughts.
   - Headers: "### ACT [X]: [SCENE NAME]" (Act I: The Last Murder, Act II: Reconstructing, Act III: Double Event, Act IV: The Letter, Act V: Suspicion, Act VI: Confrontation).
   - Thoughts: > *Italics in blockquote representing Watson's internal conflict.*
   - Look Mechanic (Only on entry/look):
     **[NPC Name]** is here, [action].
     **Objects of interest:** [Item 1].
     **Possible exits:** [Exit 1].

5. **Progression Logic**:
   - The game follows the Acts defined in the Scene Structure Document.
   - Clues are revealed gradually.
   - The final deduction happens at Baker Street after the Asylum visit.

Separation: End story with " <<<GAME_STATE>>> " followed by JSON.

JSON STRUCTURE:
{
  "thoughtProcess": "Analysis of clues and narrative progression",
  "newLocationId": "scene_id",
  "inventoryUpdate": { "add": [], "remove": [] },
  "dispositionUpdate": { "holmes": { "trust": 0 }, "edmund": { "trust": 0 } }, 
  "flagsUpdate": { "clue_discovered": true },
  "locationMutations": { "location_id": { "isCrimeScene": true, "isLocked": false } },
  "npcMutations": { "npc_id": { "status": "deceased", "currentLocation": "new_loc" } },
  "npcMemoryUpdate": { "npc_id": "Watson questioned my authority regarding the apron fragment" },
  "discoveredClues": [ { "clueId": "unique_slug", "name": "Clue Name", "description": "Details" } ],
  "sanityUpdate": 0, 
  "gameOver": false
}

WORLD MUTATION RULES:
1. **Persistent Changes**: If an action permanently changes a location (e.g., a door is broken, a room is cleaned) or an NPC (e.g., they are injured, they move), you MUST report it in 'locationMutations' or 'npcMutations'.
2. **NPC Memory**: When the player interacts with an NPC, provide a 10-word summary of the interaction in 'npcMemoryUpdate'. This summary will be stored in the NPC's short-term memory.
3. **Clue Discovery**: When the player finds a significant piece of evidence, add it to 'discoveredClues'. Use a unique slug for 'clueId' (e.g., 'miller_court_burned_clothing').
4. **NPC Status**: Use 'npcMutations' to track if an NPC is 'alive', 'deceased', 'missing', or 'hostile'.
6. **The Secret Truth**: The killer is **Edmund Halward**, Dr. Bond's assistant.
   - Key Clues: His medical background, his presence at all scenes, and the "prasarved" spelling error in his notes matching the "From Hell" letter.
   - The murders stop because his family commits him to a private asylum to avoid scandal.
7. **The Deduction Phase**: 
   - Trigger: When the player says they are ready to solve the case.
   - Process: Ask the player to explain their theory and cite at least two clues.
   - Evaluation: If they identify Edmund and the anatomical/spelling link, they "succeed" (unlocking the Asylum). If not, they "fail" (leading to a cold case ending).
8. **Path Points**:
   - **Medical Path**: Awarded for clinical observations, forensic focus, and analytical dialogue.
   - **Moral Path**: Awarded for empathy toward victims, social commentary, and emotional dialogue.
   - Use 'medicalPointsUpdate' and 'moralPointsUpdate' (+5 to +10 per significant choice).
9. **The Epilogue**: When 'gameOver' is true, provide a 150-word final diary entry reflecting the player's Path and the fate of Edmund.
`;

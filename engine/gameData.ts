/**
 * engine/gameData.ts
 *
 * The canonical, immutable source of truth for all game world data.
 * The TypeScript Game Engine enforces these rules. The AI only narrates outcomes.
 *
 * Data sourced from /Documentation/first-draft/ documents.
 */

// ============================================================
// TYPES (inline to avoid circular deps)
// ============================================================

export interface LocationDefinition {
  id: string;
  name: string;
  shortName: string;
  act: number;                     // Minimum act required to access this location
  atmosphere: string;
  description: string;
  exits: string[];                 // Location IDs. Engine validates these.
  interactables: string[];         // Object IDs present here
  keyClues: string[];              // Hint text for critical path
  criticalPathLead: string;
  locationExaminedFlag: string;    // Flag set when player examines anything here
}

export interface NPCDefinition {
  id: string;
  displayName: string;
  role: string;
  description: string;
  speakingStyle: string;
  personality: string[];
  publicKnowledge: string[];  // Facts/topics this NPC knows and can discuss
  followingRule: 'follows_watson' | 'follows_bond' | 'location_based' | 'fixed';
  canonicalLocationByAct: Record<number, string>;  // Act number → location ID
}

export interface ClueDefinition {
  id: string;
  name: string;
  description: string;           // What Watson records
  holmesDeduction: string;       // What Holmes concludes
  locationFound: string;         // Location ID where this clue is found
  triggerObject: string;         // Object ID that triggers this clue
  connections: string[];         // Related clue IDs
  clueGroup: number;             // 1-10 from clues.md
  medicalPoints: number;         // Points awarded (medical path)
  moralPoints: number;           // Points awarded (moral path)
}

export interface ActCondition {
  name: string;
  requireFlags: string[];        // All must be set to auto-advance
  advanceTo: number;
}

// ============================================================
// LOCATIONS
// ============================================================

export const LOCATIONS: Record<string, LocationDefinition> = {
  dorset_street: {
    id: 'dorset_street',
    name: 'Dorset Street',
    shortName: 'Dorset Street',
    act: 1,
    atmosphere: 'Foggy mornings, muddy roads, constant noise from vendors and carts. A crowded and impoverished street in Whitechapel.',
    description: "The air is thick with the smell of coal smoke and the press of humanity. A crowd has gathered outside Miller's Court, their whispers a low hum against the city's noise.",
    exits: ['millers_court', 'bucks_row'],
    interactables: ['police_barricade', 'street_lamps', 'lodging_house_entrances', 'crowd'],
    keyClues: ["Crowd rumors about Miller's Court", "Abberline can brief Watson on the situation"],
    criticalPathLead: "Speak with Inspector Abberline or enter Miller's Court to begin the investigation.",
    locationExaminedFlag: 'examined_dorset_street',
  },
  millers_court: {
    id: 'millers_court',
    name: "13 Miller's Court",
    shortName: "13 Miller's Court",
    act: 1,
    atmosphere: 'Claustrophobic, quiet, and deeply unsettling. The room where Mary Jane Kelly was found.',
    description: 'A small rented room, barely large enough for the bed that dominates it. The fireplace is cold, but the air feels heavy with the weight of what occurred here.',
    exits: ['dorset_street'],
    interactables: ['the_bed', 'burned_clothing', 'examination_instruments', 'bloodstained_sheets'],
    keyClues: ['Killer had time and confidence', 'Burned clothing used for light', 'Extensive mutilation indicates medical familiarity'],
    criticalPathLead: "Examine the bed and fireplace, and speak with Dr. Bond to understand the brutality of the scene.",
    locationExaminedFlag: 'examined_millers_court',
  },
  bucks_row: {
    id: 'bucks_row',
    name: "Buck's Row",
    shortName: "Buck's Row",
    act: 2,
    atmosphere: 'Quiet and industrial. A narrow street lined with warehouses where Mary Ann Nichols was found.',
    description: 'The cobblestones are slick with damp. The warehouses loom like silent sentinels over the spot where the first victim was discovered.',
    exits: ['dorset_street', 'hanbury_street'],
    interactables: ['cobblestone_roadway', 'warehouse_doors', 'street_lamps'],
    keyClues: ['Killer approached Nichols calmly', 'Witnesses believed she was merely drunk'],
    criticalPathLead: "Review the witness testimony and examine the street to understand the killer's non-threatening approach.",
    locationExaminedFlag: 'examined_bucks_row',
  },
  hanbury_street: {
    id: 'hanbury_street',
    name: 'Hanbury Street',
    shortName: 'Hanbury Street',
    act: 2,
    atmosphere: 'Crowded working-class neighborhood. The backyard behind 29 Hanbury Street where Annie Chapman was found.',
    description: 'The yard is small, enclosed by a wooden fence. It feels far too public for such a private horror.',
    exits: ['bucks_row', 'dutfields_yard'],
    interactables: ['wooden_fence', 'yard_steps', 'ground_where_body_was_discovered'],
    keyClues: ['Organ removal (uterus)', 'Killer has anatomical familiarity'],
    criticalPathLead: "Examine the yard and speak with Dr. Bond about the anatomical precision of the organ removal.",
    locationExaminedFlag: 'examined_hanbury_street',
  },
  dutfields_yard: {
    id: 'dutfields_yard',
    name: "Dutfield's Yard",
    shortName: "Dutfield's Yard",
    act: 3,
    atmosphere: 'Lively due to the nearby club, but quiet within the yard itself. Where Elizabeth Stride was found.',
    description: 'A small yard beside the International Working Men\'s Club. The sounds of political discussion drift from the open windows above.',
    exits: ['hanbury_street', 'working_mens_club', 'mitre_square'],
    interactables: ['yard_entrance_gate', 'cart_path', 'club_doorway'],
    keyClues: ['Killer was interrupted', 'Only a throat wound — no mutilation'],
    criticalPathLead: "Inspect the entryway and speak with Louis Diemschutz to reconstruct the timeline of the interruption.",
    locationExaminedFlag: 'examined_dutfields_yard',
  },
  working_mens_club: {
    id: 'working_mens_club',
    name: "International Working Men's Club",
    shortName: "Working Men's Club",
    act: 3,
    atmosphere: 'Political discussions, cigarette smoke, crowded benches. A meeting hall for socialist workers.',
    description: 'The room is filled with the scent of cheap tobacco and the energy of debate. Posters and newspapers line the walls.',
    exits: ['dutfields_yard'],
    interactables: ['tables', 'posters', 'newspapers', 'club_members'],
    keyClues: ["Witness accounts of Stride's discovery", 'Social context of the neighbourhood'],
    criticalPathLead: "Interview the club members to gather witness accounts and understand the social tension.",
    locationExaminedFlag: 'examined_working_mens_club',
  },
  mitre_square: {
    id: 'mitre_square',
    name: 'Mitre Square',
    shortName: 'Mitre Square',
    act: 3,
    atmosphere: 'Cold and isolated with echoing footsteps. Where Catherine Eddowes was murdered.',
    description: 'A stone square within the City of London. The dark alleyways seem to swallow the light from the police lanterns.',
    exits: ['dutfields_yard', 'goulston_street'],
    interactables: ['alleyways', 'square_walls', 'police_lanterns'],
    keyClues: ['Kidney removal', 'Killer knew the city and its escape routes'],
    criticalPathLead: "Discuss the kidney removal with Dr. Bond and study the escape routes to build the killer's profile.",
    locationExaminedFlag: 'examined_mitre_square',
  },
  goulston_street: {
    id: 'goulston_street',
    name: 'Goulston Street',
    shortName: 'Goulston Street',
    act: 4,
    atmosphere: 'Busy street with tension due to recent unrest. Where a piece of Eddowes\' apron was found.',
    description: "The street is bustling, but the wall where the graffiti was discovered remains a point of grim fascination. The Metropolitan Police erased the chalk writing before it could be photographed.",
    exits: ['mitre_square', 'lusk_office'],
    interactables: ['graffiti_wall', 'apron_fragment_location'],
    keyClues: ['Killer moving between jurisdictions', 'Apron fragment links Mitre Square to Goulston Street', 'Graffito erased — possibly anti-Semitic'],
    criticalPathLead: "Examine the graffiti location and discuss the police decision to erase the crucial message.",
    locationExaminedFlag: 'examined_goulston_street',
  },
  lusk_office: {
    id: 'lusk_office',
    name: "George Lusk's Office",
    shortName: 'Lusk Office',
    act: 4,
    atmosphere: 'Cluttered with papers and letters. Meeting room of the Whitechapel Vigilance Committee.',
    description: 'The office is small and cramped, filled with the correspondence of a terrified district.',
    exits: ['goulston_street', 'bond_office'],
    interactables: ['parcel_box', 'from_hell_letter', 'kidney_parcel'],
    keyClues: ['From Hell letter with irregular spelling', 'Half a human kidney — Watson can confirm it is human'],
    criticalPathLead: "Examine the From Hell letter carefully — note the spelling — and have Watson examine the kidney parcel.",
    locationExaminedFlag: 'examined_lusk_office',
  },
  bond_office: {
    id: 'bond_office',
    name: "Dr. Bond's Office",
    shortName: 'Bond Office',
    act: 5,
    atmosphere: 'Clinical and quiet. Contains forensic records and anatomical specimens.',
    description: 'The room smells of formaldehyde and old paper. Medical reports are stacked neatly on the desk.',
    exits: ['lusk_office', 'private_asylum', 'baker_street'],
    interactables: ['medical_reports', 'anatomical_texts', 'specimen_jars', 'edmund_forensic_note'],
    keyClues: ["Edmund's forensic note contains 'prasarved' — matching the From Hell letter", 'Patterns across all five murders'],
    criticalPathLead: "Review the forensic reports carefully. Look for Edmund's handwritten notes — the spelling anomaly is the critical link.",
    locationExaminedFlag: 'examined_bond_office',
  },
  private_asylum: {
    id: 'private_asylum',
    name: 'The Private Asylum',
    shortName: 'Private Asylum',
    act: 6,
    atmosphere: 'Quiet, sterile, and unsettlingly calm. An institution outside London.',
    description: "The grounds are well-kept, but the high walls and locked doors speak of a different kind of poverty — the poverty of the mind.",
    exits: ['bond_office', 'baker_street'],
    interactables: ['patient_records', 'edmund_room_furnishings', 'superintendent'],
    keyClues: ["Edmund committed after Kelly's murder", 'Family discovered disturbing medical evidence — a preserved kidney'],
    criticalPathLead: "Speak with the superintendent and confront Edmund in his room. He will remain calm.",
    locationExaminedFlag: 'visited_private_asylum',
  },
  baker_street: {
    id: 'baker_street',
    name: '221B Baker Street',
    shortName: 'Baker Street',
    act: 6,
    atmosphere: 'Warm but reflective. Holmes and Watson\'s residence.',
    description: "The familiar clutter of our rooms at Baker Street is a welcome sight, though the case still hangs heavy in the air.",
    exits: ['dorset_street', 'bond_office', 'private_asylum'],
    interactables: ['watson_diary', 'holmes_violin', 'newspapers'],
    keyClues: ['Final deduction — all clues point to Edmund Halward', 'Historical ambiguity — no legal proof'],
    criticalPathLead: "Review your diary entries and discuss the final conclusions with Holmes. The truth lies in the sum of all clues.",
    locationExaminedFlag: 'examined_baker_street',
  },
};

// ============================================================
// WHITECHAPEL HISTORICAL FACTS
// ============================================================
// Canonical facts for case-related dialogue. The AI uses these when NPCs speak about the investigation.

export const WHITECHAPEL_FACTS = {
  victims: [
    { name: 'Mary Ann Nichols', location: "Buck's Row", date: '31 August 1888' },
    { name: 'Annie Chapman', location: '29 Hanbury Street', date: '8 September 1888' },
    { name: 'Elizabeth Stride', location: "Dutfield's Yard", date: '30 September 1888 (interrupted)' },
    { name: 'Catherine Eddowes', location: 'Mitre Square', date: '30 September 1888 (double event, ~45 min after Stride)' },
    { name: 'Mary Jane Kelly', location: "Miller's Court", date: '9 November 1888 (killer had uninterrupted hours)' },
  ],
  forensics: {
    Chapman: 'Uterus removed; anatomical knowledge evident but not surgical mastery',
    Eddowes: 'Left kidney and uterus removed within minutes; consistent with repeated anatomical familiarity',
    Kelly: 'Most extensive injuries; fire burned through the night, providing light for the killer',
  },
  investigation: 'Over 2,000 people interviewed; Metropolitan Police (Abberline, H Division) and City Police (Eddowes scene) coordination has been problematic',
  pressureDynamics: 'The Star and Times printing speculation as fact; witnesses terrified into silence',
  fromHellLetter: {
    received: 'George Lusk, 16 October 1888',
    contents: 'Half a human kidney preserved in spirits of wine, letter beginning "From hell"',
    spelling: 'The word "prasarved" (for preserved) is idiosyncratic and consistent across the letter and other documents',
  },
};

// ============================================================
// NPC DEFINITIONS
// ============================================================

export const NPCS: Record<string, NPCDefinition> = {
  holmes: {
    id: 'holmes',
    displayName: 'Sherlock Holmes',
    role: 'Consulting Detective',
    description: 'Holmes investigates the Whitechapel murders unofficially, approaching the Ripper case as an intellectual problem. He follows Watson everywhere.',
    speakingStyle: 'Precise and controlled. Short observations and carefully constructed deductions.',
    personality: ['Analytical', 'Calm under pressure', 'Intensely curious', 'Occasionally aloof'],
    publicKnowledge: [
      'Visited all five crime scenes and conducted independent forensic analysis',
      'The killer appeared non-threatening to victims — respectable-looking or known to them',
      'Anatomical removals required knowledge of organ location, not surgical mastery — the knowledge of a student',
      'Not panicked by Stride\'s interruption — completed a second murder same night within 45 minutes',
      'The "prasarved" spelling in the From Hell letter is a specific cognitive habit, matching other documents',
      'The killer has legitimate professional access to crime scenes and forensic records',
      'Murders stopped after Kelly — suggests capture, death, confinement, or removal from London',
    ],
    followingRule: 'follows_watson',
    canonicalLocationByAct: {
      1: 'dorset_street',
      2: 'bucks_row',
      3: 'dutfields_yard',
      4: 'goulston_street',
      5: 'bond_office',
      6: 'private_asylum',
    },
  },
  abberline: {
    id: 'abberline',
    displayName: 'Inspector Abberline',
    role: 'Scotland Yard Detective Inspector',
    description: 'Lead investigator for Scotland Yard. Experienced, honest, and deeply fatigued by the lack of progress.',
    speakingStyle: 'Direct and conversational. Practical rather than theoretical.',
    personality: ['Practical', 'Honest', 'Determined', 'Fatigued'],
    publicKnowledge: [
      'Leads the Metropolitan Police investigation from Commercial Street station',
      'Five victims: Mary Ann Nichols (31 Aug), Annie Chapman (8 Sep), Elizabeth Stride and Catherine Eddowes (30 Sep, double event), Mary Jane Kelly (9 Nov)',
      'The double event on 30 September was the worst night — two murders in 45 minutes, two different police jurisdictions',
      'City Police handled Eddowes at Mitre Square — inter-force coordination has been problematic throughout',
      'Commissioner Warren ordered the Goulston Street graffiti wiped before it could be photographed, to prevent anti-Jewish riots',
      'Over 2,000 people interviewed; no conclusive forensic link established to any individual',
      'The press — Star and Times in particular — prints speculation as fact and terrifies witnesses into silence',
      'No reliable witness has seen the killer with any victim; every description is contradictory',
      'George Lusk and the Vigilance Committee provide ground coverage but also pressure from below',
    ],
    followingRule: 'location_based',
    canonicalLocationByAct: {
      1: 'dorset_street',
      2: 'bucks_row',
      3: 'dutfields_yard',
      4: 'goulston_street',
      5: 'bond_office',
      6: 'private_asylum',
    },
  },
  bond: {
    id: 'bond',
    displayName: 'Dr. Thomas Bond',
    role: 'Police Surgeon',
    description: 'Responsible for examining the victims. Clinical, professional, and rarely speculates beyond medical facts.',
    speakingStyle: 'Technical and precise. Medical terminology.',
    personality: ['Clinical', 'Professional', 'Reserved'],
    publicKnowledge: [
      'Annie Chapman: uterus removed cleanly, incision shows familiarity with abdominal anatomy but not surgical mastery',
      'Catherine Eddowes: left kidney and uterus removed within minutes, efficiency consistent with prior practice',
      'Mary Jane Kelly: most extensive injuries, killer had several uninterrupted hours, fire burned for light',
      'Wrote a formal psychological profile in November 1888 for Assistant Commissioner Anderson',
      'His assessment: killer works alone, operates at night, has anatomical knowledge but no professional medical qualification',
      'Edmund Halward transcribed and catalogued all post-mortem reports',
      'Committed to reporting only what evidence substantiates — will not speculate beyond the record',
    ],
    followingRule: 'location_based',
    canonicalLocationByAct: {
      1: 'millers_court',
      2: 'bucks_row',
      3: 'dutfields_yard',
      4: 'lusk_office',
      5: 'bond_office',
      6: 'bond_office',
    },
  },
  edmund: {
    id: 'edmund',
    displayName: 'Edmund Halward',
    role: "Dr. Bond's Medical Assistant",
    description: 'Young, quiet, and outwardly respectable. Son of a physician. Studied medicine but left unexpectedly. Almost invisible. Never speaks unless directly addressed.',
    speakingStyle: 'Soft and measured. Avoids emotional language. Mundane and functional.',
    personality: ['Quiet', 'Polite', 'Reserved', 'Observant'],
    publicKnowledge: [
      'Medical assistant to Dr. Bond; present during post-mortem examinations',
      'Studied medicine but left formal training unexpectedly',
      'Quiet, polite, reserved — well-regarded by those who work with him',
    ],
    followingRule: 'follows_bond',
    canonicalLocationByAct: {
      1: 'millers_court',
      2: 'bucks_row',
      3: 'dutfields_yard',
      4: 'lusk_office',
      5: 'bond_office',
      6: 'private_asylum',
    },
  },
  lusk: {
    id: 'lusk',
    displayName: 'George Lusk',
    role: 'Chairman, Whitechapel Vigilance Committee',
    description: 'Recipient of the From Hell letter and the kidney parcel. Cautious and skeptical of hoaxes.',
    speakingStyle: 'Concerned but practical.',
    personality: ['Cautious', 'Uneasy about publicity', 'Skeptical'],
    publicKnowledge: [
      'Received the kidney parcel on 16 October 1888 — half a human kidney preserved in spirits of wine',
      'Initially assumed it was a prank by medical students; had it examined only after delay',
      'Dr. Openshaw confirmed the kidney was human tissue, female, approximately 45 years old, consistent with Bright\'s disease (matching Eddowes)',
      'The letter\'s phrasing stays with him: "I send you half the Kidne I took from one women prasarved it for you tother piece I fried and ate it was very nise"',
      'Founded the Whitechapel Vigilance Committee out of anger that the police were failing the neighbourhood',
      'Conducts nightly patrols; lobbied the Home Secretary for a government reward (refused)',
      'Distrusts the official investigation — not the men, but the machinery and inter-force politics',
    ],
    followingRule: 'fixed',
    canonicalLocationByAct: {
      1: 'lusk_office',
      2: 'lusk_office',
      3: 'lusk_office',
      4: 'lusk_office',
      5: 'lusk_office',
      6: 'lusk_office',
    },
  },
  diemschutz: {
    id: 'diemschutz',
    displayName: 'Louis Diemschutz',
    role: 'Steward, International Working Men\'s Club',
    description: 'Discovered Elizabeth Stride\'s body. Distressed witness.',
    speakingStyle: 'Shaken and direct.',
    personality: ['Distressed', 'Cooperative'],
    publicKnowledge: [
      'Found Elizabeth Stride\'s body in Dutfield\'s Yard on the night of 30 September',
      'His cart may have interrupted the killer mid-act — no mutilation followed the throat wound',
      'Witnessed or heard sounds that night; testimony was crucial to reconstructing the killer\'s timeline',
    ],
    followingRule: 'fixed',
    canonicalLocationByAct: {
      1: 'working_mens_club',
      2: 'working_mens_club',
      3: 'dutfields_yard',
      4: 'working_mens_club',
      5: 'working_mens_club',
      6: 'working_mens_club',
    },
  },
  superintendent: {
    id: 'superintendent',
    displayName: 'Asylum Superintendent',
    role: 'Superintendent of the Private Asylum',
    description: 'Professional but cautious about discussing patients.',
    speakingStyle: 'Measured and diplomatic.',
    personality: ['Professional', 'Guarded'],
    publicKnowledge: [
      'Manages a private asylum for those whose families wish discretion',
      'Edmund Halward has been a patient here following a family arrangement',
      'Speaks minimally about patients; will not volunteer information beyond what professional courtesy requires',
      'Believes private confinement is a humane solution for certain situations',
    ],
    followingRule: 'fixed',
    canonicalLocationByAct: {
      1: 'private_asylum',
      2: 'private_asylum',
      3: 'private_asylum',
      4: 'private_asylum',
      5: 'private_asylum',
      6: 'private_asylum',
    },
  },
};

// ============================================================
// CLUE DEFINITIONS  (10 groups from clues.md)
// ============================================================

export const CLUE_DEFINITIONS: Record<string, ClueDefinition> = {
  // GROUP 1 — Victim Approach Pattern
  clue_01_respectable_approach: {
    id: 'clue_01_respectable_approach',
    name: 'The Respectable Stranger',
    description: "Witnesses at Buck's Row believed Nichols was merely drunk, not attacked. The killer approached calmly — he appeared unthreatening, even respectable.",
    holmesDeduction: 'Our man moves among victims without raising alarm. He is not perceived as a threat. He presents well.',
    locationFound: 'bucks_row',
    triggerObject: 'cobblestone_roadway',
    connections: ['clue_01_killer_confidence', 'clue_09_medical_background'],
    clueGroup: 1,
    medicalPoints: 5,
    moralPoints: 0,
  },
  clue_01_killer_confidence: {
    id: 'clue_01_killer_confidence',
    name: "The Killer's Patience",
    description: "The burned clothing in Miller's Court fireplace was used as a light source. The killer remained in the room for an extended period — utterly unafraid of discovery.",
    holmesDeduction: 'He is not impulsive. He planned. He knew he would not be disturbed. A man of extraordinary nerve.',
    locationFound: 'millers_court',
    triggerObject: 'burned_clothing',
    connections: ['clue_01_respectable_approach'],
    clueGroup: 1,
    medicalPoints: 10,
    moralPoints: 5,
  },
  // GROUP 2 — Anatomical Knowledge
  clue_02_anatomical_knowledge: {
    id: 'clue_02_anatomical_knowledge',
    name: 'Anatomical Precision',
    description: "Dr. Bond's report on Annie Chapman: the uterus was surgically removed. The incision indicates familiarity with abdominal anatomy — not the work of a common butcher.",
    holmesDeduction: 'Medical student. Anatomical assistant. Slaughterman. One of these three. The precision narrows the field considerably.',
    locationFound: 'hanbury_street',
    triggerObject: 'ground_where_body_was_discovered',
    connections: ['clue_04_kidney_removal', 'clue_09_medical_background'],
    clueGroup: 2,
    medicalPoints: 10,
    moralPoints: 0,
  },
  // GROUP 3 — Interrupted Ritual
  clue_03_interrupted_ritual: {
    id: 'clue_03_interrupted_ritual',
    name: 'An Interrupted Man',
    description: "Stride's wound was a single throat cut — no mutilation followed. Diemschutz's cart interrupted the killer mid-act. He was compelled to seek another victim that same night.",
    holmesDeduction: 'The ritual was not completed. This man has a compulsion. The absence of mutilation here is itself the clue.',
    locationFound: 'dutfields_yard',
    triggerObject: 'yard_entrance_gate',
    connections: ['clue_04_kidney_removal'],
    clueGroup: 3,
    medicalPoints: 5,
    moralPoints: 5,
  },
  // GROUP 4 — Kidney Removal
  clue_04_kidney_removal: {
    id: 'clue_04_kidney_removal',
    name: 'The Removed Kidney',
    description: "Eddowes' left kidney was surgically excised within minutes. The speed and precision confirm repeated anatomical familiarity — this was not the first time he had handled such tissue.",
    holmesDeduction: 'He has done this before in a clinical setting. The kidney was not taken in panic. It was taken deliberately.',
    locationFound: 'mitre_square',
    triggerObject: 'square_walls',
    connections: ['clue_02_anatomical_knowledge', 'clue_05_human_kidney', 'clue_08_preserved_kidney'],
    clueGroup: 4,
    medicalPoints: 10,
    moralPoints: 0,
  },
  // GROUP 5 — The From Hell Letter
  clue_05_from_hell_letter: {
    id: 'clue_05_from_hell_letter',
    name: 'The From Hell Letter',
    description: 'A crude letter sent to George Lusk: "From hell, Mr Lusk, I send you half the Kidne I took from one women prasarved it for you tother piece I fried and ate it was very nise." The spelling is irregular but not illiterate.',
    holmesDeduction: 'He is educated enough to write — yet makes specific, consistent errors. This is not ignorance. These errors are his own.',
    locationFound: 'lusk_office',
    triggerObject: 'from_hell_letter',
    connections: ['clue_06_prasarved_spelling', 'clue_05_human_kidney'],
    clueGroup: 5,
    medicalPoints: 5,
    moralPoints: 5,
  },
  clue_05_human_kidney: {
    id: 'clue_05_human_kidney',
    name: 'The Kidney Parcel',
    description: 'Watson examines the preserved half-kidney sent to Lusk. It is unmistakably human. The renal artery has been cut approximately one inch from the organ — consistent with a surgical removal.',
    holmesDeduction: "Watson's confirmation is definitive. This is Catherine Eddowes' missing kidney. The letter writer is the murderer.",
    locationFound: 'lusk_office',
    triggerObject: 'kidney_parcel',
    connections: ['clue_04_kidney_removal', 'clue_06_prasarved_spelling', 'clue_08_preserved_kidney'],
    clueGroup: 5,
    medicalPoints: 10,
    moralPoints: 5,
  },
  // GROUP 6 — Edmund's Forensic Notes
  clue_06_prasarved_spelling: {
    id: 'clue_06_prasarved_spelling',
    name: "The 'Prasarved' Note",
    description: "Among Edmund Halward's forensic cataloguing notes, Watson finds a report containing the word 'prasarved' — the same idiosyncratic misspelling as in the From Hell letter.",
    holmesDeduction: "Two men do not spell 'preserved' as 'prasarved'. This is not coincidence. This is the same hand.",
    locationFound: 'bond_office',
    triggerObject: 'edmund_forensic_note',
    connections: ['clue_05_from_hell_letter', 'clue_07_edmunds_presence'],
    clueGroup: 6,
    medicalPoints: 10,
    moralPoints: 5,
  },
  // GROUP 7 — Edmund's Presence
  clue_07_edmunds_presence: {
    id: 'clue_07_edmunds_presence',
    name: "Edmund's Proximity",
    description: "Watson notes that Edmund Halward has been present at every significant stage of the investigation — Miller's Court, Buck's Row, Hanbury Street, and Bond's office. His presence has always seemed natural.",
    holmesDeduction: 'He is always there. At first I dismissed it as his function. Now I find I cannot dismiss it at all.',
    locationFound: 'bond_office',
    triggerObject: 'medical_reports',
    connections: ['clue_06_prasarved_spelling', 'clue_09_medical_background'],
    clueGroup: 7,
    medicalPoints: 5,
    moralPoints: 5,
  },
  // GROUP 8 — The Preserved Kidney
  clue_08_preserved_kidney: {
    id: 'clue_08_preserved_kidney',
    name: "The Other Half",
    description: "The asylum superintendent confirms: Edmund's family, upon discovering disturbing evidence in his room — a preserved human organ — arranged his quiet commitment. They did not contact the police.",
    holmesDeduction: "If the letter contained half the kidney, and his family found the other half — there is only one conclusion available to a rational mind.",
    locationFound: 'private_asylum',
    triggerObject: 'patient_records',
    connections: ['clue_05_human_kidney', 'clue_10_asylum_commitment'],
    clueGroup: 8,
    medicalPoints: 10,
    moralPoints: 10,
  },
  // GROUP 9 — Edmund's Medical Background
  clue_09_medical_background: {
    id: 'clue_09_medical_background',
    name: "An Incomplete Education",
    description: "Holmes' enquiries confirm: Edmund Halward studied medicine at a London institution but withdrew unexpectedly before completing his training. His father is a respected physician.",
    holmesDeduction: 'Anatomical knowledge. Access to medical settings. Social respectability. He fits every criterion of the profile I constructed.',
    locationFound: 'bond_office',
    triggerObject: 'anatomical_texts',
    connections: ['clue_02_anatomical_knowledge', 'clue_07_edmunds_presence'],
    clueGroup: 9,
    medicalPoints: 5,
    moralPoints: 0,
  },
  // GROUP 10 — Asylum Commitment
  clue_10_asylum_commitment: {
    id: 'clue_10_asylum_commitment',
    name: 'The Murders Stop',
    description: "Edmund was committed to the private asylum shortly after Mary Jane Kelly's murder on 9th November 1888. The Whitechapel murders ceased entirely from that date. The official reason is a vague reference to violent behaviour.",
    holmesDeduction: 'The murders stopped when Edmund was removed from society. That is not coincidence. That is causation.',
    locationFound: 'private_asylum',
    triggerObject: 'superintendent',
    connections: ['clue_08_preserved_kidney', 'clue_07_edmunds_presence'],
    clueGroup: 10,
    medicalPoints: 5,
    moralPoints: 10,
  },
};

// ============================================================
// CLUE TRIGGERS
// Map: locationId → objectId → clueId[]
// Engine checks this on every examine action.
// ============================================================

export const CLUE_TRIGGERS: Record<string, Record<string, string[]>> = {
  millers_court: {
    burned_clothing: ['clue_01_killer_confidence'],
    the_bed: [],
    bloodstained_sheets: [],
    examination_instruments: [],
  },
  bucks_row: {
    cobblestone_roadway: ['clue_01_respectable_approach'],
    warehouse_doors: [],
    street_lamps: [],
  },
  hanbury_street: {
    ground_where_body_was_discovered: ['clue_02_anatomical_knowledge'],
    wooden_fence: [],
    yard_steps: [],
  },
  dutfields_yard: {
    yard_entrance_gate: ['clue_03_interrupted_ritual'],
    cart_path: [],
    club_doorway: [],
  },
  working_mens_club: {
    club_members: [],
    tables: [],
    posters: [],
    newspapers: [],
  },
  mitre_square: {
    square_walls: ['clue_04_kidney_removal'],
    alleyways: [],
    police_lanterns: [],
  },
  goulston_street: {
    graffiti_wall: [],
    apron_fragment_location: [],
  },
  lusk_office: {
    from_hell_letter: ['clue_05_from_hell_letter'],
    kidney_parcel: ['clue_05_human_kidney'],
    parcel_box: [],
  },
  bond_office: {
    medical_reports: ['clue_07_edmunds_presence'],
    anatomical_texts: ['clue_09_medical_background'],
    specimen_jars: [],
    edmund_forensic_note: ['clue_06_prasarved_spelling'],
  },
  private_asylum: {
    patient_records: ['clue_08_preserved_kidney'],
    superintendent: ['clue_10_asylum_commitment'],
    edmund_room_furnishings: [],
  },
  baker_street: {
    watson_diary: [],
    holmes_violin: [],
    newspapers: [],
  },
};

// ============================================================
// TAKEABLE OBJECTS
// Objects that add an evidence note to Watson's inventory when first examined.
// ============================================================

export const TAKEABLE_OBJECTS: Record<string, string> = {
  from_hell_letter: 'From Hell Letter (transcript)',
  edmund_forensic_note: "Edmund's Forensic Note (copy)",
  kidney_parcel: 'Kidney Examination Notes',
  medical_reports: 'Forensic Reports Summary',
};

// ============================================================
// ACT NAMES
// ============================================================

export const ACT_NAMES: Record<number, string> = {
  1: 'The Last Murder',
  2: 'Reconstructing the Murders',
  3: 'The Double Event',
  4: 'The Letter',
  5: 'The Suspicion',
  6: 'The Confrontation',
};

// ============================================================
// ACT PROGRESSION CONDITIONS
// The engine checks these after every action.
// Acts advance automatically when all required flags are set.
// ============================================================

export const ACT_PROGRESSION: Record<number, ActCondition> = {
  1: {
    name: 'The Last Murder',
    requireFlags: ['examined_millers_court'],
    advanceTo: 2,
  },
  2: {
    name: 'Reconstructing the Murders',
    requireFlags: ['examined_bucks_row', 'examined_hanbury_street'],
    advanceTo: 3,
  },
  3: {
    name: 'The Double Event',
    requireFlags: ['examined_dutfields_yard', 'examined_mitre_square'],
    advanceTo: 4,
  },
  4: {
    name: 'The Letter',
    requireFlags: ['examined_lusk_office'],
    advanceTo: 5,
  },
  5: {
    name: 'The Suspicion',
    requireFlags: ['examined_bond_office'],
    advanceTo: 6,
  },
  6: {
    name: 'The Confrontation',
    requireFlags: ['visited_private_asylum'],
    advanceTo: 7, // triggers game over assessment
  },
};

// Minimum clues required for a successful deduction attempt
export const DEDUCTION_THRESHOLD = 5;

// Keywords that suggest a deduction attempt
export const DEDUCTION_KEYWORDS = [
  'deduce', 'solve', 'theory', 'killer is', 'murderer is',
  'i believe', 'i think it was', 'my conclusion', 'the answer is',
  'it must be', 'suspect is', 'culprit',
];

// ============================================================
// OBJECT DISPLAY NAMES
// ============================================================

export const OBJECT_DISPLAY_NAMES: Record<string, string> = {
  police_barricade: 'Police Barricade',
  street_lamps: 'Street Lamps',
  lodging_house_entrances: 'Lodging House Entrances',
  crowd: 'The Crowd',
  the_bed: 'The Bed',
  burned_clothing: 'Burned Clothing',
  examination_instruments: 'Examination Instruments',
  bloodstained_sheets: 'Bloodstained Sheets',
  cobblestone_roadway: 'Cobblestone Roadway',
  warehouse_doors: 'Warehouse Doors',
  wooden_fence: 'Wooden Fence',
  yard_steps: 'Yard Steps',
  ground_where_body_was_discovered: 'Ground (Body Discovery Site)',
  yard_entrance_gate: 'Yard Entrance Gate',
  cart_path: 'Cart Path',
  club_doorway: 'Club Doorway',
  tables: 'Tables',
  posters: 'Posters',
  newspapers: 'Newspapers',
  alleyways: 'Dark Alleyways',
  square_walls: 'Square Walls',
  police_lanterns: 'Police Lanterns',
  graffiti_wall: 'Graffiti Wall',
  apron_fragment_location: 'Apron Fragment Location',
  parcel_box: 'Parcel Box',
  from_hell_letter: 'The From Hell Letter',
  kidney_parcel: 'The Kidney Parcel',
  medical_reports: 'Forensic Examination Reports',
  anatomical_texts: 'Anatomical Textbooks',
  specimen_jars: 'Specimen Jars',
  edmund_forensic_note: "Edmund's Forensic Note",
  patient_records: 'Patient Records',
  edmund_room_furnishings: "Edmund's Room",
  superintendent: 'Asylum Superintendent',
  watson_diary: "Watson's Diary",
  holmes_violin: "Holmes' Violin",
  club_members: 'Club Members',
  city_police: 'City Police Officers',
};

// ============================================================
// NPC DISPLAY NAMES (mirrors NPCS for UI compatibility)
// ============================================================

export const NPC_DISPLAY_NAMES: Record<string, string> = {
  holmes: 'Sherlock Holmes',
  abberline: 'Inspector Abberline',
  bond: 'Dr. Thomas Bond',
  edmund: 'Edmund Halward',
  lusk: 'George Lusk',
  diemschutz: 'Louis Diemschutz',
  superintendent: 'Asylum Superintendent',
};

// ============================================================
// SANITY PENALTIES
// Applied on first examination of particularly horrific scenes.
// Keyed by location ID → object ID → negative sanity delta.
// ============================================================

export const SANITY_PENALTIES: Record<string, Record<string, number>> = {
  millers_court: {
    the_bed:              -10, // Mary Kelly's mutilated remains
    bloodstained_sheets:  -8,  // The full extent of the carnage
    burned_clothing:      -5,  // The killer's improvised light source
  },
  hanbury_street: {
    ground_where_body_was_discovered: -5, // Annie Chapman
  },
  mitre_square: {
    square_walls: -8,  // Catherine Eddowes — kidney removed on-site
    alleyways:    -3,  // The escape route, the darkness
  },
  lusk_office: {
    kidney_parcel: -8, // Confirming the parcel is human
  },
  private_asylum: {
    patient_records:     -10, // The full account of Edmund's crimes
    superintendent:      -5,  // The weight of a man being kept from the world
  },
};

// ============================================================
// USE INTERACTIONS
// Specific narrative descriptions for "use X" commands that
// go beyond what examining alone provides.
// Keyed by location ID → object ID → action description string.
// If an object appears in BOTH inventory and location, the
// location-specific entry takes precedence while the player
// is in that location.
// ============================================================

export const USE_INTERACTIONS: Record<string, Record<string, string>> = {
  lusk_office: {
    from_hell_letter:
      'Watson reads the letter aloud slowly, attending to every irregular spelling. The word "prasarved" sits in the middle of the page — a strange, specific error for a literate hand.',
    kidney_parcel:
      'Watson opens the cardboard box and examines the preserved tissue methodically. One inch of renal artery remains attached — cut cleanly. This was surgical, deliberate, and practised.',
  },
  bond_office: {
    medical_reports:
      "Watson cross-references Bond's forensic reports against each victim in sequence. A pattern emerges: identical incision angles, identical surgical confidence. One pair of hands did all of this.",
    anatomical_texts:
      "Watson leafs through the heavily annotated textbooks. Pencil marks throughout — chapters on abdominal anatomy, renal anatomy, post-mortem procedures. Someone has been studying these obsessively.",
    from_hell_letter:
      "Watson holds the From Hell letter beside Edmund's forensic note. The handwriting differs in style — but there it is. 'Prasarved.' The same idiosyncratic spelling, in the same uncertain vowel.",
    edmund_forensic_note:
      "Watson reads Edmund's cataloguing note again. The word 'prasarved' has been written without hesitation — it is simply how he spells the word. The letter writer spells it the same way.",
  },
  private_asylum: {
    patient_records:
      "Watson reads the admission notes with his doctor's eye. Edmund's behaviour in the weeks following the Kelly murder — withdrawal, sleeplessness, a strange calm. His family moved quickly and quietly.",
  },
};

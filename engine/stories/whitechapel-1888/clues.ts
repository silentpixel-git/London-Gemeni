import type { ClueDefinition } from '../types';

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

// Map: locationId → objectId → clueId[]
// Engine checks this on every examine action.
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

// Objects that add an evidence note to Watson's inventory when first examined.
export const TAKEABLE_OBJECTS: Record<string, string> = {
  from_hell_letter: 'From Hell Letter (transcript)',
  edmund_forensic_note: "Edmund's Forensic Note (copy)",
  kidney_parcel: 'Kidney Examination Notes',
  medical_reports: 'Forensic Reports Summary',
};

// Applied on first examination of particularly horrific scenes.
// Keyed by location ID → object ID → negative sanity delta.
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

// Specific narrative descriptions for "use X" commands.
// If an object appears in BOTH inventory and location, the
// location-specific entry takes precedence while the player
// is in that location.
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

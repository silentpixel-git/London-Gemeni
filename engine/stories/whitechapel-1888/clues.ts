import type { ClueDefinition } from '../types';

export const CLUE_DEFINITIONS: Record<string, ClueDefinition> = {
  // GROUP 0 — Prologue: Baker Street framework clue
  // REWEAVE: the prologue is the EVE of Kelly — four victims, then six weeks
  // of silence since the double event. The wall also carries the loud-suspect
  // landscape (Tumblety in custody, "Leather Apron", a gentleman of rumour)
  // and, unremarked, one note reading "Bond — police surgeon — & assistant."
  clue_00_campaign_timeline: {
    id: 'clue_00_campaign_timeline',
    name: 'The Silence Since September',
    diaryNote: "Holmes's wall holds four names and then six weeks of silence. He insists the quiet is not an ending but a held breath — and that the man we want is one no witness can ever remember.",
    description: "Watson reads the case files wall. Four names in chronological order: Nichols. Chapman. Stride. Eddowes. Four murders in five weeks — two of them in a single night — and then nothing: six weeks of silence since the thirtieth of September. Pinned around the cards, the public's suspects: an American doctor taken into custody this week; the 'Leather Apron' the papers conjured; a gentleman of rumour. And one unremarkable note in Holmes's hand: 'Bond — police surgeon — & assistant.' Beside the timeline Holmes has written: 'The silence is data. Such appetites do not retire.'",
    holmesDeduction: "Four murders in five weeks, Watson, and then six weeks of nothing. Not compulsion — calculation. And mark this above all: in the whole campaign, not one reliable witness. The man we want is a man no one remembers. That is the only thing we know of him — and it is a great deal.",
    locationFound: 'baker_street',
    triggerObject: 'case_files_wall',
    connections: ['clue_02b_campaign_pattern'],
    clueGroup: 0,
    medicalPoints: 0,
    moralPoints: 5,
  },
  // GROUP 1 — Victim Approach Pattern
  clue_01_respectable_approach: {
    id: 'clue_01_respectable_approach',
    name: 'The Respectable Stranger',
    diaryNote: "At Buck's Row the witnesses took Nichols for a drunk, not a victim. Whoever approached her carried no menace at all — he passes for respectable, and that is his armour.",
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
    diaryNote: "The clothes burned in the Miller's Court grate were kindled for light. He stayed in that room for hours, wholly unafraid of discovery. The calm of it unsettles me more than any frenzy could.",
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
    diaryNote: "Bond's report on Chapman: the uterus taken by a single clean, knowing incision. No butcher's work — these are hands schooled in anatomy, as mine once were.",
    description: "Dr. Bond's report on Annie Chapman: the uterus was surgically removed. The incision indicates familiarity with abdominal anatomy — not the work of a common butcher.",
    holmesDeduction: 'Medical student. Anatomical assistant. Slaughterman. One of these three. The precision narrows the field considerably.',
    locationFound: 'hanbury_street',
    triggerObject: 'ground_where_body_was_discovered',
    connections: ['clue_04_kidney_removal', 'clue_09_medical_background'],
    clueGroup: 2,
    medicalPoints: 10,
    moralPoints: 0,
  },
  // GROUP 2b — Mortuary cross-reference (new)
  clue_02b_campaign_pattern: {
    id: 'clue_02b_campaign_pattern',
    name: 'One Pair of Hands',
    diaryNote: "I read Bond's ledger from end to end — Nichols to Kelly. One approach, one signature, growing surer with each entry. The same hand did all of it, and learned as it went.",
    description: "Watson reads Bond's autopsy ledger in sequence: Nichols, Chapman, Stride, Eddowes, Kelly. The incision angles are consistent. The approach is consistent. The confidence grows with each entry. One person did this — and improved with practice.",
    holmesDeduction: 'Five murders. One signature. The progression from Nichols to Kelly is not chaos — it is a campaign. He was learning.',
    locationFound: 'whitechapel_mortuary',
    triggerObject: 'autopsy_ledger',
    connections: ['clue_02_anatomical_knowledge', 'clue_04_kidney_removal'],
    clueGroup: 2,
    medicalPoints: 10,
    moralPoints: 5,
  },
  // GROUP 2c — Physical signature (new — mortuary, Bond's desk)
  clue_02c_small_hands: {
    id: 'clue_02c_small_hands',
    name: 'The Hands',
    diaryNote: "Buried in Bond's notes on Kelly: incisions consistent with small, steady hands, practised in confined spaces. He set it down as a passing remark. I read it twice.",
    description: "Watson reads Bond's post-mortem note on Kelly. A single clinical observation buried in the anatomical detail: 'Incision patterns consistent with unusually small, steady hands. The contained precision suggests familiarity with restricted anatomical spaces.' Bond wrote it as a passing remark. Watson reads it twice.",
    // RECESSION RULE: the deduction points at the abstract PROFILE, never a person —
    // the set includes Bond, Phillips, and every medical man who passes through the room.
    holmesDeduction: "Small hands. Precise in confined spaces. Bond noticed the signature without understanding what he was signing. This is not the polish of a qualified surgeon — it is the precision of a man who learned anatomy in pieces, by watching and by study. Any of the medical men who pass through this room would fit the frame, Watson. The frame is what matters.",
    locationFound: 'whitechapel_mortuary',
    triggerObject: 'bonds_desk',
    connections: ['clue_02_anatomical_knowledge', 'clue_06_prasarved_spelling', 'clue_07_edmunds_presence'],
    clueGroup: 2,
    medicalPoints: 5,
    moralPoints: 0,
  },
  // GROUP 3 — Interrupted Ritual
  clue_03_interrupted_ritual: {
    id: 'clue_03_interrupted_ritual',
    name: 'An Interrupted Man',
    diaryNote: "Stride's throat was cut and nothing more — Diemschutz's cart broke in upon him. Denied his ritual, he went out and found another woman the same night. This is compulsion, not chance.",
    description: "Stride's wound was a single throat cut — no mutilation followed. Diemschutz's cart interrupted the killer mid-act. He was compelled to seek another victim that same night.",
    holmesDeduction: 'The ritual was not completed. This man has a compulsion. The absence of mutilation here is itself the clue.',
    locationFound: 'dutfields_yard',
    triggerObject: 'yard_entrance_gate',
    connections: ['clue_04_kidney_removal'],
    clueGroup: 3,
    medicalPoints: 5,
    moralPoints: 5,
  },
  // GROUP 3b — The Unremarked Passage (REWEAVE — the Foreigner act's key
  // triangulation, delivered as profile, attached to no one)
  clue_03b_unremarked_passage: {
    id: 'clue_03b_unremarked_passage',
    name: 'The Unremarked Passage',
    diaryNote: "I traced his route from Mitre Square — across the boundary, through the heart of the Jewish quarter, the night's evidence in his hand — and not one soul stopped, challenged, or afterwards recalled him. He walks these streets as though he belongs to them.",
    description: "The spot where the constable found the piece of Eddowes' apron. Watson traces the route in his mind: from Mitre Square, across the jurisdiction line, through the heart of the Jewish quarter — a man carrying away evidence of the night's second murder, minutes after committing it — and not one soul stopped him, challenged him, or afterwards remembered him.",
    holmesDeduction: 'Consider what that walk required, Watson. Not luck — licence. He passed because his presence raised no question; he belongs to these streets the way a lamplighter belongs to them. We hunt no skulking outsider. We hunt a man whose face is a kind of permission.',
    locationFound: 'goulston_street',
    triggerObject: 'apron_fragment_location',
    connections: ['clue_01_respectable_approach', 'clue_04b_adjustable_appearance', 'clue_07_edmunds_presence'],
    clueGroup: 3,
    medicalPoints: 0,
    moralPoints: 10,
  },
  // GROUP 4 — Kidney Removal
  clue_04_kidney_removal: {
    id: 'clue_04_kidney_removal',
    name: 'The Removed Kidney',
    diaryNote: "Eddowes' left kidney was excised within minutes, and cleanly. Such speed is not a first attempt. He has done this before — and not in any back alley.",
    description: "Eddowes' left kidney was surgically excised within minutes. The speed and precision confirm repeated anatomical familiarity — this was not the first time he had handled such tissue.",
    holmesDeduction: 'He has done this before in a clinical setting. The kidney was not taken in panic. It was taken deliberately.',
    locationFound: 'mitre_square',
    triggerObject: 'square_walls',
    connections: ['clue_02_anatomical_knowledge', 'clue_05_human_kidney', 'clue_08_preserved_kidney'],
    clueGroup: 4,
    medicalPoints: 10,
    moralPoints: 0,
  },
  // GROUP 4b — H Division witness wall (new)
  clue_04b_adjustable_appearance: {
    id: 'clue_04b_adjustable_appearance',
    name: 'A Man of No Fixed Description',
    diaryNote: "H Division's witness wall holds dozens of accounts and no two agree — tall, short, fair, dark, rough, respectable. The contradiction is the description: he shows each witness only what he wishes them to see.",
    description: "The witness description wall at H Division contains dozens of accounts. No two agree on height, build, age, or dress. Tall. Short. Dark. Fair. Respectable. Rough. The contradictions are not failures of observation — the witnesses saw what the killer wanted them to see.",
    holmesDeduction: 'He presented differently to each witness. This is not inconsistency in the witnesses — it is consistency in the killer. He is a man of adjustable appearance. Ordinariness is his camouflage.',
    locationFound: 'h_division_station',
    triggerObject: 'witness_description_wall',
    connections: ['clue_01_respectable_approach', 'clue_07_edmunds_presence'],
    clueGroup: 4,
    medicalPoints: 5,
    moralPoints: 0,
  },
  // GROUP 5 — The From Hell Letter
  // FAIR-PLAY RULE: the letter is presented WHOLE — crudely spelled throughout,
  // a dozen errors. No single word is ever singled out here; the matching moment
  // belongs to the player, at the Act 5 Baker Street convergence.
  clue_05_from_hell_letter: {
    id: 'clue_05_from_hell_letter',
    name: 'The From Hell Letter',
    diaryNote: "I copied the Lusk letter entire — crude in every line, yet the hand steady and unhurried. Genuine ignorance, or a performance of it? I cannot yet say. I keep the transcript close.",
    description: 'The letter sent to George Lusk with the kidney — crudely spelled from its first line to its last, taunting, claiming the deed outright. A dozen errors crowd its few sentences, yet the hand itself is steady and unhurried. Genuine illiteracy, or a performance of it? Watson copies the text into his notebook entire.',
    holmesDeduction: 'A man barely lettered, Watson — or one who wishes us to believe it. The hand is steady; the errors are consistent; the cruelty is genuine. Keep your transcript close. Documents have a way of answering one another, given time.',
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
    diaryNote: "The half-kidney sent to Lusk is unmistakably human, the artery cut clean, and preserved in spirit of wine to laboratory standard — exactly as Bond keeps a specimen. The man who kept this still works at a bench.",
    description: "Watson examines the preserved half-kidney sent to Lusk. Unmistakably human; the renal artery cut a clean inch from the organ. And the preservation itself arrests him: spirit of wine at a precise laboratory concentration — the standard mortuary method, exactly as a post-mortem specimen would be kept. Bond confirms it without being asked: 'This is how my own laboratory keeps a specimen.'",
    holmesDeduction: "Mark the preservation, Watson, more than the cutting. A showman's curio is crudely kept — this was fixed by laboratory hands, to laboratory standards. The man who kept this kidney keeps specimens for his living. He did not flee, and he did not vanish. He is still at his bench.",
    locationFound: 'lusk_office',
    triggerObject: 'kidney_parcel',
    connections: ['clue_04_kidney_removal', 'clue_06_prasarved_spelling', 'clue_08_preserved_kidney'],
    clueGroup: 5,
    medicalPoints: 10,
    moralPoints: 5,
  },
  // GROUP 6 — The Smoking Gun (REWEAVE: discovered at the Baker Street
  // convergence — the player lays the assistant's note beside the letter at
  // 221B, against the casefiles. Never granted at Bond's office.)
  clue_06_prasarved_spelling: {
    id: 'clue_06_prasarved_spelling',
    name: 'The Convergence',
    diaryNote: "At Holmes's desk I laid the assistant's note beside the letter, and there it was in both hands, written without hesitation: 'prasarved.' The same misshapen vowel. The note is signed Edmund Halward — and the shapeless thing we have chased for eleven weeks has, at last, a name.",
    description: "At Holmes's desk, Watson lays the assistant's forensic note beside the From Hell letter. The styles diverge — one clinical, one a performance of ignorance — but there it is, in both hands, written without hesitation: 'prasarved.' The same idiosyncratic vowel in the same uncertain position. Watson's eye goes to the casefiles wall — the assistant present at every scene — and then to the name signed at the foot of the note: Edmund Halward.",
    holmesDeduction: "Two men do not spell 'preserved' as 'prasarved'. The small hands. The laboratory fixative. The man present at every post-mortem whom no one has ever once remarked. It was all there, Watson — from the first morning. So that is his name.",
    locationFound: 'baker_street',
    // Synthetic label, NOT a physical interactable: this clue is granted only via
    // USE_COMBINATIONS (forensic note + From Hell letter, gated to baker_street).
    // Intentionally absent from any location's interactables and from CLUE_TRIGGERS.
    triggerObject: 'document_convergence',
    connections: ['clue_05_from_hell_letter', 'clue_07_edmunds_presence'],
    clueGroup: 6,
    medicalPoints: 10,
    moralPoints: 5,
  },
  // GROUP 7 — Edmund's Presence
  clue_07_edmunds_presence: {
    id: 'clue_07_edmunds_presence',
    name: "The Silent Witness",
    diaryNote: "Reviewing Bond's reports, I see the assistant has been present at every stage — Miller's Court, each post-mortem, the office. It always seemed natural. I realise I have never once heard the man speak.",
    description: "Watson reviews Bond's forensic reports and notes that the assistant was present at every significant stage of the investigation — Miller's Court, every post-mortem, and now Bond's office. His presence has always seemed natural. It occurs to Watson that he has never heard the man volunteer a single word.",
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
    diaryNote: "The asylum superintendent confirms it: Halward's family found a preserved human organ in his room and had him quietly committed. They never called the police. If Lusk received half a kidney, here was the other.",
    description: "The asylum superintendent confirms: Edmund Halward's family, upon discovering disturbing evidence in his room — a preserved human organ — arranged his quiet commitment. They did not contact the police.",
    holmesDeduction: "If the letter contained half the kidney, and his family found the other half — there is only one conclusion available to a rational mind.",
    locationFound: 'private_asylum',
    triggerObject: 'edmund_room_furnishings',
    connections: ['clue_05_human_kidney', 'clue_10_asylum_commitment'],
    clueGroup: 8,
    medicalPoints: 10,
    moralPoints: 10,
  },
  // GROUP 9 — Edmund's Medical Background
  clue_09_medical_background: {
    id: 'clue_09_medical_background',
    name: "An Incomplete Education",
    diaryNote: "Holmes's enquiries: Edmund Halward read medicine in London and withdrew before qualifying; his father a respected physician. Anatomical knowledge, medical access, respectability — he answers every line of the profile.",
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
    diaryNote: "Halward was committed within days of the Kelly murder, and from that date the killings simply ceased. Holmes will not call that coincidence — and neither, now, can I.",
    description: "Edmund Halward was committed to the private asylum shortly after Mary Jane Kelly's murder on 9th November 1888. The Whitechapel murders ceased entirely from that date. The official reason for commitment is a vague reference to violent behaviour.",
    holmesDeduction: 'The murders stopped when Edmund was removed from society. That is not coincidence. That is causation.',
    locationFound: 'private_asylum',
    triggerObject: 'patient_records',
    connections: ['clue_08_preserved_kidney', 'clue_07_edmunds_presence'],
    clueGroup: 10,
    medicalPoints: 5,
    moralPoints: 10,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CLUE TRIGGERS
// Map: locationId → objectId → clueId[]
// Engine checks this on every examine action.
// ─────────────────────────────────────────────────────────────────────────────

export const CLUE_TRIGGERS: Record<string, Record<string, string[]>> = {
  baker_street: {
    case_files_wall: ['clue_00_campaign_timeline'],
    whitechapel_map: [],
    holmes_chemistry_table: [],
    telegrams_pile: [],
    newspaper_pile: [],
  },
  millers_court: {
    burned_clothing: ['clue_01_killer_confidence'],
    the_bed: [],
    bloodstained_sheets: [],
    examination_instruments: [],
  },
  whitechapel_mortuary: {
    autopsy_ledger: ['clue_02b_campaign_pattern'],
    specimen_cabinet: [],
    bonds_desk: ['clue_02c_small_hands'],
    victim_folders: [],
  },
  h_division_station: {
    witness_description_wall: ['clue_04b_adjustable_appearance'],
    abberline_desk: [],
    investigation_board: [],
    case_files_cabinet: [],
  },
  whitechapel_pub: {
    pub_regulars: [],
    the_barmaid: [],
    corner_table: [],
    notice_board: [],
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
    apron_fragment_location: ['clue_03b_unremarked_passage'],
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
    // REWEAVE: examining the note yields the COPY + the NAME + an odd hand
    // noted-but-not-connected — never clue_06. The smoking gun fires only at
    // the Baker Street convergence (USE combo, location-locked).
    edmund_forensic_note: [],
  },
  private_asylum: {
    patient_records: ['clue_10_asylum_commitment'],
    edmund_room_furnishings: ['clue_08_preserved_kidney'],
  },
  dorset_street: {
    police_barricade: [],
    street_lamps: [],
    lodging_house_entrances: [],
    crowd: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERIC NOTES
// Authored fallback descriptions for objects that trigger no clue.
// The AI uses these when an object is examined but has no clue to reveal.
// Prevents the AI inventing content for empty interactables.
// ─────────────────────────────────────────────────────────────────────────────

export const ATMOSPHERIC_NOTES: Record<string, Record<string, string>> = {
  baker_street: {
    // Act-keyed: in the prologue (act 0) the wall holds FOUR victims — Kelly
    // is still alive tonight. From Act 1 onward the base entry (five) applies.
    'case_files_wall@0': 'Four locations. Four names. Four dates — and then five weeks of silence since the double event of September. Holmes has pinned them in chronological order with coloured threads connecting each to the next. At the centre, a blank card with a question mark. Watson looks at it for a long moment.',
    case_files_wall: 'Five locations. Five names. Five dates. Holmes has pinned them in chronological order with coloured threads connecting each to the next — the Kelly card newest, its ink still dark. At the centre, a blank card with a question mark. Watson looks at it for a long moment.',
    whitechapel_map: 'A large-scale map of Whitechapel and Spitalfields, marked with red pins. They cluster in a radius of perhaps half a mile. Whoever did this never strayed far from home.',
    holmes_chemistry_table: "The chemistry table is uncharacteristically abandoned — beakers rinsed, equipment pushed to one side. Holmes has not been experimenting. He has been thinking. Watson finds this more unsettling than the map.",
    telegrams_pile: "A stack of telegrams from Abberline, the most recent dated this evening. Warren's resignation; the American in custody; the press. Holmes has underlined a single word in pencil: 'intolerable.'",
    // NOTE: do not narrate Watson cutting/taking the clipping here — acquisition
    // is narrated via itemsGained (first examine only). This note also fires on
    // RE-examines, when the clipping is already in his bag.
    newspaper_pile: "The Star, the Evening Standard, the Times. Every front page from August onward. Headlines grow more hysterical with each passing week: ANOTHER OUTRAGE IN WHITECHAPEL. POLICE BAFFLED. IS JACK THE RIPPER A DOCTOR? Near the top of the pile, the Star has reprinted the 'Dear Boss' letter in facsimile — the letter that gave the killer his name.",
    // Act-keyed press evolution — the pile changes as the case unfolds
    'newspaper_pile@1': "Today's editions sit atop the old pile, ink barely dry: HORROR IN MILLER'S COURT. THE RIPPER'S MOST AWFUL CRIME. The Star has a sketch of Dorset Street that gets the lamp-posts wrong. Beneath the fresh hysteria, ten weeks of older headlines lie like sediment.",
    'newspaper_pile@3': 'The pile has shifted in character — less horror now, more accusation. LEATHER APRON. THE FOREIGN QUARTER. WHAT ARE THE POLICE HIDING? The press has stopped describing the murders and begun assigning them. Watson notes how few of the named men could survive the naming.',
    'newspaper_pile@4': "The kidney has reached the papers: FROM HELL — THE LUSK LETTER. HALF OF IT, FRIED AND EATEN, the Star says, with relish it does not bother to disguise. Tumblety's flight shares the front page. The pile has become a chronicle of a city feeding on its own fear.",
  },
  dorset_street: {
    police_barricade: "A pair of constables stand at the entrance to Miller's Court, turning back the curious. Their faces are professionally blank. Watson shows his credentials and is admitted without comment.",
    street_lamps: "The gas lamps are lit against the November fog, their light pooling uselessly in the damp air. They illuminate almost nothing. Watson wonders how the killer moved through these streets unseen and realises that in this light, almost anything is possible.",
    lodging_house_entrances: "The lodging houses along Dorset Street take in anyone who can afford fourpence a night. The women who lived here moved between them constantly — a bed here, a floor there, wherever the money stretched. Watson thinks of the difference between having a home and merely having a place to sleep.",
    crowd: "The crowd pressed against the barricade is a mixture of the morbidly curious, the genuinely afraid, and the simply poor who have nowhere else to be. A woman near Watson says nothing, just stares at the entrance to Miller's Court with the flat expression of someone who has been waiting for this to happen.",
  },
  millers_court: {
    the_bed: "The bed dominates the small room. Watson, who has seen field surgery and the aftermath of battle, stands at its foot for a moment and says nothing. What happened here required hours. The killer was comfortable in this room. He made it his.",
    bloodstained_sheets: "Watson makes himself observe clinically — it is the only way to function. The extent of the injuries is consistent with Bond's report. The killer worked methodically. He was not in a hurry. This, Watson thinks, is the most disturbing finding of all.",
    examination_instruments: "Bond's instruments are still laid out on the small table near the door — everything accounted for, labelled, placed with the precision of a man who learned to be exact in exactly this kind of room. Watson notes that the assistant's cataloguing notebook lies beside them, open to a page of neat, unhurried handwriting.",
  },
  whitechapel_mortuary: {
    specimen_cabinet: "A row of glass jars on a high shelf. Watson does not look closely. Bond, who spends his days in this room, doesn't appear to notice them at all. Watson wonders if that is professional detachment or something else.",
    bonds_desk: "Bond's desk is a model of ordered thought — every report dated, indexed, filed. A man who has processed extraordinary violence and refused to let it disorder his work. Watson respects this and finds it slightly terrifying.",
    victim_folders: "Five manila folders, arranged in order: Nichols, Chapman, Stride, Eddowes, Kelly. Watson opens the first. The dates span August to November. Eleven weeks. Five women. He closes it again before he has finished the first page.",
  },
  h_division_station: {
    abberline_desk: "Abberline's desk is covered in paper. On top of the nearest stack, a photograph of a smiling woman Watson doesn't recognise. He is about to ask when Abberline picks it up and places it face-down without comment. Watson says nothing.",
    investigation_board: "The investigation board is a chronicle of failure — not for lack of effort, but for lack of evidence. Every lead followed, every suspect interviewed, every theory tested and discarded. Watson reads it and thinks of the word 'systematic' and then thinks of what it costs a man to be systematic for three months without result.",
    case_files_cabinet: "Forty-three folders. Watson counts them. Suspects considered and eliminated, witnesses interviewed, statements taken. Somewhere in this cabinet, Watson suspects, the answer exists in fragments — each one insufficient alone, meaningful only together.",
  },
  whitechapel_pub: {
    pub_regulars: "The men at the bar drink without much conversation. One of them, noticing Watson's coat, asks if he's a doctor. When Watson says yes, the man nods slowly and says: 'We could've used one, a few months back.' Watson doesn't ask him to explain.",
    the_barmaid: "The barmaid is perhaps forty, with the particular efficiency of someone who has learned not to waste motion. She sets Watson's drink down and says, unprompted: 'Three of them used to come in here regular. Before.' She doesn't say before what. She doesn't need to.",
    corner_table: "Watson sits in the corner, half-listening to the room, when a woman approaches — not a barmaid, just a regular — and asks if he has found anything yet. 'About the Kelly girl,' she says. 'I knew her. Mary.' She says the name the way Abberline does when he forgets himself. Watson has no answer. She nods once, as though she expected this, and goes back to her drink. Watson writes nothing in his notebook.",
    notice_board: "A notice board near the door carries a poster from the Whitechapel Vigilance Committee: 'MURDER — LIBERAL REWARD offered to any person (other than a Police Officer) who shall give such information as will lead to the discovery and conviction of the murderer.' Watson has seen this poster before. He is no closer to claiming the reward.",
  },
  bucks_row: {
    warehouse_doors: "The warehouse doors are bolted. They were bolted on the night of August 31st as well. No one heard anything. No one saw anything. In a street this narrow and this quiet, Watson thinks, the killer must have been entirely unremarkable — a figure so unthreatening that the night simply absorbed him.",
    street_lamps: "One lamp was out the night Nichols was found. The constable who discovered her initially thought she was drunk. It took him a moment to understand what he was looking at. By then the killer was gone.",
  },
  hanbury_street: {
    wooden_fence: "The fence is ordinary — weathered timber, a latch that doesn't quite catch. The yard behind it was used by the residents of No. 29 as a thoroughfare. People passed through it at all hours. And yet.",
    yard_steps: "Watson descends three stone steps into the yard and reads from Bond's report: 'The body was found two feet from the bottom of the steps, head towards the house.' He looks at the distance. Four minutes from Whitechapel High Street. Broad daylight would have come within the hour.",
  },
  dutfields_yard: {
    cart_path: "Holmes walks the cart path slowly, counting steps. He says nothing for almost a minute. Then: 'Diemschutz's horse smelled the blood before Diemschutz did. The horse was right.' He continues walking.",
    club_doorway: "The door to the club stands open. Political argument drifts out — something about the rights of labour, the rights of man. Forty feet away is where Elizabeth Stride died. Watson thinks about what it means that the world simply continues.",
  },
  working_mens_club: {
    tables: "The tables are covered with pamphlets — socialist theory, labour rights, correspondence from organisations Watson has never heard of. A world of political conviction that has nothing to do with the murders and yet shares the same streets, the same fog, the same November dark.",
    posters: "Posters in three languages Watson can identify and at least one he cannot. The word 'justice' appears in several of them. Watson considers what justice would look like in this case and finds he has no clear answer.",
    newspapers: "A pile of newspapers — the Star, the Pall Mall Gazette, Yiddish press, East London Observer. Holmes takes the Star and reads it for several minutes without expression. Watson glances over his shoulder: the headline calls for the investigation of 'foreign elements.' Holmes sets it down and says, quietly: 'Abberline is being pressured to look in the wrong direction, Watson. I have entertained it. I will not entertain it further.'",
    club_members: "Several members approach to speak with Watson and Holmes — accounts of the night of September 30th, familiar now from the police reports but alive in the telling. A man who heard footsteps and thought nothing of them. A woman who saw a figure near the yard entrance and cannot describe him beyond 'ordinary.' Always ordinary.",
  },
  mitre_square: {
    alleyways: "Three separate alleyways lead out of Mitre Square — each into a different jurisdiction. Holmes walks each one in turn. 'Four minutes from the murder to the City boundary,' he says. 'He knew this square. He had been here before, when there was no body to explain his presence.'",
    police_lanterns: "The City Police lanterns still hang at the square's corners — a permanent reminder of the night two forces failed to coordinate and a woman died. Watson stands beneath one and reads the time on his pocket watch.",
  },
  goulston_street: {
    graffiti_wall: "Watson touches the wall where the inscription was. The chalk is long gone — Warren's order was carried out before dawn on October 1st. A piece of Eddowes' apron lay here. Above it, words that no one photographed and several witnesses remembered differently. Watson finds the erasure almost as disturbing as the murder.",
    apron_fragment_location: "The constable who found the apron fragment marked the spot in his report. It is a precise location — not dropped casually but placed, or fallen, at a specific point on a specific route. The killer was moving in a direction. He knew where he was going.",
  },
  lusk_office: {
    parcel_box: "The small cardboard box that contained the kidney sits on Lusk's desk. It is entirely ordinary — the kind used for sending packages through the penny post. The address was written in the same hand as the letter. Watson examines the postmark: East London, October 15th.",
  },
  bond_office: {
    specimen_jars: "The specimen jars contain anatomical preparations — a kidney cross-section, sections of preserved tissue, labelled in Bond's precise hand. Watson, who has seen anatomy theatres, notes that whoever prepared these jars had a steady hand and no apparent aversion to the work. He glances at the figure by the window without meaning to.",
    // THE GATHER (Act 5): the note yields the copy + the name + an odd hand —
    // noted, NOT connected. The connection belongs to the player, at Baker Street.
    edmund_forensic_note: "A cataloguing note in the assistant's hand — clinical, exact, every measurement in its place. Watson asks for a copy and the young man provides one without a flicker, returning at once to his work. The hand is precise and professional, though here and there a spelling sits oddly against the exactness of the rest — the kind of small crudeness one notes and forgets. The note is signed at the foot: Edmund Halward. So that is the assistant's name. Watson pockets the copy.",
  },
  private_asylum: {
    edmund_room_furnishings: "The room is clean and bare. A narrow bed, a chair, a small table with a Bible on it. The window looks onto the grounds — high walls, a gravel path, a bare tree. Whatever Edmund Halward is now, Watson thinks, he is very quiet. The superintendent says he is always quiet. He was always quiet.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TAKEABLE OBJECTS
// Objects that add an evidence note to Watson's inventory when first examined.
// ─────────────────────────────────────────────────────────────────────────────

export const TAKEABLE_OBJECTS: Record<string, string> = {
  from_hell_letter: 'From Hell Letter (transcript)',
  edmund_forensic_note: "Assistant's Forensic Note (copy)",
  kidney_parcel: 'Kidney Examination Notes',
  medical_reports: 'Forensic Reports Summary',
  autopsy_ledger: 'Autopsy Ledger Notes',
  // Prologue: examining the newspapers yields the clipping of the published
  // "Dear Boss" letter — the object the player SHOWS to Holmes (tutorial beat).
  newspaper_pile: 'Newspaper Clipping (the "Dear Boss" letter)',
};

// ─────────────────────────────────────────────────────────────────────────────
// SPENT-AFTER-ACT — authored bag hygiene.
// Keyed by inventory DISPLAY NAME (what actually sits in session.inventory).
// When a new act begins, any carried item whose spent act has passed is dropped
// from Watson's bag (time has moved on; he keeps only what later beats still
// need). Only list items that are genuinely finished with — every other piece
// of evidence is load-bearing in a later act and must NOT be listed here.
// Value N = "still needed through Act N; drop when entering Act N+1".
// ─────────────────────────────────────────────────────────────────────────────
export const ITEM_SPENT_AFTER_ACT: Record<string, number> = {
  // The "Dear Boss" clipping is a one-time prologue prop (shown to Holmes).
  // Spent once the investigation proper begins.
  'Newspaper Clipping (the "Dear Boss" letter)': 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// USE INTERACTIONS
// Specific narrative descriptions for "use X" commands.
// ─────────────────────────────────────────────────────────────────────────────

export const USE_INTERACTIONS: Record<string, Record<string, string>> = {
  lusk_office: {
    // FAIR-PLAY: the letter is read WHOLE — no single error is ever singled out.
    from_hell_letter:
      'Watson reads the letter aloud slowly, from its first crude line to its last. The errors crowd every sentence, yet the hand never wavers — steady, unhurried, almost careful in its carelessness. He copies the text entire into his notebook.',
    kidney_parcel:
      'Watson opens the cardboard box and examines the preserved tissue methodically. One inch of renal artery remains attached — cut cleanly. And the fixative is spirit of wine at laboratory concentration: the standard mortuary method, precisely applied. Surgical, deliberate, and practised.',
  },
  bond_office: {
    medical_reports:
      "Watson cross-references Bond's forensic reports against each victim in sequence. A pattern emerges: identical incision angles, identical confidence. One pair of hands did all of this.",
    anatomical_texts:
      "Watson leafs through the heavily annotated textbooks. Pencil marks throughout — chapters on abdominal anatomy, renal anatomy, post-mortem procedures. Someone has been studying these obsessively.",
    // The comparison cannot resolve here — the convergence belongs to Baker Street.
    from_hell_letter:
      "Watson half-draws the letter transcript from his pocket, then stops. This is not the place — the office is busy, the light poor, and a careful comparison wants the desk at Baker Street, where the casefiles are. He puts it away.",
    edmund_forensic_note:
      "Watson reads the cataloguing note again. Precise, professional — and here and there a spelling sits oddly against the exactness of the rest. Something in it nags at him without resolving. Better studied properly, at home, with the rest of the papers.",
  },
  private_asylum: {
    patient_records:
      "Watson reads the admission notes with his doctor's eye. Edmund's behaviour in the weeks following the Kelly murder — withdrawal, sleeplessness, a strange calm. His family moved quickly and quietly.",
  },
  whitechapel_mortuary: {
    autopsy_ledger:
      "Watson reads the ledger from the beginning. Five entries, five dates, eleven weeks. The injuries escalate in confidence and duration. By the Kelly entry, Bond's prose is at its most clinical — a surgeon's way of managing what cannot otherwise be managed.",
    victim_folders:
      "Watson opens each folder in sequence. The photographs are not in this copy — Bond keeps those separately. But the written descriptions are sufficient. Watson closes the last folder and stands still for a moment.",
  },
  baker_street: {
    case_files_wall:
      "Watson reads Holmes' case map carefully. The five murder sites, the dates, the connecting threads. A note in Holmes' hand reads: 'Access to victims — non-threatening. Knowledge of organs — studied but not qualified. Present at investigation — professional role.' Beside the last line, a question mark.",
    newspaper_pile:
      "Watson reads the progression of newspaper coverage: confusion, then panic, then the naming of 'Jack the Ripper' — a name the police never used, invented by a letter-writer who was almost certainly not the killer. Holmes has annotated the margins: 'Misdirection. Public panic serves the killer's anonymity.'",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHOW INTERACTIONS (Infocom: SHOW X TO Y)
// Watson shows an inventory item to an NPC. Keyed by inventoryItemId → npcId.
// Each entry contains the clue triggered (if any) and the AI result note.
// ─────────────────────────────────────────────────────────────────────────────

export interface ShowInteraction {
  clueId?: string;       // Clue unlocked by this show action (optional)
  resultNote: string;    // Passed to AI as actionResultNote
}

export const SHOW_INTERACTIONS: Record<string, Record<string, ShowInteraction>> = {
  // Prologue tutorial beat: SHOW the newspaper clipping TO Holmes.
  // Sets showed_newspaper_pile_to_holmes (engine flag name keys on the object id)
  // — an Act 0 gate flag. Plants the misdirection theme.
  'newspaper_pile': {
    'holmes': {
      resultNote: "SUCCESS — Holmes glances at the clipping of the published letter and hands it back almost at once. 'A journalist's invention, Watson. The hand is theatrical, the menace is rehearsed, and the name — Jack the Ripper — was coined to sell papers, not to sign crimes. Remember it: this case is littered with noise. The genuine article, when we meet it, will not perform for us.' He returns to the window.",
    },
  },
  // SHOW forensic note TO abberline / holmes (Act 5 gather).
  // NEITHER yields the smoking gun — the convergence belongs to Baker Street,
  // and to the player. Both redirect without resolving.
  'edmund_forensic_note': {
    'abberline': {
      resultNote: "SUCCESS — Abberline examines the forensic note carefully. He notes the precise, unhurried cataloguing style, turns it over once, and hands it back. 'Thorough man, Bond's assistant. Why?' He waits. Whatever Watson is reaching for, it has not yet taken shape enough to say aloud.",
    },
    'holmes': {
      resultNote: "SUCCESS — Holmes reads the note once, and something crosses his face — there and gone. 'Not here, Watson.' He folds the copy back into Watson's hand. 'Documents answer one another at a desk, not in another man's office. Bring it home. Bring everything home.' He says nothing further.",
    },
  },
  // SHOW from hell letter TO bond
  // Bond identifies the preservation knowledge in the letter as matching his assistant's practice
  'from_hell_letter': {
    'bond': {
      resultNote: "SUCCESS — Bond reads the letter without expression. He pauses at the passage describing the kidney's condition. 'Whoever preserved this,' he says quietly, 'knew the correct temperature and duration. That is not general knowledge.' He does not look at his assistant. He hands the letter back without comment.",
    },
    'abberline': {
      resultNote: "SUCCESS — Abberline has seen the letter before, but he reads it again with Watson present. 'The spelling,' he says. 'We noticed it. Could be illiteracy, could be affectation. The press have printed the thing in full — half of London has read it.' He folds it carefully. 'The kidney, though. That detail was never published.'",
    },
    'holmes': {
      resultNote: "SUCCESS — Holmes reads it twice, then holds it to the light. 'The vocabulary is deliberate, Watson. The errors are consistent — not random. This man knows how to spell and is choosing not to. Or he learned spoken English before written English. Either way: educated, but not schooled in the conventional sense.' He sets it down. 'Keep it.'",
    },
  },
  // SHOW kidney parcel TO bond
  // Bond identifies the precise preservation technique — matches his assistant's documented method
  'kidney_parcel': {
    'bond': {
      resultNote: "SUCCESS — Bond examines the preserved tissue with clinical focus. 'Spirit of wine,' he says. 'Standard fixative. But the concentration is specific — this is not a general formula. This matches the preservation method I use in my own laboratory.' A long pause. 'I document the method in my practice notes. Those notes pass through several hands.'",
    },
  },
  // SHOW forensic reports TO abberline
  // Abberline sees the cross-case pattern and adds police context
  'medical_reports': {
    'abberline': {
      resultNote: "SUCCESS — Abberline reads the summary, then lays it on his desk and puts his hand flat on it. 'If this is right,' he says, 'then whoever did this was at every scene in a professional capacity. Not a vagrant. Not a butcher. Someone with a reason to be there.' He does not say who. But his eyes move to the window that faces Bond's office across the courtyard.",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// USE COMBINATIONS (Infocom: USE X WITH Y)
// Watson uses one inventory item with another object/item.
// Keyed by inventoryItemId → { withTargetId → interaction }
// ─────────────────────────────────────────────────────────────────────────────

export interface UseCombination {
  clueId?: string;
  resultNote: string;
  // Optional: the combination only works at this location (e.g. the document
  // comparison that must happen at Baker Street, against the casefiles).
  requiresLocation?: string;
  // Optional: the combination only works from this act onward (spoiler gate —
  // e.g. the kidney cross-reference grants asylum-reveal content).
  requiresAct?: number;
}

export const USE_COMBINATIONS: Record<string, Record<string, UseCombination>> = {
  // USE forensic note WITH from hell letter
  // Watson compares handwriting — alternate path to clue_06
  'edmund_forensic_note': {
    'from_hell_letter': {
      clueId: 'clue_06_prasarved_spelling',
      // The convergence: this comparison only resolves at Baker Street, laid
      // against the casefiles — the Act 5 bookend. Attempting it elsewhere is
      // blocked ("not the place for careful comparison").
      requiresLocation: 'baker_street',
      resultNote: "SUCCESS — Watson places the forensic note beside the From Hell letter and reads them in parallel. The style diverges — one is clinical, one is performed illiteracy. But there it is: 'prasarved.' The same idiosyncratic vowel, in the same uncertain position, written without hesitation by the same hand.",
    },
    'autopsy_ledger': {
      resultNote: "SUCCESS — Watson compares the forensic note's cataloguing style against Bond's ledger entries. The assistant's handwriting is contained in the right-hand column: brief, precise, unhurried. The same voice that wrote the From Hell letter, but cleaned of its performance.",
    },
  },
  // USE kidney parcel WITH autopsy ledger
  // Cross-reference surfaces preservation technique detail
  'kidney_parcel': {
    'autopsy_ledger': {
      clueId: 'clue_08_preserved_kidney',
      // Spoiler gate: clue_08's text names Edmund and the asylum commitment.
      // Without this gate the combination could fire in Act 4 (both documents
      // are obtainable then) and spoil the Act 6 asylum reveal.
      requiresAct: 6,
      resultNote: "SUCCESS — Watson cross-references the kidney's preservation against the ledger's documented method. Bond's notes specify spirit of wine at a precise dilution — the same concentration Watson observes in the parcel. This kidney was preserved by someone who had read, or written, that ledger entry.",
    },
  },
  // USE forensic reports WITH case files wall
  // Watson integrates Bond's reports into Holmes's case map
  'medical_reports': {
    'case_files_wall': {
      resultNote: "SUCCESS — Watson pins the forensic summary beside the case map. The pattern clarifies: the same surgical approach across all five murders, the same efficiency, the same anatomical confidence. Holmes watches from his chair. 'You are beginning to see it,' he says. 'Now ask yourself: who was present at every post-mortem?'",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT TEXT (Infocom: READ X — shows the literal text of a document)
// Watson reads the actual words rather than examining the physical object.
// ─────────────────────────────────────────────────────────────────────────────

export const DOCUMENT_TEXT: Record<string, string> = {
  from_hell_letter: `*From Hell.*

Mr Lusk,
Sor
I send you half the Kidne I took from one woman prasarved it for you tother piece I fried and ate it was very nise. I may send you the bloody knif that took it out if you only wate a whil longer.

signed Catch me when you can Mishter Lusk`,

  edmund_forensic_note: `*Post-mortem cataloguing note — Miller's Court, 9 November 1888.*
*Transcribed by E. Halward, assistant to Dr. T. Bond.*

Injuries consistent with prior cases. Organ removal: uterus, heart, portions of kidney. Incision depth and angle consistent with Chapman and Eddowes examinations. Tissue prasarved in spirit of wine (standard laboratory concentration, per standing procedure). Fire in grate burned approximately four hours — consistent with witness reports of warmth in the room at time of discovery.

*E. Halward*`,

  // The pile as it stands on the evening of 8 November — the prologue vigil.
  // Historically exact: Tumblety arrested 7 Nov; Warren resigned 8 Nov;
  // Kelly is still alive tonight, so no telegram can mention her.
  telegrams_pile: `*Telegrams received at Baker Street, October–November 1888.*

Oct 19 — Abberline to Holmes: Lusk received kidney parcel. Examining. City & Met coordinating.

Oct 29 — Abberline to Holmes: Bond confirms kidney human, female, matching Eddowes. Preserved to laboratory standard. No arrest imminent.

Nov 7 — Abberline to Holmes: American doctor TUMBLETY taken on indecency charges. Some here fancy him for the murders — specimens, hatred of women. Holding him while we look.

Nov 8 — Abberline to Holmes: Warren has resigned. The force is without a head and the press without mercy. Six weeks of quiet and no nearer. Come when you can. The quiet does not feel like an ending.`,

  // Act-keyed: the wall on the night of the vigil — four victims, the suspect
  // landscape, and one unremarkable note. (Base entry below = Act 1 onward.)
  'case_files_wall@0': `*Holmes's summary of the Whitechapel murders — evening, 8 November 1888.*

Polly Nichols — Buck's Row, 31 Aug. Throat cut. Abdominal injuries. No uterus.
Annie Chapman — Hanbury St, 8 Sep. Uterus removed. Rings taken.
Elizabeth Stride — Dutfield's Yard, 30 Sep. Throat only — interrupted.
Catherine Eddowes — Mitre Square, 30 Sep. Kidney and uterus. Message at Goulston St.

*Five weeks of murder. Six weeks of silence. The silence is data.*

Pinned at the margin — the public's suspects:
— Tumblety, American "doctor". In custody since the 7th. Specimens; hatred of women. LOUD.
— "Leather Apron" (Pizer). Press invention. Alibied in September. The mob nearly had him.
— A gentleman of rumour — erratic, lately dismissed. Unverified.
— Bond — police surgeon — & assistant. (Forensic access, all scenes.)

*Question: access to victims — professional? Social?*
*Question: in eleven weeks, why has no one once remembered him?*`,

  case_files_wall: `*Holmes's summary of the Whitechapel murders, November 1888.*

Polly Nichols — Buck's Row, 31 Aug. Throat cut. Abdominal injuries. No uterus.
Annie Chapman — Hanbury St, 8 Sep. Uterus removed. Rings taken.
Elizabeth Stride — Dutfield's Yard, 30 Sep. Throat only — interrupted.
Catherine Eddowes — Mitre Square, 30 Sep. Kidney and uterus. Message at Goulston St.
Mary Jane Kelly — Miller's Court, 9 Nov. Most extensive. Several hours.

*Pattern: acceleration. Increasing confidence. Decreasing caution.*
*Question: access to victims — professional? Social?*
*Question: present at investigation — same man?*`,

  autopsy_ledger: `*Whitechapel Mortuary Post-Mortem Ledger — Dr. Thomas Bond, 1888.*

Entry 3 — Annie Chapman, 8 September:
Uterus removed with a single clean incision. Cuts exhibit familiarity with abdominal cavity. No professional qualification evident, but practical anatomical knowledge confirmed. Organ retention: deliberate.

Entry 5 — Catherine Eddowes, 30 September:
Left kidney removed within estimated four minutes. Efficiency consistent with prior practice. Spirit of wine fixative observed on tissue fragment (facial). Laboratory concentration, per standing procedure.

Entry 6 — Mary Jane Kelly, 9 November:
[See supplementary notes. Not reproduced here.]`,
};

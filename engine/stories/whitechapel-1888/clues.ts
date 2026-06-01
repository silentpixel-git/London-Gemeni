import type { ClueDefinition } from '../types';

export const CLUE_DEFINITIONS: Record<string, ClueDefinition> = {
  // GROUP 0 — Prologue: Baker Street framework clue
  clue_00_campaign_timeline: {
    id: 'clue_00_campaign_timeline',
    name: 'The Eleven Weeks',
    description: "Watson reads the case files wall. Five names in chronological order: Nichols. Chapman. Stride. Eddowes. Kelly. August through November — eleven weeks, five murders, an accelerating frequency. The last three in six weeks. Holmes's note beside the final card reads simply: 'Acceleration. He is growing less cautious. Or more confident.'",
    holmesDeduction: "An eleven-week campaign, Watson. Not compulsion — calculation. A man who began slowly and grew bolder as he understood he would not be caught. That is our frame. We are not looking for an impulsive man. We are looking for a patient one.",
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
  // GROUP 2b — Mortuary cross-reference (new)
  clue_02b_campaign_pattern: {
    id: 'clue_02b_campaign_pattern',
    name: 'One Pair of Hands',
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
    description: "Watson reads Bond's post-mortem note on Kelly. A single clinical observation buried in the anatomical detail: 'Incision patterns consistent with unusually small, steady hands. The contained precision suggests familiarity with restricted anatomical spaces.' Bond wrote it as a passing remark. Watson reads it twice.",
    holmesDeduction: "Small hands. Precise in confined spaces. Bond noticed the signature without understanding what he was signing. This is not the work of a surgeon — it is the work of someone who learned surgery in pieces, in private, without ever completing the training.",
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
  // GROUP 4b — H Division witness wall (new)
  clue_04b_adjustable_appearance: {
    id: 'clue_04b_adjustable_appearance',
    name: 'A Man of No Fixed Description',
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
  // GROUP 6 — The Smoking Gun Spelling
  clue_06_prasarved_spelling: {
    id: 'clue_06_prasarved_spelling',
    name: "The 'Prasarved' Note",
    description: "Among the assistant's forensic cataloguing notes, Watson finds a report containing the word 'prasarved' — the same idiosyncratic misspelling as in the From Hell letter. The name at the top of the note: Edmund Halward.",
    holmesDeduction: "Two men do not spell 'preserved' as 'prasarved'. The small hands. The campaign pattern. The burned clothing, and how he knew its temperature. Bond's assistant. All of it was there, Watson — from the first morning. So that is his name.",
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
    name: "The Silent Witness",
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
    watson_armchair: [],
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
    case_files_wall: 'Five locations. Five names. Five dates. Holmes has pinned them in chronological order with coloured threads connecting each to the next. At the centre, a blank card with a question mark. Watson looks at it for a long moment.',
    whitechapel_map: 'A large-scale map of Whitechapel and Spitalfields, marked with five red pins. They cluster in a radius of perhaps half a mile. Whoever did this never strayed far from home.',
    holmes_chemistry_table: "The chemistry table is uncharacteristically abandoned — beakers rinsed, equipment pushed to one side. Holmes has not been experimenting. He has been thinking. Watson finds this more unsettling than the map.",
    telegrams_pile: "A stack of telegrams from Abberline, the most recent dated yesterday. Watson scans the top one: 'No new leads. Press intolerable. Come when you can.' Holmes has underlined the word 'intolerable' in pencil.",
    watson_armchair: "Watson's armchair has been moved to face the case files wall. Someone — Holmes — has been sitting here, staring at the map. There is a cold cup of tea on the side table beside it.",
    newspaper_pile: "The Star, the Evening Standard, the Times. Every front page from August to November. Headlines grow more hysterical with each passing week: ANOTHER OUTRAGE IN WHITECHAPEL. POLICE BAFFLED. IS JACK THE RIPPER A DOCTOR? Watson sets the papers down.",
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
};

// ─────────────────────────────────────────────────────────────────────────────
// USE INTERACTIONS
// Specific narrative descriptions for "use X" commands.
// ─────────────────────────────────────────────────────────────────────────────

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
      "Watson holds the From Hell letter beside the assistant's forensic note. The handwriting differs in style — but there it is. 'Prasarved.' The same idiosyncratic spelling, in the same uncertain vowel.",
    edmund_forensic_note:
      "Watson reads the cataloguing note again. The word 'prasarved' has been written without hesitation — it is simply how this man spells the word. The letter writer spells it the same way. Watson looks at the name at the top of the page: Edmund Halward.",
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

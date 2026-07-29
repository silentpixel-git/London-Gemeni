import type { ClueDefinition, ShowInteraction, UseCombination } from '../types';
import type { StoryFlag } from './flags';

export type { ShowInteraction, UseCombination } from '../types';

const CLUE_DEFINITIONS_DATA = {
  // GROUP 0 — RETIRED (chronological rework, slice spec §5).
  // clue_00_campaign_timeline read Holmes's case-files wall: four victims and
  // six weeks of silence. Act 0 is now the Bank Holiday evening of 6 August
  // 1888 — no murder has happened and none may be hinted at, so there is no
  // campaign to chart and no wall to read. To be re-authored for a later act
  // once the reworked chronology has a campaign to pin up.

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
    connections: ['clue_01_respectable_approach', 'clue_07_edmunds_presence', 'clue_11_account_outruns_light'],
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
    connections: ['clue_06_prasarved_spelling', 'clue_05_human_kidney', 'clue_12_letter_knows_too_much'],
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
    connections: ['clue_04_kidney_removal', 'clue_06_prasarved_spelling', 'clue_08_preserved_kidney', 'clue_12_letter_knows_too_much'],
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
  // GROUP 11 — The Witness Tested (Act 1 chain: Hutchinson's account laid
  // against the archway and the light. The Stranger begins to dissolve.)
  clue_11_account_outruns_light: {
    id: 'clue_11_account_outruns_light',
    name: 'The Account Outruns the Light',
    diaryNote: "I stood where Hutchinson stood and read his statement against the ground itself. The lamp is across the street; the passage is black as a coal cellar; the rain that night would have doused what little glow there was. Spats, a tie-pin, the trim of a coat — no honest glance could have carried so much away. The account is not a lie entire. But it has been dressed.",
    description: "Watson reads Hutchinson's statement where the man claims to have stood. The gas lamp is across the street; the archway is unlit; the night of the murder was wet. At that distance, in that light, a passing glance yields outline and gait — not spats, not a tie-pin, not a parcel in the left hand. The description has been embroidered after the fact. What remains true is simpler and stranger: a man stood here for three-quarters of an hour, watching.",
    holmesDeduction: "A witness who saw too much, Watson, has usually seen too little and furnished the rest. Strike the astrakhan man's wardrobe and what is left? A figure. Ordinary. Which is to say: our man, if he was here at all, looked like no one — again.",
    locationFound: 'dorset_street',
    // Synthetic label, NOT a physical interactable: granted only via the
    // USE combination (account + archway) — same pattern as document_convergence.
    triggerObject: 'witness_test',
    connections: ['clue_04b_adjustable_appearance'],
    clueGroup: 11,
    medicalPoints: 5,
    moralPoints: 5,
  },
  // GROUP 12 — The Letter Knows Too Much (Act 4 refresher: the USE verb again,
  // one act before the convergence. Spoiler containment: establishes only that
  // the writer HANDLED the kidney — never the preservation-method-matches-Bond's-
  // lab thread (that is the SHOW-to-Bond beat), never Edmund, never the asylum.)
  clue_12_letter_knows_too_much: {
    id: 'clue_12_letter_knows_too_much',
    name: 'The Letter Knows Too Much',
    diaryNote: "I set Bond's notes on the kidney beside the letter that boasted of it. The letter itself says nothing a fairground barker could not invent — half a kidney, fried and eaten. But held against what Bond's own hand recorded, and against what the papers never printed, the boast reads differently. A man who had only read the newspapers could not have written it so carelessly right.",
    description: "Watson lays the kidney examination notes beside the From Hell letter and reads one against the other. The letter's own words are crude and say little — a boast of taking, preserving, eating. But Bond's notes, in Watson's hand from the examination itself, record what no newspaper ever carried: the organ's condition, the attached inch of renal artery. Nothing in the letter names these details outright, and yet Watson finds himself unable to dismiss the coincidence — a hoaxer, working only from the papers, would have had nothing but the papers to embroider from. Whoever wrote those clumsy lines wrote them with the thing, or the knowledge of it, close at hand.",
    holmesDeduction: "The hoax letters trade only in what the papers printed, Watson — that is how I have discarded a hundred of them without a second reading. This one I cannot discard so easily. Set beside Bond's notes it does not contradict a single particular, and a man inventing from newsprint alone tends to invent wrongly, somewhere, eventually. That is my judgment, not a certainty carved in stone — but I would stake a good deal on it.",
    locationFound: 'lusk_office',
    // Synthetic label — granted only via the USE combination (kidney notes + letter).
    triggerObject: 'letter_kidney_crossref',
    connections: ['clue_05_from_hell_letter', 'clue_05_human_kidney'],
    clueGroup: 12,
    medicalPoints: 5,
    moralPoints: 5,
  },
} satisfies Record<string, ClueDefinition>;

/** Every authored clue id — the keys of the data table, kept alive by `satisfies`. */
export type ClueId = keyof typeof CLUE_DEFINITIONS_DATA;

// Re-exported under the original wide type so consumers keep string-keyed access.
export const CLUE_DEFINITIONS: Record<string, ClueDefinition> = CLUE_DEFINITIONS_DATA;

// ─────────────────────────────────────────────────────────────────────────────
// CLUE TRIGGERS
// Map: locationId → objectId → clueId[]
// Engine checks this on every examine action.
// ─────────────────────────────────────────────────────────────────────────────

export const CLUE_TRIGGERS: Record<string, Record<string, string[]>> = {
  // Act 0 yields no clue. Nothing has happened yet — the act's work is the
  // tutorial chain (examine the ticket, take it, show it to Holmes) and the
  // refusal it earns, not evidence. clue_06_prasarved_spelling is also found
  // here, but only via USE_COMBINATIONS, so it has no trigger entry.
  baker_street: {
    pawn_ticket: [],
    nells_boots: [],
    nells_workbox: [],
    nells_letters: [],
    charity_card: [],
    concluded_case_file: [],
    holmes_chemistry_table: [],
    violin_case: [],
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
    court_archway: [],
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
    // NOTE: do not narrate Watson taking the ticket here — acquisition is
    // narrated via itemsGained (first examine only). This note also fires on
    // RE-examines, when the ticket is already in his pocket.
    pawn_ticket: "A pawnbroker's ticket, soft at the folds from being carried about. Dated Monday the thirtieth of July, from a shop in Pentonville. One pair of women's boots, pledged for two shillings. The redemption stamp is today's, fresh ink over old creases.",
    nells_boots: "A worn pair of woman's boots, twice resoled already; the uppers have given at the flex, and a third resoling would not be worth the leather. The wear runs heaviest along the outer edge of the right heel. Caked into the welt, a crust of mud still dark and damp, though London has not seen rain in a fortnight.",
    nells_workbox: "A tin box, japanned black, its lid catch stiff with disuse. It is not locked.",
    nells_letters: "Eleven letters, April through July, tied with a thread that has since come loose. Chatty and affectionate at first; the hand thins as the months go on, and the last three are written on visibly cheaper paper.",
    charity_card: "A printed subscriber's card. St. Saviour's Lying-in Charity, Snowsfields. Sixteen weekly entries of one shilling, ticked off in a clerk's copperplate, the last dated the twenty-fourth of July. The subscriber is named as Mrs. A. Marchant. On the reverse, a second and smaller hand has marked off the same dates again, as though to be certain of them.",
    concluded_case_file: "The case Holmes has just finished, bundled in string and already pushed to the far edge of the table. Watson unties it out of politeness and finds it every bit as dull as Holmes has been complaining: a disputed inheritance, a clerk, a great deal of arithmetic. It was solved in an afternoon. Holmes has not mentioned it since.",
    holmes_chemistry_table: "The chemistry table has been wiped down and abandoned. Beakers stand rinsed and inverted, the burner is cold, and the whole bench has been pushed into a tidiness entirely unlike him. Holmes has not been experimenting. Watson finds the neatness more unsettling than any disorder.",
    violin_case: "The violin lies in its case beside the chair, the bow strapped into the lid. Watson has long read the instrument as a barometer of its owner: played badly, Holmes is thinking; played well, he has finished thinking; and left in the case, as it is tonight, there is nothing whatever to think about.",
  },
  dorset_street: {
    police_barricade: "A pair of constables stand at the entrance to Miller's Court, turning back the curious. Their faces are professionally blank. Watson shows his credentials and is admitted without comment.",
    street_lamps: "The gas lamps are lit against the November fog, their light pooling uselessly in the damp air. They illuminate almost nothing. Watson wonders how the killer moved through these streets unseen and realises that in this light, almost anything is possible.",
    lodging_house_entrances: "The lodging houses along Dorset Street take in anyone who can afford fourpence a night. The women who lived here moved between them constantly — a bed here, a floor there, wherever the money stretched. Watson thinks of the difference between having a home and merely having a place to sleep.",
    crowd: "The crowd pressed against the barricade is a mixture of the morbidly curious, the genuinely afraid, and the simply poor who have nowhere else to be. A woman near Watson says nothing, just stares at the entrance to Miller's Court with the flat expression of someone who has been waiting for this to happen.",
    court_archway: "The covered passage into Miller's Court is barely three feet wide — a brick throat between two lodging houses, unlit along its length. The nearest lamp stands across the street, its glow arriving as a rumour. Watson stands where a watcher would have stood, opposite, and studies what the light actually reaches: outlines, movement, the pale smudge of a face. No more.",
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
  // Act 0: examining the ticket Mrs. Kemp leaves on the table puts it in
  // Watson's pocket — the object he SHOWS to Holmes (tutorial beat). It is a
  // memento, not a puzzle piece: no USE combination resolves it, no later act
  // pays it off, and it is deliberately absent from ITEM_SPENT_AFTER_ACT so it
  // stays in the bag for the whole game.
  pawn_ticket: "Nell's Pawn Ticket",
  charity_card: "A Subscriber's Card",
  // Not a location interactable — granted directly by TALK (see
  // TALK_GRANTS_ITEM below). Kept here for its display name and so
  // USE/SHOW's inventory-possession checks resolve it.
  hutchinson_account: "Hutchinson's Account (Watson's note)",
};

// ─────────────────────────────────────────────────────────────────────────────
// TAKEABLE GATES — object may only be taken once this flag is set.
// (No entries currently authored — see TALK_GRANTS_ITEM for the pattern used
// when an item should exist only because an NPC gave it, not as scenery.)
// ─────────────────────────────────────────────────────────────────────────────
export const TAKEABLE_REQUIRES_FLAG: Record<string, StoryFlag> = {};

// ─────────────────────────────────────────────────────────────────────────────
// TALK GRANTS ITEM — talking to this NPC adds a takeable object straight to
// inventory (once). For testimony that exists only because the NPC gave it —
// modeling it as a location object a player could examine/take before ever
// speaking to them would both leak the NPC's name early and make no sense.
// ─────────────────────────────────────────────────────────────────────────────
export const TALK_GRANTS_ITEM: Record<string, string> = {
  hutchinson: 'hutchinson_account',
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
  // Nell's pawn ticket is deliberately NOT listed. Watson keeps it for the
  // whole game and it never resolves — that is the point of it.
  // The account is Act 1 business only — spent once Act 1 closes.
  "Hutchinson's Account (Watson's note)": 1,
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
    pawn_ticket:
      "Watson reads the ticket again, more slowly. Two shillings, a Pentonville shop, a date three weeks old, and this morning's redemption stamp over it. He finds himself doing the arithmetic a doctor does without being asked: a woman who pawns her boots means to be rid of them, not to want money for them, and a woman who then buys them back the same morning her sister goes missing has not thought about the boots at all.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHOW INTERACTIONS (Infocom: SHOW X TO Y)
// Watson shows an inventory item to an NPC. Keyed by inventoryItemId → npcId.
// Each entry contains the clue triggered (if any) and the AI result note.
// ─────────────────────────────────────────────────────────────────────────────

export const SHOW_INTERACTIONS: Record<string, Record<string, ShowInteraction>> = {
  // Act 0 tutorial beat: SHOW the pawn ticket TO Holmes.
  // Sets showed_pawn_ticket_to_holmes (the engine flag keys on the object id)
  // — an Act 0 gate flag. This is the refusal the whole game answers: small
  // East End trouble, dismissed as beneath notice, hours before Tabram.
  // Holmes's contempt must read as canon-true and reasonable, NOT as villainy,
  // and must not hint at any murder — none has happened.
  'pawn_ticket': {
    'holmes': {
      resultNote: "SUCCESS — Holmes takes the ticket, holds it to the lamp for perhaps three seconds, and gives it back. 'A pair of boots, two shillings, and a woman who has gone somewhere without leaving word. You will find, Watson, that the East End is very largely composed of people who have gone somewhere without leaving word.' He is already turning away. 'There is no case here. There is not even a crime. Give the poor woman her ticket back and let her go home.' Watson does not give the ticket back. He does not entirely know why.",
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
  // SHOW the account TO hutchinson — only once the sightline test has armed it.
  // His clearing beat (red-herring rule): he breaks into loneliness, not guilt.
  'hutchinson_account': {
    'hutchinson': {
      requireFlags: ['used_hutchinson_account_with_court_archway'],
      blockedNote: "Watson's hand goes to the note in his pocket, and stops. He has only the man's own words, unweighed — read them back now and Hutchinson need only repeat them. Better first to try the account against the ground it claims to describe.",
      resultNote: "SUCCESS — Watson reads the statement back to him, slowly, and then asks — gently, as one asks a patient — how the lamp across the street showed him a tie-pin. Hutchinson's eagerness collapses by degrees. He did see a man, he says. Well-dressed — he thinks. The rest he... filled in, after, so they would take him seriously at the station. But he stood there the three-quarters of an hour, that part is gospel — he knew Mary three years, she'd have let him sleep on the floor, night like that. He looks at the archway rather than at Watson. 'I keep thinking, if I'd only stopped where I was till morning.' He has nothing else. He is not the man. He is only the last of her friends.",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// USE COMBINATIONS (Infocom: USE X WITH Y)
// Watson uses one inventory item with another object/item.
// Keyed by inventoryItemId → { withTargetId → interaction }
// ─────────────────────────────────────────────────────────────────────────────

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
    // USE kidney notes WITH the from hell letter (Act 4 refresher — no act or
    // location lock: deliberately friction-free, both items are Act 4 finds).
    'from_hell_letter': {
      clueId: 'clue_12_letter_knows_too_much',
      resultNote: "SUCCESS — Watson reads the letter's boast against Bond's examination notes, line by line. The papers printed every crude word of the letter, but the notes hold what was never published: the organ's condition, the attached inch of artery. The letter contradicts nothing Bond recorded — and a hoaxer working only from newsprint would have had nothing else to work from. Watson sets the pages down convinced the writer had handled the thing, not merely read about it.",
    },
  },
  // (The medical_reports × case_files_wall combination was retired with the
  //  case-files wall itself — see the Act 0 note at the head of this file.)
  // USE hutchinson's account WITH the court archway (Act 1 witness test).
  // The USE X WITH Y rehearsal — teaches the convergence's verb at low stakes.
  'hutchinson_account': {
    'court_archway': {
      clueId: 'clue_11_account_outruns_light',
      requiresLocation: 'dorset_street',
      resultNote: "SUCCESS — Watson stands opposite the archway, note in hand, and reads the statement against the scene. The lamp across the street; the unlit passage; the remembered rain. One by one the account's fine details fail the light. What survives is the man himself: three-quarters of an hour, watching a doorway in the wet. The description was dressed. The waiting was real.",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT TEXT (Infocom: READ X — shows the literal text of a document)
// Watson reads the actual words rather than examining the physical object.
// ─────────────────────────────────────────────────────────────────────────────

export const DOCUMENT_TEXT: Record<string, string> = {
  // Act 0. Two documents, both deliberately mundane: a pledge, a sum, a date.
  // Both are filed away at the Act 0→1 transition rather than carried the
  // whole game. Nell is never found, never named again, and never confirmed
  // connected to anything — nothing here may hint otherwise.
  pawn_ticket: `*Pledge ticket. Pentonville.*

No. 4471
Pledged: one pair women's boots, black, mended.
Advanced: two shillings.
Date: 30 July 1888.
Name: N. Rendell.

*Redeemed this day. Redeemable within twelve months of pledge. Interest at
the usual rate. Pledges not redeemed within that term become the property
of the broker.*`,

  charity_card: `*St. Saviour's Lying-in Charity, Snowsfields.*

Subscriber's Card

Mrs. A. Marchant

10 Apr   1s.
17 Apr   1s.
24 Apr   1s.
1 May    1s.
8 May    1s.
15 May   1s.
22 May   1s.
29 May   1s.
5 Jun    1s.
12 Jun   1s.
19 Jun   1s.
26 Jun   1s.
3 Jul    1s.
10 Jul   1s.
17 Jul   1s.
24 Jul   1s.

*A bed and attendance secured for December, upon completion of the full
subscription.*

On the reverse, in a second and smaller hand: the same sixteen dates,
ticked off again.`,

  from_hell_letter: `*From Hell.*

Mr Lusk,
Sor
I send you half the Kidne I took from one woman prasarved it for you tother piece I fried and ate it was very nise. I may send you the bloody knif that took it out if you only wate a whil longer.

signed Catch me when you can Mishter Lusk`,

  hutchinson_account: `*Statement of George Hutchinson, labourer — taken down by Watson, Dorset Street, 9 November 1888.*

Knew the deceased, Mary Jane Kelly, some three years. Met her on Commercial Street in the small hours; she asked him for sixpence, which he had not. She went off toward Dorset Street with a man of about thirty-four — dark, of prosperous appearance, a moustache curled at the ends, wearing a long dark coat trimmed with astrakhan, a white collar, a black tie fixed with a horseshoe pin, dark spats over button boots, and a thick gold chain with a red stone seal hanging from it. Carried a small parcel in his left hand, done up with a strap. Followed the pair to the court and waited opposite, some three-quarters of an hour, to see whether the man came out again.

*Watson's note: the detail above is extraordinary for a chance encounter in near-darkness — every particular of dress, down to the seal on the watch-chain. He gave it eagerly, almost by rote.*`,

  edmund_forensic_note: `*Post-mortem cataloguing note — Miller's Court, 9 November 1888.*
*Transcribed by E. Halward, assistant to Dr. T. Bond.*

Injuries consistent with prior cases. Organ removal: uterus, heart, portions of kidney. Incision depth and angle consistent with Chapman and Eddowes examinations. Tissue prasarved in spirit of wine (standard laboratory concentration, per standing procedure). Fire in grate burned approximately four hours — consistent with witness reports of warmth in the room at time of discovery.

*E. Halward*`,

  // (The telegrams pile and both case-files-wall texts were retired with the
  //  Act 0 rework — see the GROUP 0 note at the head of this file.)

  autopsy_ledger: `*Whitechapel Mortuary Post-Mortem Ledger — Dr. Thomas Bond, 1888.*

Entry 3 — Annie Chapman, 8 September:
Uterus removed with a single clean incision. Cuts exhibit familiarity with abdominal cavity. No professional qualification evident, but practical anatomical knowledge confirmed. Organ retention: deliberate.

Entry 5 — Catherine Eddowes, 30 September:
Left kidney removed within estimated four minutes. Efficiency consistent with prior practice. Spirit of wine fixative observed on tissue fragment (facial). Laboratory concentration, per standing procedure.

Entry 6 — Mary Jane Kelly, 9 November:
[See supplementary notes. Not reproduced here.]`,
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT OBJECT IDS — every takeable object that also has authored document
// text: the full universe of things that can appear in the Documents tab.
// Filed status itself is tracked as an engine-set `filed_<objectId>` flag
// (see GameEngine.resolve()), not as separate save-state, so a document
// stays on file even after it leaves the inventory bag (dropped, spent after
// an act transition, or consumed by a USE combination).
// ─────────────────────────────────────────────────────────────────────────────
export const DOCUMENT_OBJECT_IDS: string[] = Object.keys(TAKEABLE_OBJECTS)
  .filter(id => DOCUMENT_TEXT[id] !== undefined);

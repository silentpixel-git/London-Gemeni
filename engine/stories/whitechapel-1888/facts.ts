// Atomic world-knowledge facts for the Whitechapel 1888 story.
// NPC knowledge envelopes are DERIVED from this file (see engine/stories/knowledge.ts):
// an NPC knows every fact whose knownBy includes them and whose visibleFromAct has passed.
// ORDER MATTERS: per-NPC envelope order = file order (aiCore's 8-item cap prefers the head).
// Phase 2a migration: statements verbatim from the old publicKnowledge arrays; all
// visibleFromAct: 0 for behavior parity. Dedupe/act-tagging are separate passes.
import type { StoryFact } from '../types';

export const FACTS: StoryFact[] = [
  // ── holmes ──────────────────────────────────────────────────────────────────
  // Spoiler-safe and timeline-neutral: Holmes's envelope must hold from the
  // prologue (four victims, Kelly alive) through Act 6. The prasarved match
  // and "murders stopped" are DISCOVERIES, not knowledge — never listed here.
  { id: 'holmes_studied_files', statement: 'Has studied the police files on every murder and visits each scene to conduct independent analysis', knownBy: ['holmes'], visibleFromAct: 0 },
  { id: 'holmes_killer_nonthreatening', statement: 'The killer appeared non-threatening to victims — respectable-looking or known to them', knownBy: ['holmes'], visibleFromAct: 0 },
  { id: 'holmes_student_not_surgeon', statement: 'Anatomical removals required knowledge of organ location, not surgical mastery — the knowledge of a student, not a surgeon', knownBy: ['holmes'], visibleFromAct: 0 },
  { id: 'holmes_not_panicked_stride', statement: "Not panicked by Stride's interruption — completed a second murder the same night within 45 minutes", knownBy: ['holmes'], visibleFromAct: 0 },
  { id: 'holmes_no_reliable_witness', statement: 'The killer moves through Whitechapel without raising alarm — no reliable witness in the entire campaign', knownBy: ['holmes'], visibleFromAct: 0 },
  { id: 'holmes_man_no_one_remembers', statement: 'His working certainty: the killer is a man no one remembers — unremarkable, patient, calculating', knownBy: ['holmes'], visibleFromAct: 0 },
  { id: 'holmes_dear_boss_hoax', statement: 'Considers the published "Dear Boss" letters a journalist\'s invention — misdirection, like much else in this case', knownBy: ['holmes'], visibleFromAct: 0 },
  { id: 'holmes_knowing_vs_proving', statement: 'Refuses to name a suspect without evidence that would satisfy a court — "knowing and proving are not the same act"', knownBy: ['holmes'], visibleFromAct: 0 },

  // ── abberline ───────────────────────────────────────────────────────────────
  { id: 'abberline_leads_investigation', statement: 'Leads the Metropolitan Police investigation from Commercial Street station', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_five_victims', statement: 'Five victims: Mary Ann Nichols (31 Aug), Annie Chapman (8 Sep), Elizabeth Stride and Catherine Eddowes (30 Sep, double event), Mary Jane Kelly (9 Nov)', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_double_event', statement: 'The double event on 30 September was the worst night — two murders in 45 minutes, two different police jurisdictions', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_city_police_coordination', statement: 'City Police handled Eddowes at Mitre Square — inter-force coordination has been problematic throughout', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_graffiti_wiped', statement: 'Commissioner Warren ordered the Goulston Street graffiti wiped before it could be photographed, to prevent anti-Jewish riots', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_2000_interviewed', statement: 'Over 2,000 people interviewed; no conclusive forensic link established to any individual', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_press_speculation', statement: 'The press — Star and Times in particular — prints speculation as fact and terrifies witnesses into silence', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_contradictory_witnesses', statement: 'No reliable witness has seen the killer with any victim; every description is contradictory', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_vigilance_committee', statement: 'George Lusk and the Vigilance Committee provide ground coverage but also pressure from below', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_political_pressure', statement: 'Has been under political pressure to investigate dock workers and the foreign community — resists it but cannot ignore it entirely', knownBy: ['abberline'], visibleFromAct: 0 },
  // Historical accuracy: Bond explicitly concluded the killer lacked formal medical training.
  // Abberline MUST NOT assert medical skill as investigative consensus — he reflects the dispute.
  { id: 'abberline_bond_assessment', statement: 'Dr. Bond\'s formal assessment is that the killer had some rough anatomical knowledge but NO surgical training or professional medical qualification — Bond was explicit on this point and disagreed with other surgeons who suggested otherwise. Abberline respects Bond\'s conclusion and presents it as the official medical position, not as one view among many.', knownBy: ['abberline'], visibleFromAct: 0 },
  // Bond alibi — exonerates him as a suspect if Watson asks the right questions.
  { id: 'abberline_bond_alibi', statement: 'Dr. Thomas Bond\'s movements on the nights of the Stride and Eddowes murders (30 September) were fully accounted for — he was presenting a paper at a medical society dinner in the City and was seen by colleagues throughout the evening. He was called to the Eddowes scene after the fact. Abberline confirmed this personally.', knownBy: ['abberline'], visibleFromAct: 0 },
  // The loud-suspect landscape (reweave)
  { id: 'abberline_tumblety_custody', statement: 'The Yard has an American in custody — Francis Tumblety, a quack doctor arrested 7 November on gross-indecency charges; some at the Yard fancy him for the murders, given his anatomical specimen collection and hatred of women', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_pizer_alibied', statement: 'John Pizer — the man the press called "Leather Apron" — was arrested in September, fully alibied, and released; the panic around him was manufactured by the newspapers and nearly got him lynched', knownBy: ['abberline'], visibleFromAct: 0 },
  { id: 'abberline_barrister_file', statement: 'A file has come across his desk on a barrister of good family — lately erratic, dismissed from his post for some unnamed trouble, and now not to be found at his chambers or his lodgings', knownBy: ['abberline'], visibleFromAct: 0 },

  // ── bond ────────────────────────────────────────────────────────────────────
  { id: 'bond_chapman_findings', statement: 'Annie Chapman: uterus removed cleanly, incision shows familiarity with abdominal anatomy but not surgical mastery', knownBy: ['bond'], visibleFromAct: 0 },
  { id: 'bond_eddowes_findings', statement: 'Catherine Eddowes: left kidney and uterus removed within minutes, efficiency consistent with prior practice', knownBy: ['bond'], visibleFromAct: 0 },
  { id: 'bond_kelly_findings', statement: 'Mary Jane Kelly: most extensive injuries, killer had several uninterrupted hours, fire burned for light', knownBy: ['bond'], visibleFromAct: 0 },
  { id: 'bond_profile_anderson', statement: 'Wrote a formal psychological profile in November 1888 for Assistant Commissioner Anderson', knownBy: ['bond'], visibleFromAct: 0 },
  { id: 'bond_killer_assessment', statement: 'His assessment: killer works alone, operates at night, has anatomical knowledge but no professional medical qualification', knownBy: ['bond'], visibleFromAct: 0 },
  { id: 'bond_assistant_catalogues', statement: "His assistant has transcribed and catalogued all post-mortem reports", knownBy: ['bond'], visibleFromAct: 0 },
  { id: 'bond_evidence_only', statement: 'Committed to reporting only what evidence substantiates — will not speculate beyond the record', knownBy: ['bond'], visibleFromAct: 0 },

  // ── edmund ──────────────────────────────────────────────────────────────────
  { id: 'edmund_assistant_to_bond', statement: 'Medical assistant to Dr. Bond; present during post-mortem examinations', knownBy: ['edmund'], visibleFromAct: 0 },
  { id: 'edmund_left_training', statement: 'Studied medicine but left formal training unexpectedly before completion', knownBy: ['edmund'], visibleFromAct: 0 },
  { id: 'edmund_well_regarded', statement: 'Quiet, polite, reserved — well-regarded by those who work with him', knownBy: ['edmund'], visibleFromAct: 0 },
  // Edmund never discusses his own background — this is what the AI may NOT use

  // ── lusk ────────────────────────────────────────────────────────────────────
  { id: 'lusk_kidney_parcel', statement: 'Received the kidney parcel on 16 October 1888 — half a human kidney preserved in spirits of wine', knownBy: ['lusk'], visibleFromAct: 0 },
  { id: 'lusk_assumed_prank', statement: 'Initially assumed it was a prank by medical students; had it examined only after delay', knownBy: ['lusk'], visibleFromAct: 0 },
  { id: 'lusk_openshaw_confirmed', statement: 'Dr. Openshaw confirmed the kidney was human tissue, female, approximately 45 years old, consistent with Bright\'s disease (matching Eddowes)', knownBy: ['lusk'], visibleFromAct: 0 },
  { id: 'lusk_letter_phrasing', statement: 'The letter\'s phrasing stays with him: "I send you half the Kidne I took from one women prasarved it for you tother piece I fried and ate it was very nise"', knownBy: ['lusk'], visibleFromAct: 0 },
  { id: 'lusk_founded_committee', statement: 'Founded the Whitechapel Vigilance Committee out of anger that the police were failing the neighbourhood', knownBy: ['lusk'], visibleFromAct: 0 },
  { id: 'lusk_nightly_patrols', statement: 'Conducts nightly patrols; lobbied the Home Secretary for a government reward (refused)', knownBy: ['lusk'], visibleFromAct: 0 },
  { id: 'lusk_distrusts_machinery', statement: 'Distrusts the official investigation — not the men, but the machinery and inter-force politics', knownBy: ['lusk'], visibleFromAct: 0 },

  // ── diemschutz ──────────────────────────────────────────────────────────────
  { id: 'diemschutz_found_stride', statement: "Found Elizabeth Stride's body in Dutfield's Yard on the night of 30 September", knownBy: ['diemschutz'], visibleFromAct: 0 },
  { id: 'diemschutz_interrupted_killer', statement: "His cart may have interrupted the killer mid-act — no mutilation followed the throat wound", knownBy: ['diemschutz'], visibleFromAct: 0 },
  { id: 'diemschutz_testimony_timeline', statement: 'Witnessed or heard sounds that night; testimony was crucial to reconstructing the killer\'s timeline', knownBy: ['diemschutz'], visibleFromAct: 0 },
  { id: 'diemschutz_horse_shied', statement: 'The horse shied — that was the first sign something was wrong', knownBy: ['diemschutz'], visibleFromAct: 0 },

  // ── hutchinson ──────────────────────────────────────────────────────────────
  { id: 'hutchinson_knew_kelly', statement: 'Knew Mary Jane Kelly for some three years; she sometimes borrowed small sums from him', knownBy: ['hutchinson'], visibleFromAct: 0 },
  { id: 'hutchinson_met_kelly_commercial', statement: 'Met Kelly on Commercial Street in the small hours of 9 November; she asked him for sixpence he did not have', knownBy: ['hutchinson'], visibleFromAct: 0 },
  { id: 'hutchinson_saw_stranger', statement: 'Saw her go with a man of about thirty-four — dark, of prosperous appearance, with an astrakhan-trimmed coat, a gold watch-chain, and a "foreign" or "Jewish" look', knownBy: ['hutchinson'], visibleFromAct: 0 },
  { id: 'hutchinson_over_detailed', statement: 'The detail of his description is extraordinary — tie-pin, spats, the parcel in the man\'s left hand — far more than a passing glance should yield', knownBy: ['hutchinson'], visibleFromAct: 0 },
  { id: 'hutchinson_loitered_admission', statement: 'Admits he stood opposite Miller\'s Court for three-quarters of an hour afterward, waiting — he says — to see if the man came out', knownBy: ['hutchinson'], visibleFromAct: 0 },
  { id: 'hutchinson_why_loitered', statement: 'He loitered because he knew Kelly and half-hoped she would let him shelter the night; he had nowhere to sleep', knownBy: ['hutchinson'], visibleFromAct: 0 },
  { id: 'hutchinson_no_medical_knowledge', statement: 'Has no medical knowledge of any kind; works with his hands', knownBy: ['hutchinson'], visibleFromAct: 0 },

  // ── phillips ────────────────────────────────────────────────────────────────
  // Historical accuracy: keep the positions un-swapped — Phillips = knowledge, Bond = no mastery.
  { id: 'phillips_chapman_postmortem', statement: 'Performed the post-mortem on Annie Chapman; was struck by the work — in his view it showed considerable anatomical knowledge', knownBy: ['phillips'], visibleFromAct: 0 },
  { id: 'phillips_real_familiarity', statement: 'Maintains the organ removals indicate real familiarity with the position of the organs — a man who knew exactly where to cut and what he was taking', knownBy: ['phillips'], visibleFromAct: 0 },
  { id: 'phillips_bond_dispute', statement: 'Dr. Bond disagrees: Bond holds the killer had no true surgical skill and no professional qualification — the dispute between them is genuine and unresolved', knownBy: ['phillips'], visibleFromAct: 0 },
  { id: 'phillips_watched_not_qualified', statement: 'Both positions can be true at once: real anatomical knowledge without formal training — the knowledge of a man who has watched and studied, not one who qualified', knownBy: ['phillips'], visibleFromAct: 0 },
  { id: 'phillips_knowledge_not_rare', statement: 'Anatomical knowledge is not rare in Whitechapel — medical students, mortuary men, slaughtermen, hospital dressers all possess some measure of it', knownBy: ['phillips'], visibleFromAct: 0 },

  // ── tumblety ────────────────────────────────────────────────────────────────
  // Documented facts only — his guilt is FALSE; the envelope must let the AI play him loud without confirming anything.
  { id: 'tumblety_patent_remedies', statement: 'An American who styles himself a doctor; made a fortune selling patent remedies — no formal medical qualification', knownBy: ['tumblety'], visibleFromAct: 0 },
  { id: 'tumblety_arrested_7_nov', statement: 'Arrested 7 November 1888 on charges of gross indecency; held while the police consider him for the murders', knownBy: ['tumblety'], visibleFromAct: 0 },
  { id: 'tumblety_specimen_collection', statement: 'Keeps a collection of anatomical specimens in jars — and has boasted of possessing a collection of uteri', knownBy: ['tumblety'], visibleFromAct: 0 },
  { id: 'tumblety_contempt_women', statement: 'Speaks of women, and of a failed marriage, with open contempt', knownBy: ['tumblety'], visibleFromAct: 0 },
  { id: 'tumblety_showman_anatomy', statement: 'His anatomical knowledge is a showman\'s — names and flourish, not practice; his specimens are purchased curios, crudely kept', knownBy: ['tumblety'], visibleFromAct: 0 },
  { id: 'tumblety_unaccounted_nights', statement: 'Was in London through the autumn; cannot or will not account precisely for his nights', knownBy: ['tumblety'], visibleFromAct: 0 },
  { id: 'tumblety_theatrical_denial', statement: 'Denies the murders with theatrical indignation — and visibly enjoys being asked', knownBy: ['tumblety'], visibleFromAct: 0 },

  // ── pizer ───────────────────────────────────────────────────────────────────
  { id: 'pizer_bootmaker', statement: 'A bootmaker by trade; the leather apron the press made infamous is an ordinary tool of his work', knownBy: ['pizer'], visibleFromAct: 0 },
  { id: 'pizer_arrested_panic', statement: 'Arrested on 10 September on the strength of the "Leather Apron" panic; the mob outside nearly had him before the police did', knownBy: ['pizer'], visibleFromAct: 0 },
  { id: 'pizer_fully_alibied', statement: 'Fully alibied for the nights in question — for one murder he was watching the dock fire with a constable; for another he was in a lodging house with witnesses', knownBy: ['pizer'], visibleFromAct: 0 },
  { id: 'pizer_released_compensated', statement: 'Released without charge; one newspaper later paid him compensation for what it had printed', knownBy: ['pizer'], visibleFromAct: 0 },
  { id: 'pizer_panic_manufactured', statement: 'The panic was manufactured — a name the papers conjured and the neighbourhood learned to hate', knownBy: ['pizer'], visibleFromAct: 0 },
  { id: 'pizer_community_fears_mob', statement: 'Still cannot walk some streets; the community fears the mob as much as the murderer', knownBy: ['pizer'], visibleFromAct: 0 },

  // ── superintendent ──────────────────────────────────────────────────────────
  { id: 'superintendent_manages_asylum', statement: 'Manages a private asylum for those whose families wish discretion', knownBy: ['superintendent'], visibleFromAct: 0 },
  { id: 'superintendent_patient_mid_november', statement: 'A patient matching the name Watson inquires about has been here since mid-November 1888', knownBy: ['superintendent'], visibleFromAct: 0 },
  { id: 'superintendent_quiet_arrangement', statement: 'The family arrangement was made quietly and quickly', knownBy: ['superintendent'], visibleFromAct: 0 },
  { id: 'superintendent_minimal_disclosure', statement: 'Speaks minimally about patients; will not volunteer information beyond what professional courtesy requires', knownBy: ['superintendent'], visibleFromAct: 0 },
  { id: 'superintendent_humane_confinement', statement: 'Believes private confinement is a humane solution for certain situations', knownBy: ['superintendent'], visibleFromAct: 0 },
];

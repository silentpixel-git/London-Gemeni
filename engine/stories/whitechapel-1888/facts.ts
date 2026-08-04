// Atomic world-knowledge facts for the Whitechapel 1888 story.
// NPC knowledge envelopes are DERIVED from this file (see engine/stories/knowledge.ts):
// an NPC knows every fact whose knownBy includes them and whose visibleFromAct has passed.
// ORDER MATTERS: per-NPC envelope order = file order (aiCore's 8-item cap prefers the head).
// Phase 2a migration: statements verbatim from the old publicKnowledge arrays; all
// visibleFromAct: 0 for behavior parity. Dedupe/act-tagging are separate passes.
import type { StoryFact } from '../types';

export const FACTS: StoryFact[] = [
  // ── mrs_kemp (Act 0 only) ───────────────────────────────────────────────────
  // The caller Holmes turns away. Nothing here may hint at any murder — none
  // has happened on 6 August — and nothing anywhere may connect Nell to the
  // case. She is the first of the ones nobody remembers, and she stays unfound.
  // Topics must cover every proper noun and figure the act's own prose puts in
  // front of the player: the ticket names Pentonville, and the statements
  // below name six days and the Tuesday. A player who reads one of those and
  // asks about it must not hit silence.
  { id: 'kemp_sister_missing', statement: 'Her sister Nell has not been seen for six days, since the Tuesday. Nell would not go off without saying, whatever the gentleman may think of women in that quarter; the two of them have never gone a week without a word', knownBy: ['mrs_kemp'], visibleFromAct: 0, topics: ['your sister', 'nell', 'six days', 'the tuesday', 'when you last saw her', 'why you have come', 'what brings you here'] },
  { id: 'kemp_pawn_ticket', statement: 'The only thing she has to show is Nell\'s ticket for a pair of boots, pledged at a Pentonville shop. She fetched them back herself this very morning, before the dinner that never happened, thinking her sister should have them if she came. A woman does not fetch back boots she meant to be rid of unless she means them for someone', knownBy: ['mrs_kemp'], visibleFromAct: 0, topics: ['the ticket', 'the boots', 'the pawnbroker', 'pentonville', 'the pawnshop'] },
  { id: 'kemp_police_wont_look', statement: 'She went to the police. They took the name down in a book. That was the whole of it, and she has heard nothing since', knownBy: ['mrs_kemp'], visibleFromAct: 0, topics: ['the police', 'what they said'] },
  { id: 'kemp_sister_sickly_spring', statement: 'Nell was poorly in the mornings through the spring. She told her at the time it was the fish', knownBy: ['mrs_kemp'], visibleFromAct: 0, topics: ['her health', 'the spring', 'she was poorly', 'the sickness'] },
  { id: 'kemp_landlady', statement: 'The landlady saw Nell go at six in the morning with a bag. The rent lapsed on the Saturday; the room was cleared by Sunday. Nothing in it worth keeping', knownBy: ['mrs_kemp'], visibleFromAct: 0, topics: ['the landlady', 'mrs pring', 'the room'] },
  { id: 'kemp_why_she_hid', knownBy: ['mrs_kemp'], visibleFromAct: 0, requireFlags: ['act0_reconstruction_complete'],
    // Broad on purpose: a live playtest showed a natural, on-topic phrasing
    // ("why her sister hid this from her") missing every one of the original
    // four narrow phrases and silently falling through to ungrounded AI
    // improv — which then also mis-selected the diary's "kept the address"
    // closing variant, since no flag had actually been set.
    topics: ['why she hid', 'why she hid herself', 'why she did not tell you', 'whether you know why',
      'hid this from you', 'hid it from you', 'hiding it from you', 'hiding this from you', 'kept this from you'],
    statement: 'She does not answer. Watson has asked Madam, if she has hidden herself from you, do you know why, and she has no answer to give him' },

  // ── holmes ──────────────────────────────────────────────────────────────────
  // Spoiler-safe: the prasarved match and "murders stopped" are DISCOVERIES,
  // not knowledge — never listed here.
  //
  // CHRONOLOGICAL REWORK: the campaign facts below are sealed to Act 2. Acts 0
  // and 1 are August 1888 — on the Bank Holiday no murder has happened at all,
  // and after Tabram there is one killing and nothing yet connected. Holmes
  // cannot hold a view about "the whole campaign", the double event, or the
  // Dear Boss letters (September) at a point in the story where none of them
  // exist. Act 3's gate asks for holmes_no_reliable_witness, which 2 satisfies.
  { id: 'holmes_studied_files', statement: 'Has studied the police files on every murder and visits each scene to conduct independent analysis', knownBy: ['holmes'], visibleFromAct: 2, topics: ['the police files', 'the files', 'your analysis'] },
  { id: 'holmes_killer_nonthreatening', statement: 'The killer appeared non-threatening to victims — respectable-looking or known to them', knownBy: ['holmes'], visibleFromAct: 2, topics: ['how he approaches them', 'the approach', 'why they did not run'] },
  { id: 'holmes_student_not_surgeon', statement: 'Anatomical removals required knowledge of organ location, not surgical mastery — the knowledge of a student, not a surgeon', knownBy: ['holmes'], visibleFromAct: 2, topics: ['the anatomy', 'surgical skill', 'the removals'] },
  { id: 'holmes_not_panicked_stride', statement: "Not panicked by Stride's interruption — completed a second murder the same night within 45 minutes", knownBy: ['holmes'], visibleFromAct: 2, topics: ['the double event', 'the interruption', 'that night'] },
  { id: 'holmes_no_reliable_witness', statement: 'The killer moves through Whitechapel without raising alarm — no reliable witness in the entire campaign', knownBy: ['holmes'], visibleFromAct: 2, topics: ['the witnesses', 'why no one remembers him', 'the descriptions'] },
  { id: 'holmes_man_no_one_remembers', statement: 'His working certainty: the killer is a man no one remembers — unremarkable, patient, calculating', knownBy: ['holmes'], visibleFromAct: 2, topics: ['the man we are looking for', 'your theory', 'the killer'] },
  { id: 'holmes_dear_boss_hoax', statement: 'Considers the published "Dear Boss" letters a journalist\'s invention — misdirection, like much else in this case', knownBy: ['holmes'], visibleFromAct: 2, topics: ['the letters', 'dear boss', 'the press letters'] },
  // Timeless character, not campaign knowledge — safe from Act 0.
  { id: 'holmes_knowing_vs_proving', statement: 'Refuses to name a suspect without evidence that would satisfy a court — "knowing and proving are not the same act"', knownBy: ['holmes'], visibleFromAct: 0, topics: ['proof', 'the evidence', 'knowing and proving'] },
  // Act 0 — the Bank Holiday. The irony the act is built on: Holmes declares
  // crime finished, hours before Tabram. None of these may hint at a murder.
  // Gated on the reconstruction: this is the act's CLOSING beat and it is only
  // earned once he has just taken a human catastrophe apart and found it
  // arithmetic. Ungated, he delivered it in the act's opening minutes — before
  // the caller had even sat down — spending the ending on turn two.
  // This is the closing beat of the act. "This is the closing beat" used to be
  // three words INSIDE the statement string above — a stray authoring note
  // that was being fed to the AI as something Holmes knows, in the same list
  // as everything he actually says. Moved here, where it belongs.
  { id: 'holmes_crime_grown_dull', statement: 'His complaint of the season: the great cases are done. What remains to the criminal classes is squalid stuff that explains itself before a man can get his coat on — a woman vanishes out of London and the answer is a pawn ticket, a postmark and a shilling a week; everything is a sum now. He says it as settled fact rather than as melancholy, and adds, still watching the crowd below: he should be glad of something he could not have solved from this window', knownBy: ['holmes'], visibleFromAct: 0, requireFlags: ['act0_closing_complete'], topics: ['the criminal classes', 'crime', 'your boredom'] },
  // Reconstruction findings stay gated on SHOWing the card to Holmes. Ungated
  // they were both askable by name and
  // free for him to voice as background from turn one, handing the player the
  // solved case — "ask holmes about marchant" before the workbox was open.
  // The crowd thesis remains sealed until the final closing event; the refusal
  // is gated on reconstruction because it is his verdict ON the
  // reconstruction and means nothing before it.
  // Spec's Phase F cost beat — "You might have said it more gently." / "I
  // might... She would have understood it less." — is Watson's private aside
  // right after the refusal, not something Holmes is asked. It has no natural
  // home in a paraphrased TALK answer, which is built to deliver ONE
  // character's voice on the named subject, not a Watson/Holmes exchange. Folded
  // into what Holmes himself would say of his own manner instead, so the cost
  // survives the paraphrase even though the exact lines cannot be guaranteed.
  { id: 'holmes_no_case_here', statement: 'On the woman who called: he has found her sister exactly, and there is no crime in it. She has arranged her own affairs with more foresight than most of his clients manage, and gone to considerable expense to be somewhere her sister is not. What her sister does with that knowledge is not a problem for him to solve; it is a decision, and hers alone. His tone is flat and perfectly reasonable, and he is wrong. Pressed on whether he might have delivered it more gently, he allows that he might — and adds that she would only have understood it the less for it', knownBy: ['holmes'], visibleFromAct: 0, requireFlags: ['act0_reconstruction_complete'], topics: ['mrs kemp', 'the woman who called', 'her sister', 'why you refused', 'why you will not help'] },
  { id: 'holmes_concluded_case', statement: 'The matter he has just finished is concluded and already forgotten. He names nothing and no one about it and declines to be drawn; it was solved in an afternoon and was not worth the afternoon', knownBy: ['holmes'], visibleFromAct: 0, topics: ['the case you have just closed', 'your last case'] },
  { id: 'holmes_invisible_in_a_crowd', statement: 'At the open window, watching the holiday crowd: the whole city is turned out of doors tonight, a hundred thousand of them at the least, and a man might pass through the whole of that and be remembered by none. He means it as a complaint about the tedium of scale', knownBy: ['holmes'], visibleFromAct: 0, requireFlags: ['act0_closing_complete'], topics: ['the crowd', 'the holiday', 'the window'] },
  { id: 'holmes_boots_bermondsey', statement: 'Oak bark, lime, and south-bank river silt, caked into a pair of boots in a dry August. Four streets in London could put all three on one sole, and every one of them is a tanyard in Bermondsey', knownBy: ['holmes'], visibleFromAct: 0, requireFlags: ['act0_reconstruction_complete'], topics: ['the mud', 'bermondsey'] },
  { id: 'holmes_letters_tuesdays', statement: 'Three consecutive Tuesdays with a postmark south of the river, and not one word of them in eleven letters. She left on a fourth Tuesday, and did not come home', knownBy: ['holmes'], visibleFromAct: 0, requireFlags: ['act0_reconstruction_complete'], topics: ['the postmarks', 'tuesday'] },
  { id: 'holmes_honest_object', statement: 'Everything she took, she chose. The workbox is the one thing she did not think about, and is therefore the only honest object in the room', knownBy: ['holmes'], visibleFromAct: 0, requireFlags: ['act0_reconstruction_complete'], topics: ['what she left behind', 'the honest object'] },
  { id: 'holmes_mothers_name', statement: 'She took her mother\'s name with her and left the rest of her family behind it', knownBy: ['holmes'], visibleFromAct: 0, requireFlags: ['act0_reconstruction_complete'], topics: ['marchant', 'the name she gave the charity'] },
  // Act-gated capstones. These carry the act's turning thought and are what the
  // ACT_PROGRESSION gate asks for — the player must raise the subject with
  // Holmes, not merely stand near him. visibleFromAct keeps each sealed until
  // the act that earns it, so neither can be asked for early.
  { id: 'holmes_tumblety_performance', statement: 'His read on the American: the man is a performance — the indignation, the specimens, the relish at being suspected are all display, and a display is the opposite of what this killer does', knownBy: ['holmes'], visibleFromAct: 2, topics: ['the american', 'tumblety', 'the mad doctor'] },
  { id: 'holmes_preserving_hand', statement: 'Whoever sent the kidney preserved it first, in spirits of wine, and preserving is a habit of the hands — the letters may be hoaxes, but the hand that kept that organ is still somewhere in this business', knownBy: ['holmes'], visibleFromAct: 4, topics: ['the preserving hand', 'the kidney', 'the spirits of wine'] },

  // ── abberline ───────────────────────────────────────────────────────────────
  { id: 'abberline_leads_investigation', statement: 'Leads the Metropolitan Police investigation from Commercial Street station', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the investigation', 'your work', 'the yard'] },
  { id: 'abberline_five_victims', statement: 'Five victims: Mary Ann Nichols (31 Aug), Annie Chapman (8 Sep), Elizabeth Stride and Catherine Eddowes (30 Sep, double event), Mary Jane Kelly (9 Nov)', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the victims', 'the five', 'the murders'] },
  { id: 'abberline_double_event', statement: 'The double event on 30 September was the worst night — two murders in 45 minutes, two different police jurisdictions', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the double event', 'the thirtieth of september'] },
  { id: 'abberline_city_police_coordination', statement: 'City Police handled Eddowes at Mitre Square — inter-force coordination has been problematic throughout', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the city police', 'mitre square', 'the jurisdictions'] },
  { id: 'abberline_graffiti_wiped', statement: 'Commissioner Warren ordered the Goulston Street graffiti wiped before it could be photographed, to prevent anti-Jewish riots', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the graffiti', 'the writing on the wall', 'warren', 'goulston street'] },
  { id: 'abberline_2000_interviewed', statement: 'Over 2,000 people interviewed; no conclusive forensic link established to any individual', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the interviews', 'the house to house', 'two thousand men'] },
  { id: 'abberline_press_speculation', statement: 'The press — Star and Times in particular — prints speculation as fact and terrifies witnesses into silence', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the press', 'the newspapers'] },
  { id: 'abberline_contradictory_witnesses', statement: 'No reliable witness has seen the killer with any victim; every description is contradictory', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the witnesses', 'the descriptions'] },
  { id: 'abberline_vigilance_committee', statement: 'George Lusk and the Vigilance Committee provide ground coverage but also pressure from below', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the vigilance committee', 'lusk'] },
  { id: 'abberline_political_pressure', statement: 'Has been under political pressure to investigate dock workers and the foreign community — resists it but cannot ignore it entirely', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the pressure', 'the politics', 'the dock workers'] },
  // Historical accuracy: Bond explicitly concluded the killer lacked formal medical training.
  // Abberline MUST NOT assert medical skill as investigative consensus — he reflects the dispute.
  { id: 'abberline_bond_assessment', statement: 'Dr. Bond\'s formal assessment is that the killer had some rough anatomical knowledge but NO surgical training or professional medical qualification — Bond was explicit on this point and disagreed with other surgeons who suggested otherwise. Abberline respects Bond\'s conclusion and presents it as the official medical position, not as one view among many.', knownBy: ['abberline'], visibleFromAct: 0, topics: ['bond', 'the medical opinion'] },
  // Bond alibi — exonerates him as a suspect if Watson asks the right questions.
  { id: 'abberline_bond_alibi', statement: 'Dr. Thomas Bond\'s movements on the nights of the Stride and Eddowes murders (30 September) were fully accounted for — he was presenting a paper at a medical society dinner in the City and was seen by colleagues throughout the evening. He was called to the Eddowes scene after the fact. Abberline confirmed this personally.', knownBy: ['abberline'], visibleFromAct: 0, topics: ["bond's alibi", "bond's movements", 'where bond was'] },
  // The loud-suspect landscape (reweave)
  { id: 'abberline_tumblety_custody', statement: 'The Yard has an American in custody — Francis Tumblety, a quack doctor arrested 7 November on gross-indecency charges; some at the Yard fancy him for the murders, given his anatomical specimen collection and hatred of women', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the american', 'tumblety', 'the man in custody'] },
  { id: 'abberline_pizer_alibied', statement: 'John Pizer — the man the press called "Leather Apron" — was arrested in September, fully alibied, and released; the panic around him was manufactured by the newspapers and nearly got him lynched', knownBy: ['abberline'], visibleFromAct: 0, topics: ['leather apron', 'pizer'] },
  { id: 'abberline_barrister_file', statement: 'A file has come across his desk on a barrister of good family — lately erratic, dismissed from his post for some unnamed trouble, and now not to be found at his chambers or his lodgings', knownBy: ['abberline'], visibleFromAct: 0, topics: ['the barrister', 'the gentleman', 'the file on your desk'] },

  // ── bond ────────────────────────────────────────────────────────────────────
  { id: 'bond_chapman_findings', statement: 'Annie Chapman: uterus removed cleanly, incision shows familiarity with abdominal anatomy but not surgical mastery', knownBy: ['bond'], visibleFromAct: 0, topics: ['annie chapman', 'chapman'] },
  { id: 'bond_eddowes_findings', statement: 'Catherine Eddowes: left kidney and uterus removed within minutes, efficiency consistent with prior practice', knownBy: ['bond'], visibleFromAct: 0, topics: ['catherine eddowes', 'eddowes', 'the kidney'] },
  { id: 'bond_kelly_findings', statement: 'Mary Jane Kelly: most extensive injuries, killer had several uninterrupted hours, fire burned for light', knownBy: ['bond'], visibleFromAct: 0, topics: ['mary kelly', 'kelly', "miller's court", 'the fire'] },
  { id: 'bond_profile_anderson', statement: 'Wrote a formal psychological profile in November 1888 for Assistant Commissioner Anderson', knownBy: ['bond'], visibleFromAct: 0, topics: ['your profile', 'the profile', 'anderson'] },
  { id: 'bond_killer_assessment', statement: 'His assessment: killer works alone, operates at night, has anatomical knowledge but no professional medical qualification', knownBy: ['bond'], visibleFromAct: 0, topics: ['the killer', 'your assessment', 'what sort of man'] },
  { id: 'bond_assistant_catalogues', statement: "His assistant has transcribed and catalogued all post-mortem reports", knownBy: ['bond'], visibleFromAct: 0, topics: ['your assistant', 'the assistant', 'the post-mortem reports'] },
  { id: 'bond_evidence_only', statement: 'Committed to reporting only what evidence substantiates — will not speculate beyond the record', knownBy: ['bond'], visibleFromAct: 0, topics: ['speculation', 'what you will not say'] },

  // ── edmund ──────────────────────────────────────────────────────────────────
  { id: 'edmund_assistant_to_bond', statement: 'Medical assistant to Dr. Bond; present during post-mortem examinations', knownBy: ['edmund'], visibleFromAct: 0, topics: ['your work', 'the post-mortems', 'doctor bond'] },
  { id: 'edmund_left_training', statement: 'Studied medicine but left formal training unexpectedly before completion', knownBy: ['edmund'], visibleFromAct: 0, topics: ['your training', 'your studies', 'medicine'] },
  { id: 'edmund_well_regarded', statement: 'Quiet, polite, reserved — well-regarded by those who work with him', knownBy: ['edmund'], visibleFromAct: 0, topics: ['yourself'] },
  // The confrontation. Sealed until Act 6, where the ACT_PROGRESSION gate asks
  // for it by name: the player must put the subject of light to him directly.
  // Five acts of peripheral, unanswered remarks about lamps and gaslight are
  // what teach them to — the motif is the clue, and this is where it is spent.
  { id: 'edmund_eye_for_light', statement: 'Asked about light, he answers without evasion and without pride: he has always had an eye for it — which lamps were lit, which were out, how long a man\'s eyes take to adjust, how much can be done by a fire in a grate. He speaks of it as a small professional habit, and does not appear to understand what he has said', knownBy: ['edmund'], visibleFromAct: 6, topics: ['light', 'the lamps', 'the gaslight'] },
  // Edmund never discusses his own background — this is what the AI may NOT use

  // ── lusk ────────────────────────────────────────────────────────────────────
  { id: 'lusk_kidney_parcel', statement: 'Received the kidney parcel on 16 October 1888 — half a human kidney preserved in spirits of wine', knownBy: ['lusk'], visibleFromAct: 0, topics: ['the kidney', 'the parcel'] },
  { id: 'lusk_assumed_prank', statement: 'Initially assumed it was a prank by medical students; had it examined only after delay', knownBy: ['lusk'], visibleFromAct: 0, topics: ['what you first thought', 'the students'] },
  { id: 'lusk_openshaw_confirmed', statement: 'Dr. Openshaw confirmed the kidney was human tissue, female, approximately 45 years old, consistent with Bright\'s disease (matching Eddowes)', knownBy: ['lusk'], visibleFromAct: 0, topics: ['openshaw', 'the examination', 'what the doctor found'] },
  { id: 'lusk_letter_phrasing', statement: 'The letter\'s phrasing stays with him: "I send you half the Kidne I took from one women prasarved it for you tother piece I fried and ate it was very nise"', knownBy: ['lusk'], visibleFromAct: 0, topics: ['the letter', 'from hell', 'the wording'] },
  { id: 'lusk_founded_committee', statement: 'Founded the Whitechapel Vigilance Committee out of anger that the police were failing the neighbourhood', knownBy: ['lusk'], visibleFromAct: 0, topics: ['the committee', 'the vigilance committee'] },
  { id: 'lusk_nightly_patrols', statement: 'Conducts nightly patrols; lobbied the Home Secretary for a government reward (refused)', knownBy: ['lusk'], visibleFromAct: 0, topics: ['the patrols', 'the reward', 'the home secretary'] },
  { id: 'lusk_distrusts_machinery', statement: 'Distrusts the official investigation — not the men, but the machinery and inter-force politics', knownBy: ['lusk'], visibleFromAct: 0, topics: ['the police', 'the investigation'] },

  // ── diemschutz ──────────────────────────────────────────────────────────────
  { id: 'diemschutz_found_stride', statement: "Found Elizabeth Stride's body in Dutfield's Yard on the night of 30 September", knownBy: ['diemschutz'], visibleFromAct: 0, topics: ['the body', 'elizabeth stride', 'finding her'] },
  { id: 'diemschutz_interrupted_killer', statement: "His cart may have interrupted the killer mid-act — no mutilation followed the throat wound", knownBy: ['diemschutz'], visibleFromAct: 0, topics: ['the interruption', 'whether you disturbed him'] },
  { id: 'diemschutz_testimony_timeline', statement: 'Witnessed or heard sounds that night; testimony was crucial to reconstructing the killer\'s timeline', knownBy: ['diemschutz'], visibleFromAct: 0, topics: ['your testimony', 'the timing', 'what you heard'] },
  { id: 'diemschutz_horse_shied', statement: 'The horse shied — that was the first sign something was wrong', knownBy: ['diemschutz'], visibleFromAct: 0, topics: ['the horse', 'the pony'] },

  // ── hutchinson ──────────────────────────────────────────────────────────────
  { id: 'hutchinson_knew_kelly', statement: 'Knew Mary Jane Kelly for some three years; she sometimes borrowed small sums from him', knownBy: ['hutchinson'], visibleFromAct: 0, topics: ['mary kelly', 'kelly', 'how you knew her'] },
  { id: 'hutchinson_met_kelly_commercial', statement: 'Met Kelly on Commercial Street in the small hours of 9 November; she asked him for sixpence he did not have', knownBy: ['hutchinson'], visibleFromAct: 0, topics: ['commercial street', 'that night', 'the sixpence'] },
  { id: 'hutchinson_saw_stranger', statement: 'Saw her go with a man of about thirty-four — dark, of prosperous appearance, with an astrakhan-trimmed coat, a gold watch-chain, and a "foreign" or "Jewish" look', knownBy: ['hutchinson'], visibleFromAct: 0, topics: ['the man you saw', 'the stranger', 'the astrakhan coat'] },
  { id: 'hutchinson_over_detailed', statement: 'The detail of his description is extraordinary — tie-pin, spats, the parcel in the man\'s left hand — far more than a passing glance should yield', knownBy: ['hutchinson'], visibleFromAct: 0, topics: ['your description', 'the detail of your description', 'how you saw so much'] },
  { id: 'hutchinson_loitered_admission', statement: 'Admits he stood opposite Miller\'s Court for three-quarters of an hour afterward, waiting — he says — to see if the man came out', knownBy: ['hutchinson'], visibleFromAct: 0, topics: ['why you waited', 'the three quarters of an hour'] },
  { id: 'hutchinson_why_loitered', statement: 'He loitered because he knew Kelly and half-hoped she would let him shelter the night; he had nowhere to sleep', knownBy: ['hutchinson'], visibleFromAct: 0, topics: ['where you slept', 'your lodging'] },
  { id: 'hutchinson_no_medical_knowledge', statement: 'Has no medical knowledge of any kind; works with his hands', knownBy: ['hutchinson'], visibleFromAct: 0, topics: ['your trade', 'your hands'] },

  // ── phillips ────────────────────────────────────────────────────────────────
  // Historical accuracy: keep the positions un-swapped — Phillips = knowledge, Bond = no mastery.
  { id: 'phillips_chapman_postmortem', statement: 'Performed the post-mortem on Annie Chapman; was struck by the work — in his view it showed considerable anatomical knowledge', knownBy: ['phillips'], visibleFromAct: 0, topics: ['annie chapman', 'chapman', 'the post-mortem'] },
  { id: 'phillips_real_familiarity', statement: 'Maintains the organ removals indicate real familiarity with the position of the organs — a man who knew exactly where to cut and what he was taking', knownBy: ['phillips'], visibleFromAct: 0, topics: ['the anatomical knowledge', 'the removals', 'where to cut'] },
  { id: 'phillips_bond_dispute', statement: 'Dr. Bond disagrees: Bond holds the killer had no true surgical skill and no professional qualification — the dispute between them is genuine and unresolved', knownBy: ['phillips'], visibleFromAct: 0, topics: ['doctor bond', 'the disagreement'] },
  { id: 'phillips_watched_not_qualified', statement: 'Both positions can be true at once: real anatomical knowledge without formal training — the knowledge of a man who has watched and studied, not one who qualified', knownBy: ['phillips'], visibleFromAct: 0, topics: ['a man who watched', 'the training', 'whether he qualified'] },
  { id: 'phillips_knowledge_not_rare', statement: 'Anatomical knowledge is not rare in Whitechapel — medical students, mortuary men, slaughtermen, hospital dressers all possess some measure of it', knownBy: ['phillips'], visibleFromAct: 0, topics: ['who else would know', 'the slaughtermen', 'the medical students'] },

  // ── tumblety ────────────────────────────────────────────────────────────────
  // Documented facts only — his guilt is FALSE; the envelope must let the AI play him loud without confirming anything.
  { id: 'tumblety_patent_remedies', statement: 'An American who styles himself a doctor; made a fortune selling patent remedies — no formal medical qualification', knownBy: ['tumblety'], visibleFromAct: 0, topics: ['your practice', 'your remedies', 'your qualifications'] },
  { id: 'tumblety_arrested_7_nov', statement: 'Arrested 7 November 1888 on charges of gross indecency; held while the police consider him for the murders', knownBy: ['tumblety'], visibleFromAct: 0, topics: ['your arrest', 'the charges', 'why you are held'] },
  { id: 'tumblety_specimen_collection', statement: 'Keeps a collection of anatomical specimens in jars — and has boasted of possessing a collection of uteri', knownBy: ['tumblety'], visibleFromAct: 0, topics: ['your collection', 'the specimens', 'the jars'] },
  { id: 'tumblety_contempt_women', statement: 'Speaks of women, and of a failed marriage, with open contempt', knownBy: ['tumblety'], visibleFromAct: 0, topics: ['women', 'your marriage'] },
  { id: 'tumblety_showman_anatomy', statement: 'His anatomical knowledge is a showman\'s — names and flourish, not practice; his specimens are purchased curios, crudely kept', knownBy: ['tumblety'], visibleFromAct: 0, topics: ['your anatomy', 'your knowledge'] },
  { id: 'tumblety_unaccounted_nights', statement: 'Was in London through the autumn; cannot or will not account precisely for his nights', knownBy: ['tumblety'], visibleFromAct: 0, topics: ['your nights', 'where you were', 'the autumn'] },
  { id: 'tumblety_theatrical_denial', statement: 'Denies the murders with theatrical indignation — and visibly enjoys being asked', knownBy: ['tumblety'], visibleFromAct: 0, topics: ['the murders', 'the accusation'] },

  // ── pizer ───────────────────────────────────────────────────────────────────
  { id: 'pizer_bootmaker', statement: 'A bootmaker by trade; the leather apron the press made infamous is an ordinary tool of his work', knownBy: ['pizer'], visibleFromAct: 0, topics: ['your trade', 'the leather apron'] },
  { id: 'pizer_arrested_panic', statement: 'Arrested on 10 September on the strength of the "Leather Apron" panic; the mob outside nearly had him before the police did', knownBy: ['pizer'], visibleFromAct: 0, topics: ['your arrest', 'the mob'] },
  { id: 'pizer_fully_alibied', statement: 'Fully alibied for the nights in question — for one murder he was watching the dock fire with a constable; for another he was in a lodging house with witnesses', knownBy: ['pizer'], visibleFromAct: 0, topics: ['your alibi', 'where you were', 'the dock fire'] },
  { id: 'pizer_released_compensated', statement: 'Released without charge; one newspaper later paid him compensation for what it had printed', knownBy: ['pizer'], visibleFromAct: 0, topics: ['your release', 'the compensation', 'the newspaper'] },
  { id: 'pizer_panic_manufactured', statement: 'The panic was manufactured — a name the papers conjured and the neighbourhood learned to hate', knownBy: ['pizer'], visibleFromAct: 0, topics: ['the panic', 'the papers', 'the name they gave you'] },
  { id: 'pizer_community_fears_mob', statement: 'Still cannot walk some streets; the community fears the mob as much as the murderer', knownBy: ['pizer'], visibleFromAct: 0, topics: ['the neighbourhood', 'the streets', 'how you live now'] },

  // ── superintendent ──────────────────────────────────────────────────────────
  { id: 'superintendent_manages_asylum', statement: 'Manages a private asylum for those whose families wish discretion', knownBy: ['superintendent'], visibleFromAct: 0, topics: ['the asylum', 'this place'] },
  { id: 'superintendent_patient_mid_november', statement: 'A patient matching the name Watson inquires about has been here since mid-November 1888', knownBy: ['superintendent'], visibleFromAct: 0, topics: ['the patient', 'when he came'] },
  { id: 'superintendent_quiet_arrangement', statement: 'The family arrangement was made quietly and quickly', knownBy: ['superintendent'], visibleFromAct: 0, topics: ['the arrangement', 'the family'] },
  { id: 'superintendent_minimal_disclosure', statement: 'Speaks minimally about patients; will not volunteer information beyond what professional courtesy requires', knownBy: ['superintendent'], visibleFromAct: 0, topics: ['your discretion', 'what you may say'] },
  { id: 'superintendent_humane_confinement', statement: 'Believes private confinement is a humane solution for certain situations', knownBy: ['superintendent'], visibleFromAct: 0, topics: ['confinement', 'your views'] },
];

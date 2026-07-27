import type { NPCDefinition } from '../types';

const NPCS_DATA = {
  holmes: {
    id: 'holmes',
    displayName: 'Sherlock Holmes',
    alias: 'Sherlock Holmes',
    requiresIntroduction: false,
    role: 'Consulting Detective',
    description: 'Holmes investigates the Whitechapel murders unofficially, approaching the Ripper case as an intellectual problem. He follows Watson everywhere.',
    speakingStyle: 'Precise and controlled. Short observations and carefully constructed deductions. Occasionally acknowledges error without sentiment.',
    personality: ['Analytical', 'Calm under pressure', 'Intensely curious', 'Occasionally aloof', 'Privately disturbed by this case'],
    followingRule: 'follows_watson',
    followsNpcId: 'watson',
    scheduleByAct: {
      0: { default: 'baker_street' },
      1: { default: 'dorset_street' },
      2: { default: 'whitechapel_mortuary' },
      3: { default: 'dutfields_yard' },
      4: { default: 'lusk_office' },
      5: { default: 'bond_office' },
      6: { default: 'private_asylum' },
    },
    // The moving-spotlight capstones — act- and flag-gated directorial beats.
    scriptedLines: [
      {
        locationId: 'h_division_station',
        act: 2,
        triggerFlag: 'asked_tumblety_about_tumblety_theatrical_denial',
        instruction: 'Holmes, having observed the American in his cell, delivers his first crack in the Mad Doctor theory — quietly, to Watson: the man is everything London wishes the murderer to be — loud, foreign, mad — but the hand that did this work was quiet, patient, and practised. This man is a performance. Holmes does not raise his voice.',
      },
      {
        locationId: 'goulston_street',
        act: 3,
        triggerFlag: 'examined_goulston_street',
        instruction: 'Holmes, before the scrubbed wall where the graffiti was erased, dismantles the Foreigner theory: they wiped the wall to keep the peace, and so confessed what they truly feared — not the murderer, but the mob. The hand that wrote there had nothing to do with the hand that killed. London hunts the man it wishes to hate; but their man is not hated — he is not even noticed.',
      },
      {
        locationId: 'lusk_office',
        act: 4,
        triggerFlag: 'asked_abberline_about_abberline_barrister_file',
        instruction: 'Holmes, weighing the fled American and the vanished gentleman, observes that two men have obligingly removed themselves from view, and the public will pick whichever culprit it prefers. But the hand that preserved that kidney did not flee and did not vanish — it is still here, keeping its specimens, exactly as it always has.',
      },
      {
        // Proactive Act 5 nudge — fires unconditionally at Bond's office so a
        // player who never attempts a comparison still learns the convergence
        // wants a desk at Baker Street. Stops firing once Act 5 closes.
        locationId: 'bond_office',
        act: 5,
        instruction: 'If Watson lingers or seems unsure, Holmes remarks — without looking up from whatever occupies him — that they have papers enough now; what the papers want is a desk, good light, and the casefiles at Baker Street. He says nothing about what the comparison will show. One sentence or two, dropped naturally; do not repeat it if already conveyed this scene.',
      },
      {
        locationId: 'baker_street',
        act: 5,
        triggerFlag: 'used_edmund_forensic_note_with_from_hell_letter',
        instruction: 'The convergence is made — the documents lie side by side on the desk and the casefiles wall has given up its answer. Holmes is certain, and grim with it: "We know the man, Watson. Knowing him and proving him are not the same act — and proving him and stopping him may prove a third thing entirely." He is already reaching for his coat.',
      },
    ],
    idleBeats: [
      // 221B props — only fire at Baker Street (Holmes follows Watson everywhere,
      // so unscoped these would put the violin in the mortuary). The case-map
      // beat was retired with the wall itself (Act 0 rework); its replacement
      // is prop-neutral and works in every act the room appears in.
      { locationId: 'baker_street', text: 'Holmes draws a single long note from the violin, then sets it down unfinished' },
      { locationId: 'baker_street', text: 'Holmes takes a book down from the shelf, reads half a page standing up, and puts it back in the wrong place' },
      { locationId: 'baker_street', text: 'Holmes stands at the window with his hands behind his back, perfectly still' },
      { locationId: 'baker_street', text: 'Holmes leafs through his index of criminal records, not appearing to read it' },
      // Portable — pocket props and habits that travel with him.
      { text: 'Holmes turns his lens over in his fingers without raising it to anything' },
      { text: 'Holmes fills his pipe from his pouch with great care, then does not light it' },
      { text: 'Holmes closes his eyes for the space of three breaths — cataloguing, not resting' },
    ],
  },

  // ── CHRONOLOGICAL REWORK: Act 0, the Bank Holiday ─────────────────────────
  // The caller Holmes turns away. She is onstage for Act 0 only and offstage
  // every act after — an NPC with no scheduleByAct entry for an act is offstage
  // by construction, so her disappearance needs no mechanic. She stays in the
  // room for the whole act after the refusal, which reads correctly: she
  // lingers, and then the act ends and she is gone.
  //
  // Her sister Nell is NEVER found, never named again, and never confirmed
  // connected to anything. No clue points at her; no later act resolves her.
  // She is not Martha Tabram and the game must never imply she is.
  mrs_kemp: {
    id: 'mrs_kemp',
    displayName: 'Mrs. Kemp',
    alias: 'Mrs. Kemp',
    requiresIntroduction: false, // she gave her name at the door
    // Reaches the prompt as "speaking with: Mrs. Kemp (<role>)". The clothing
    // is here rather than in `description` because the model was repeatedly
    // defaulting her to an apron and to tidying the room, which reads as the
    // housekeeper and undercuts a woman who has dressed to be taken seriously.
    role: 'A caller from Bethnal Green, in her visiting best and gloves — a guest in this room, never a servant of it, and never in an apron',
    // NOTE: `description` is authoring metadata and is NOT sent to the AI (only
    // role, speakingStyle, personality and the fact envelope are). Anything the
    // narration must obey belongs in `role` or `personality`, not here.
    description: 'A woman of perhaps forty-five who has come across London on an omnibus to ask a favour she does not expect to be granted. Her sister Ellen, called Nell, has not been seen in nine days. She is plain and tired and entirely without self-pity. She states her business, answers what she is asked, and does not plead.',
    speakingStyle: 'Plain and unhurried. Answers the question put to her and stops. She does not embroider and she does not weep, and if she is conscious of taking up the gentlemen\'s evening she does not apologise for it.',
    personality: ['Plain-spoken', 'Tired', 'Not pitiable', 'Expects to be dismissed', 'Certain about her sister'],
    followingRule: 'fixed',
    scheduleByAct: {
      0: { default: 'baker_street' },
    },
    idleBeats: [
      { text: 'Mrs. Kemp sits forward on the edge of the chair, as though she has not been asked to sit in it' },
      { text: 'Mrs. Kemp turns her gloves over in her lap, once, and then leaves them alone' },
      { text: 'Mrs. Kemp glances at the open window and the noise coming up from the street, and says nothing about it' },
    ],
  },

  abberline: {
    id: 'abberline',
    displayName: 'Inspector Abberline',
    alias: 'a police inspector',
    aliasDescription: 'A man in plain clothes — not a uniform — with the posture of authority and the eyes of someone who has not slept properly in months.',
    requiresIntroduction: true,
    role: 'Scotland Yard Detective Inspector',
    description: 'Lead investigator for Scotland Yard. Experienced, honest, and deeply fatigued by the lack of progress. Refers to Mary Kelly as "Mary" when he forgets himself.',
    speakingStyle: 'Direct and conversational. Practical rather than theoretical. Occasionally lets something personal slip through.',
    personality: ['Practical', 'Honest', 'Determined', 'Fatigued', 'Privately broken by this case'],
    followingRule: 'location_based',
    scheduleByAct: {
      // No act-0 entry: Act 0 is the Bank Holiday evening at Baker Street, and
      // nobody but Holmes and the caller is onstage (chronological rework).
      // A policeman's day ends at the pub across from the station.
      1: { default: 'dorset_street' },
      2: { default: 'h_division_station', byPeriod: { evening: 'whitechapel_pub' } },
      3: { default: 'working_mens_club' },
      4: { default: 'lusk_office' },
      5: { default: 'bond_office' },
      6: { default: 'private_asylum' },
    },
    scriptedLines: [
      {
        locationId: 'lusk_office',
        act: 4,
        instruction: 'Abberline brings the day\'s news, weary and flat: the American, Tumblety, has jumped his bail and fled the country — France, they think, and on to America. The public will call that a confession; Abberline is not so sure — a man may flee an indecency charge without being a murderer. And there is the other file: the vanished barrister, a gentleman of good family, erratic, dismissed, not to be found. "A family of standing does not let a son hang, Doctor. They make the embarrassment disappear." He says it of the barrister, without weight.',
      },
    ],
    // Alias-safe ("the inspector") — beats can fire before his introduction.
    idleBeats: [
      { text: 'The inspector thumbs back through his pocket-book, stops at a page, and reads it as though it might have changed' },
      { text: 'The inspector rubs his eyes with thumb and forefinger, then squares his shoulders and continues' },
      { text: 'The inspector unfolds a map of the district, stands a moment over it saying nothing, then folds it away' },
    ],
  },

  bond: {
    id: 'bond',
    displayName: 'Dr. Thomas Bond',
    alias: 'a police surgeon',
    aliasDescription: 'A composed man in late middle age — the kind who has learned to carry what he has seen without letting it show on his face.',
    requiresIntroduction: true,
    role: 'Police Surgeon',
    description: 'Responsible for examining all five victims. Clinical, professional, and rarely speculates beyond medical facts. His assistant is always nearby.',
    speakingStyle: 'Technical and precise. Medical terminology. Does not volunteer information beyond what the evidence substantiates.',
    personality: ['Clinical', 'Professional', 'Reserved', 'Thorough'],
    followingRule: 'location_based',
    scheduleByAct: {
      // No act-0 entry (chronological rework — see mrs_kemp).
      // Acts 1-3: Bond is at the mortuary — his proper domain
      1: { default: 'millers_court' },
      // The mortuary keeps visiting hours; evenings he retreats to his office.
      2: { default: 'whitechapel_mortuary', byPeriod: { evening: 'bond_office', night: 'bond_office', lateNight: 'bond_office' } },
      3: { default: 'whitechapel_mortuary', byPeriod: { evening: 'bond_office', night: 'bond_office', lateNight: 'bond_office' } },
      // Acts 4-6: Bond is at his office or following the investigation
      4: { default: 'lusk_office' },
      5: { default: 'bond_office' },
      6: { default: 'bond_office' },
    },
    scriptedLines: [
      {
        locationId: 'millers_court',
        act: 1,
        // The Act 1 emotional capstone — fires once Watson has faced the bed.
        triggerFlag: 'examined_millers_court_the_bed',
        instruction: 'The aftermath beat: Bond, who has had to catalogue every one of these women, allows himself one human moment — weary, restrained, unforgettable. The surgeon\'s burden: he does not break, but Watson sees what carrying this has cost him. And beside him his assistant continues cataloguing, untouched — calm, even faintly absorbed. The contrast is left entirely without comment.',
      },
      {
        locationId: 'whitechapel_mortuary',
        act: 2,
        // The ambient Halward-family seed — fires after the bonds_desk examine.
        triggerFlag: 'examined_whitechapel_mortuary_bonds_desk',
        instruction: 'In the flow of the mortuary work, Bond mentions his assistant in passing — the way one mentions any colleague\'s man: a physician\'s son, meticulous, some trouble at home behind him that Bond never pressed; he would trust the young man with anything. No name. No weight. Conversational texture only — this must NOT read as suspicion or as a pointed aside.',
      },
      {
        locationId: 'bond_office',
        act: 6,
        // "He's gone." Bond's devastation on the Act 6 arrival.
        instruction: 'Bond is ashen. His assistant is gone — taken at dawn. The family came with a private physician, had the young man declared of unsound mind, and committed him to a private asylum before any charge could be laid. Bond vouched for him for years; the man stood at his elbow through every post-mortem. His horror is quiet and his self-reproach absolute. He gives Watson the asylum\'s name without being asked twice.',
      },
    ],
    // Alias-safe ("the surgeon") — beats can fire before his introduction.
    idleBeats: [
      // Mortuary props — instrument rack and specimen cabinet live there.
      { locationId: 'whitechapel_mortuary', text: 'The surgeon cleans an instrument that is already clean, sets it in its place, takes up the next' },
      { locationId: 'whitechapel_mortuary', text: 'The surgeon checks a label on a specimen jar against his ledger, makes a small tick' },
      // Portable.
      { text: 'The surgeon writes steadily in his report book, pausing only to date the page' },
      { text: 'The surgeon draws out his watch, notes the hour against something in his papers, and returns it without comment' },
    ],
  },

  edmund: {
    id: 'edmund',
    displayName: 'Edmund Halward',
    // Edmund is never introduced by Holmes. Never self-introduces.
    // His name is revealed only when Watson finds the forensic note in Act 5.
    alias: "Bond's assistant",
    aliasDescription: 'A quiet young man, perhaps thirty, standing near Dr. Bond with a small leather notebook. He does not look up.',
    requiresIntroduction: true,
    // Edmund never self-introduces — his name is revealed when the player
    // examines his forensic note (the 'prasarved' document).
    introduction: { type: 'document', objectId: 'edmund_forensic_note' },
    role: "Dr. Bond's Medical Assistant",
    description: 'Young, quiet, and outwardly respectable. Son of a physician. Studied medicine but left unexpectedly. Almost invisible. Never speaks unless directly addressed. His ordinariness is not accidental.',
    speakingStyle: 'Soft and measured. Avoids emotional language. Mundane and functional. Never asks questions. Never volunteers curiosity.',
    personality: ['Quiet', 'Polite', 'Reserved', 'Observant', 'Utterly without visible anxiety'],
    followingRule: 'follows_bond',
    followsNpcId: 'bond',
    // Edmund is committed to the asylum in Act 6 — he stops following Bond and
    // remains at his canonical location (the asylum) from then on.
    followsUntilAct: 5,
    scheduleByAct: {
      // Edmund follows Bond. Where Bond is not present at reconstruction
      // locations (Acts 2-3), Edmund is also absent. No act-0 entry
      // (chronological rework — see mrs_kemp).
      1: { default: 'millers_court' },
      2: { default: 'whitechapel_mortuary' },
      3: { default: 'whitechapel_mortuary' },
      4: { default: 'lusk_office' },
      5: { default: 'bond_office' },
      6: { default: 'private_asylum' },
    },
    // Scripted presence moments — dramatic irony. Innocent on the surface, wrong in retrospect.
    // Edmund never explains himself. The AI works these in when contextually appropriate.
    scriptedLines: [
      {
        locationId: 'millers_court',
        // Fires after player examines burned_clothing — the per-object flag the engine sets.
        // RECESSION RULE: flat, professional, easily missed. No narrator emphasis,
        // no lingering — sinister only on a second playthrough.
        triggerFlag: 'examined_millers_court_burned_clothing',
        instruction: "Bond's assistant glances at the remnants in the grate and remarks, in passing and without being asked, that whoever lit the clothing understood how long it would burn. The tone is professional and entirely unremarkable — the observation of a competent assistant. He returns to his notes. Give this no emphasis whatsoever; it should pass as scene texture.",
      },
      {
        locationId: 'whitechapel_mortuary',
        instruction: "When Watson moves toward the autopsy ledger, Bond's assistant steps forward and opens it to the correct page before Bond has time to respond — as though he knows precisely which entry Watson will want to examine. The gesture is efficient. Unremarkable. He steps back.",
      },
      {
        locationId: 'bond_office',
        instruction: "When Watson directs a question at Dr. Bond, Bond's assistant answers from across the room before Bond responds — a quiet completion of Bond's thought. He does not look up from his desk. The answer is precise and correct. Bond does not seem surprised.",
      },
      {
        locationId: 'private_asylum',
        // The confrontation. Edmund is the one who speaks. He doesn't understand what he reveals.
        instruction: "Edmund stands at the window. When spoken to, he describes Miller's Court — the quality of lamplight through a small window at a specific hour of the morning. He speaks as an aesthete describes a painting. When Holmes asks how he knows what the light looked like at that hour, Edmund pauses for exactly one breath, then says: 'I have always had an eye for light.' He returns to his chair. He says nothing further. He does not appear distressed.",
      },
    ],
    // RECESSION RULE: idle beats must be the dullest in the game — pure
    // clerical texture, no narrator weight, nothing the eye would catch.
    // Unscoped is safe: at the Act 6 asylum (where clerical work would
    // contradict his committed-patient staging) his unconditional scripted
    // line above always fires, and scripted moments suppress idle beats.
    idleBeats: [
      { text: "Bond's assistant continues his cataloguing, pen moving at an even pace" },
      { text: "Bond's assistant blots a line dry and turns the page" },
      { text: "Bond's assistant straightens a stack of papers so the edges align" },
    ],
  },

  lusk: {
    id: 'lusk',
    displayName: 'George Lusk',
    alias: 'George Lusk',
    requiresIntroduction: false,
    role: 'Chairman, Whitechapel Vigilance Committee',
    description: 'Recipient of the From Hell letter and the kidney parcel. Cautious and skeptical of hoaxes. Founding anger at the failure of the official machinery.',
    speakingStyle: 'Concerned but practical. A builder by trade — plain language, no flourishes.',
    personality: ['Cautious', 'Uneasy about publicity', 'Skeptical', 'Genuinely angry at the police failure'],
    followingRule: 'fixed',
    // Lusk's office is not reachable until Act 4; he is offstage before then.
    scheduleByAct: {
      4: { default: 'lusk_office' },
      5: { default: 'lusk_office' },
      6: { default: 'lusk_office' },
    },
    idleBeats: [
      { text: "Lusk squares the committee's correspondence into a single neat pile, as though order might answer it" },
      { text: 'Lusk works a stub of pencil between his fingers like a man who misses having a proper tool in his hand' },
      { text: 'Lusk glances toward the window at the sound of boots in the street, and does not settle until they pass' },
    ],
  },

  diemschutz: {
    id: 'diemschutz',
    displayName: 'Louis Diemschutz',
    alias: 'the club steward',
    aliasDescription: 'A man with the look of someone who has replayed a single night in his mind too many times.',
    requiresIntroduction: true,
    role: "Steward, International Working Men's Club",
    description: "Discovered Elizabeth Stride's body. Distressed witness who has told his story to the police a dozen times and is not sure it has helped.",
    speakingStyle: 'Shaken and direct. Practical details — what he saw, heard, smelled. Will not speculate.',
    personality: ['Distressed', 'Cooperative', 'Precise about what he knows and does not know'],
    followingRule: 'fixed',
    scheduleByAct: {
      0: { default: 'working_mens_club' },
      1: { default: 'working_mens_club' },
      2: { default: 'working_mens_club' },
      3: { default: 'working_mens_club' },
      4: { default: 'working_mens_club' },
      5: { default: 'working_mens_club' },
      6: { default: 'working_mens_club' },
    },
    // Alias-safe ("the steward") — beats can fire before his introduction.
    idleBeats: [
      { text: 'The steward wipes the same stretch of counter a second time, his mind plainly elsewhere' },
      { text: 'The steward pauses in his work at the sound of a cart in the street — only a moment — then continues' },
      { text: "The steward counts the club's takings in small exact stacks, and then counts them again" },
    ],
  },

  // ── REWEAVE: the loud suspects and the second medical voice ────────────────

  hutchinson: {
    id: 'hutchinson',
    displayName: 'George Hutchinson',
    alias: 'a lingering labourer',
    aliasDescription: 'A working man lingering at the edge of the crowd outside the court, watching with an attention that outlasts ordinary curiosity.',
    requiresIntroduction: true, // a stranger in the crowd until he comes forward and gives his name
    role: 'Labourer; witness — knew Mary Jane Kelly',
    description: 'A labourer who knew Kelly and saw her with a well-dressed stranger hours before her death. His account is extraordinarily detailed — suspiciously so — and he admits he loitered outside the court that night. A lonely, sad man, not a killer; but the player should wonder.',
    speakingStyle: 'Eager and over-precise. Volunteers detail nobody asked for. Defensive when his own movements come up.',
    personality: ['Eager to help', 'Over-detailed', 'Lonely', 'Defensive about his loitering', 'Genuinely grieved for Kelly'],
    followingRule: 'location_based',
    scheduleByAct: {
      1: { default: 'dorset_street' },     // in the crowd outside the court, the morning after
      2: { default: 'whitechapel_pub' },   // lingers at the Ten Bells thereafter
      3: { default: 'whitechapel_pub' },
    },
    // Alias-safe ("the labourer") — beats can fire before he gives his name.
    idleBeats: [
      { text: 'The labourer edges half a step closer to whatever conversation is nearest, ready to be asked' },
      { text: 'The labourer tells a neighbour some small story with far more particulars than it needs' },
      { text: 'The labourer turns his cap in his hands, watching the street as though he expects to be wanted' },
    ],
  },

  phillips: {
    id: 'phillips',
    displayName: 'Dr. George Bagster Phillips',
    alias: 'Dr. Phillips',
    requiresIntroduction: false, // a known H-Division figure, introduced by Bond on sight
    role: 'H Division Police Surgeon',
    description: "The H Division divisional surgeon who performed the Chapman post-mortem. The second medical voice — he and Bond disagree about the killer's skill, and between them the 'trained surgeon' assumption collapses.",
    speakingStyle: 'Senior, deliberate, a little formal. Comfortable disagreeing with a colleague without rancour.',
    personality: ['Experienced', 'Deliberate', 'Professionally stubborn', 'Respects Bond while disputing him'],
    followingRule: 'location_based',
    scheduleByAct: {
      // Day-shift police surgeon; evenings find him at the Ten Bells like
      // any other H Division man off duty.
      2: { default: 'whitechapel_mortuary', byPeriod: { evening: 'whitechapel_pub', night: 'whitechapel_pub', lateNight: 'whitechapel_pub' } },
      3: { default: 'whitechapel_mortuary' },
    },
    idleBeats: [
      { text: 'Dr. Phillips polishes his spectacles with great deliberation, in no hurry to be finished' },
      { text: 'Dr. Phillips consults his own memorandum-book, unhurried, as though the hour would wait for him' },
    ],
  },

  tumblety: {
    id: 'tumblety',
    displayName: 'Francis Tumblety',
    alias: 'Francis Tumblety',
    requiresIntroduction: false, // notorious — known by reputation before Watson meets him
    role: 'American "doctor" — in police custody',
    description: 'The Mad Doctor: an American quack of theatrical self-importance, arrested 7 November on gross-indecency charges, whom some at the Yard fancy for the murders. He collects anatomical specimens — including uteri — and despises women. He fits gloriously. He is a performance. (He flees the country in Act 4.)',
    speakingStyle: 'Flamboyant, self-aggrandising, contemptuous. Treats the interview as a stage. Boasts even when boasting incriminates him.',
    personality: ['Theatrical', 'Vain', 'Misogynist', 'Self-promoting', 'Enjoys the suspicion — it flatters him'],
    followingRule: 'location_based',
    scheduleByAct: {
      // In custody acts 2–3; FLED from act 4 on (absent — no entries).
      2: { default: 'h_division_station' },
      3: { default: 'h_division_station' },
    },
    idleBeats: [
      { text: 'Tumblety grooms his enormous moustache as though a portraitist were expected at any moment' },
      { text: 'Tumblety declaims some remark to no one in particular, pitched to carry across the room' },
      { text: 'Tumblety inspects his cuffs and finds them, as ever, magnificent' },
    ],
  },

  pizer: {
    id: 'pizer',
    displayName: 'John Pizer',
    alias: 'John Pizer',
    requiresIntroduction: false, // infamous against his will — "Leather Apron"
    role: 'Bootmaker — the man the press called "Leather Apron"',
    description: 'A Jewish bootmaker arrested in September on the strength of a press panic, fully alibied, and released — and still living under the shadow of the accusation. The Foreigner theory made human: a frightened, wronged man.',
    speakingStyle: 'Quiet, wary, worn down. Answers carefully — he has learned what careless words cost. Flashes of bitterness at the newspapers.',
    personality: ['Frightened', 'Wronged', 'Careful', 'Bitter at the press', 'Grateful to anyone who treats him as a man'],
    followingRule: 'location_based',
    scheduleByAct: {
      3: { default: 'working_mens_club' }, // sheltering among the club's community during the reconstruction
    },
    idleBeats: [
      { text: 'Pizer keeps his hands in plain sight on the table, deliberately, like a man long practised at seeming harmless' },
      { text: 'Pizer flinches when someone laughs too loudly, then pretends he did not' },
      { text: 'Pizer folds a newspaper away face-down without finishing it' },
    ],
  },

  barmaid: {
    id: 'barmaid',
    displayName: 'The Barmaid',
    alias: 'The Barmaid',
    requiresIntroduction: false, // no hidden identity to learn — she is simply "the barmaid"
    role: 'Barmaid, the Ten Bells',
    description: 'Perhaps forty, with the particular efficiency of someone who has learned not to waste motion. She knew several of the murdered women personally, back when they were regulars — she does not name them and does not need to. Not a witness to anything, not a source of facts about the case; just someone who has watched the regulars disappear, one by one, and kept pouring drinks regardless.',
    speakingStyle: 'Economical. Volunteers a fragment unprompted, then goes quiet rather than explain it. Never gossips at length; never speculates about the killer.',
    personality: ['Efficient', 'Guarded warmth', 'Quietly grieving', "Doesn't waste words"],
    followingRule: 'location_based',
    scheduleByAct: {
      2: { default: 'whitechapel_pub' },
      3: { default: 'whitechapel_pub' },
    },
    idleBeats: [
      { text: 'The barmaid moves down the bar without being asked, refilling glasses by habit rather than request' },
      { text: 'The barmaid glances toward the door each time it opens, then returns to her work without a word' },
    ],
  },

  superintendent: {
    id: 'superintendent',
    displayName: 'Asylum Superintendent',
    alias: 'the superintendent',
    aliasDescription: 'A careful man — the kind who has built a career on professional discretion.',
    requiresIntroduction: true,
    role: 'Superintendent of the Private Asylum',
    description: 'Manages a private asylum for those whose families require discretion. Professional but guarded. Believes what he does is humane.',
    speakingStyle: 'Measured and diplomatic. Answers the question asked. No more.',
    personality: ['Professional', 'Guarded', 'Believes in the privacy of suffering'],
    followingRule: 'fixed',
    scheduleByAct: {
      0: { default: 'private_asylum' },
      1: { default: 'private_asylum' },
      2: { default: 'private_asylum' },
      3: { default: 'private_asylum' },
      4: { default: 'private_asylum' },
      5: { default: 'private_asylum' },
      6: { default: 'private_asylum' },
    },
    // Alias-safe ("the superintendent") — matches his pre-introduction alias.
    idleBeats: [
      { text: 'The superintendent aligns the blotter and inkstand on his desk to a precision that admits no disorder' },
      { text: 'The superintendent consults his watch against the corridor clock, and finds both correct' },
      { text: "The superintendent watches Watson's glance travel round the room, and lets it" },
    ],
  },
} satisfies Record<string, NPCDefinition>;

/** Every authored NPC id — the keys of the data table, kept alive by `satisfies`. */
export type NpcId = keyof typeof NPCS_DATA;

// Re-exported under the original wide type so consumers keep string-keyed access.
// NOTE: this table's own flag values (scriptedLines triggerFlag) are not
// compile-checked against StoryFlag — the union derives from these keys, which
// makes a `satisfies` check circular, and `satisfies` widens the literals
// anyway. qa:validate covers them at the QA layer (flag-grammar reachability).
export const NPCS: Record<string, NPCDefinition> = NPCS_DATA;

export const NPC_DISPLAY_NAMES: Record<string, string> = {
  holmes: 'Sherlock Holmes',
  abberline: 'Inspector Abberline',
  bond: 'Dr. Thomas Bond',
  edmund: 'Edmund Halward',
  lusk: 'George Lusk',
  diemschutz: 'Louis Diemschutz',
  mrs_kemp: 'Mrs. Kemp',
  superintendent: 'Asylum Superintendent',
  hutchinson: 'George Hutchinson',
  phillips: 'Dr. George Bagster Phillips',
  tumblety: 'Francis Tumblety',
  pizer: 'John Pizer',
  barmaid: 'The Barmaid',
};

// Alias names used before introduction — keyed by NPC ID
export const NPC_ALIASES: Record<string, string> = {
  abberline: 'a police inspector',
  bond: 'a police surgeon',
  edmund: "Bond's assistant",
  diemschutz: 'the club steward',
  superintendent: 'the superintendent',
};

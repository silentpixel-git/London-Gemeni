import type { NPCDefinition } from '../types';

export const NPCS: Record<string, NPCDefinition> = {
  holmes: {
    id: 'holmes',
    displayName: 'Sherlock Holmes',
    alias: 'Sherlock Holmes',
    requiresIntroduction: false,
    role: 'Consulting Detective',
    description: 'Holmes investigates the Whitechapel murders unofficially, approaching the Ripper case as an intellectual problem. He follows Watson everywhere.',
    speakingStyle: 'Precise and controlled. Short observations and carefully constructed deductions. Occasionally acknowledges error without sentiment.',
    personality: ['Analytical', 'Calm under pressure', 'Intensely curious', 'Occasionally aloof', 'Privately disturbed by this case'],
    publicKnowledge: [
      'Visited all five crime scenes and conducted independent forensic analysis',
      'The killer appeared non-threatening to victims — respectable-looking or known to them',
      'Anatomical removals required knowledge of organ location, not surgical mastery — the knowledge of a student',
      'Not panicked by Stride\'s interruption — completed a second murder same night within 45 minutes',
      'The "prasarved" spelling in the From Hell letter is a specific cognitive habit, matching other documents',
      'The killer has legitimate professional access to crime scenes and forensic records',
      'Murders stopped after Kelly — suggests capture, death, confinement, or removal from London',
      // Holmes briefly entertains a wrong theory at the Working Men\'s Club (Act 3)
      'Briefly considered a dock-worker connection at the Working Men\'s Club — abandoned by Act 4 as unsupported',
    ],
    followingRule: 'follows_watson',
    followsNpcId: 'watson',
    canonicalLocationByAct: {
      0: 'baker_street',
      1: 'dorset_street',
      2: 'whitechapel_mortuary',
      3: 'dutfields_yard',
      4: 'goulston_street',
      5: 'bond_office',
      6: 'private_asylum',
    },
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
      'Has been under political pressure to investigate dock workers and the foreign community — resists it but cannot ignore it entirely',
      // Historical accuracy: Bond explicitly concluded the killer lacked formal medical training.
      // Abberline MUST NOT assert medical skill as investigative consensus — he reflects the dispute.
      'Dr. Bond\'s formal assessment is that the killer had some rough anatomical knowledge but NO surgical training or professional medical qualification — Bond was explicit on this point and disagreed with other surgeons who suggested otherwise. Abberline respects Bond\'s conclusion and presents it as the official medical position, not as one view among many.',
      // Bond alibi — exonerates him as a suspect if Watson asks the right questions.
      'Dr. Thomas Bond\'s movements on the nights of the Stride and Eddowes murders (30 September) were fully accounted for — he was presenting a paper at a medical society dinner in the City and was seen by colleagues throughout the evening. He was called to the Eddowes scene after the fact. Abberline confirmed this personally.',
    ],
    followingRule: 'location_based',
    canonicalLocationByAct: {
      0: 'h_division_station',
      1: 'dorset_street',
      2: 'h_division_station',
      3: 'working_mens_club',
      4: 'goulston_street',
      5: 'bond_office',
      6: 'private_asylum',
    },
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
    publicKnowledge: [
      'Annie Chapman: uterus removed cleanly, incision shows familiarity with abdominal anatomy but not surgical mastery',
      'Catherine Eddowes: left kidney and uterus removed within minutes, efficiency consistent with prior practice',
      'Mary Jane Kelly: most extensive injuries, killer had several uninterrupted hours, fire burned for light',
      'Wrote a formal psychological profile in November 1888 for Assistant Commissioner Anderson',
      'His assessment: killer works alone, operates at night, has anatomical knowledge but no professional medical qualification',
      "His assistant has transcribed and catalogued all post-mortem reports",
      'Committed to reporting only what evidence substantiates — will not speculate beyond the record',
    ],
    followingRule: 'location_based',
    canonicalLocationByAct: {
      // Acts 0-3: Bond is at the mortuary — his proper domain
      0: 'whitechapel_mortuary',
      1: 'millers_court',
      2: 'whitechapel_mortuary',
      3: 'whitechapel_mortuary',
      // Acts 4-6: Bond is at his office or following the investigation
      4: 'lusk_office',
      5: 'bond_office',
      6: 'bond_office',
    },
  },

  edmund: {
    id: 'edmund',
    displayName: 'Edmund Halward',
    // Edmund is never introduced by Holmes. Never self-introduces.
    // His name is revealed only when Watson finds the forensic note in Act 5.
    alias: "Bond's assistant",
    aliasDescription: 'A quiet young man, perhaps thirty, standing near Dr. Bond with a small leather notebook. He does not look up.',
    requiresIntroduction: true,
    role: "Dr. Bond's Medical Assistant",
    description: 'Young, quiet, and outwardly respectable. Son of a physician. Studied medicine but left unexpectedly. Almost invisible. Never speaks unless directly addressed. His ordinariness is not accidental.',
    speakingStyle: 'Soft and measured. Avoids emotional language. Mundane and functional. Never asks questions. Never volunteers curiosity.',
    personality: ['Quiet', 'Polite', 'Reserved', 'Observant', 'Utterly without visible anxiety'],
    publicKnowledge: [
      'Medical assistant to Dr. Bond; present during post-mortem examinations',
      'Studied medicine but left formal training unexpectedly before completion',
      'Quiet, polite, reserved — well-regarded by those who work with him',
      // Edmund never discusses his own background — this is what the AI may NOT use
    ],
    followingRule: 'follows_bond',
    followsNpcId: 'bond',
    // Edmund is committed to the asylum in Act 6 — he stops following Bond and
    // remains at his canonical location (the asylum) from then on.
    followsUntilAct: 5,
    canonicalLocationByAct: {
      // Edmund follows Bond. Where Bond is not present at reconstruction
      // locations (Acts 2-3), Edmund is also absent.
      0: 'whitechapel_mortuary',
      1: 'millers_court',
      2: 'whitechapel_mortuary',
      3: 'whitechapel_mortuary',
      4: 'lusk_office',
      5: 'bond_office',
      6: 'private_asylum',
    },
    // Scripted presence moments — dramatic irony. Innocent on the surface, wrong in retrospect.
    // Edmund never explains himself. The AI works these in when contextually appropriate.
    scriptedLines: [
      {
        locationId: 'millers_court',
        // Fires after player examines burned_clothing — the per-object flag the engine sets
        triggerFlag: 'examined_millers_court_burned_clothing',
        instruction: "Bond's assistant examines the remnants in the grate without being asked. He observes, matter-of-factly, that whoever lit the clothing understood how long it would burn — a specific temperature, a specific duration. His tone is analytical, almost admiring. He does not appear to notice anything wrong with what he has said. He returns to his notes.",
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
    // Lusk's office is not reachable until Act 4; he is offstage before then.
    canonicalLocationByAct: {
      4: 'lusk_office',
      5: 'lusk_office',
      6: 'lusk_office',
    },
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
    publicKnowledge: [
      "Found Elizabeth Stride's body in Dutfield's Yard on the night of 30 September",
      "His cart may have interrupted the killer mid-act — no mutilation followed the throat wound",
      'Witnessed or heard sounds that night; testimony was crucial to reconstructing the killer\'s timeline',
      'The horse shied — that was the first sign something was wrong',
    ],
    followingRule: 'fixed',
    canonicalLocationByAct: {
      0: 'working_mens_club',
      1: 'working_mens_club',
      2: 'working_mens_club',
      3: 'working_mens_club',
      4: 'working_mens_club',
      5: 'working_mens_club',
      6: 'working_mens_club',
    },
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
    publicKnowledge: [
      'Manages a private asylum for those whose families wish discretion',
      'A patient matching the name Watson inquires about has been here since mid-November 1888',
      'The family arrangement was made quietly and quickly',
      'Speaks minimally about patients; will not volunteer information beyond what professional courtesy requires',
      'Believes private confinement is a humane solution for certain situations',
    ],
    followingRule: 'fixed',
    canonicalLocationByAct: {
      0: 'private_asylum',
      1: 'private_asylum',
      2: 'private_asylum',
      3: 'private_asylum',
      4: 'private_asylum',
      5: 'private_asylum',
      6: 'private_asylum',
    },
  },
};

export const NPC_DISPLAY_NAMES: Record<string, string> = {
  holmes: 'Sherlock Holmes',
  abberline: 'Inspector Abberline',
  bond: 'Dr. Thomas Bond',
  edmund: 'Edmund Halward',
  lusk: 'George Lusk',
  diemschutz: 'Louis Diemschutz',
  superintendent: 'Asylum Superintendent',
};

// Alias names used before introduction — keyed by NPC ID
export const NPC_ALIASES: Record<string, string> = {
  abberline: 'a police inspector',
  bond: 'a police surgeon',
  edmund: "Bond's assistant",
  diemschutz: 'the club steward',
  superintendent: 'the superintendent',
};

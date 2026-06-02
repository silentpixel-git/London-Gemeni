import type { SuspectProfile } from '../types';

// Data-driven deduction resolution. The engine checks the
// player's theory against each profile's aliases to determine
// success or failure — no character names are hardcoded in
// the engine itself.
export const SUSPECT_PROFILES: SuspectProfile[] = [
  {
    npcId: 'edmund',
    aliases: ['edmund', 'halward', "bond's assistant", 'the assistant', 'the young man'],
    isGuilty: true,
    successFlags: { 'deduction_correct': true, 'asylum_unlocked': true },
    successAct: 6,
    successVisitFlag: 'visited_private_asylum',
  },
  // Red herrings — plausible wrong theories get a tailored rebuttal before
  // the cold-case ending, rather than the generic "no match" response.
  {
    npcId: 'bond',
    aliases: ['bond', 'dr bond', 'dr. bond', 'thomas bond', 'the surgeon', 'the police surgeon'],
    isGuilty: false,
    wrongDeductionNote:
      `COLD CASE (named Dr. Bond) — Holmes hears the theory out: Bond has the anatomical mastery, the ` +
      `access to every scene, the standing to move unquestioned. But Holmes points to what does not fit — ` +
      `Bond's documented presence elsewhere on two of the murder nights, his own written conclusion that the ` +
      `killer lacked true surgical skill, and the absence of the spelling habit that marks the letters. A man ` +
      `is not hanged for being capable. Write a 150-word final diary entry: Watson concedes the logic was ` +
      `seductive but wrong, the real killer still at large, the case closed unsolved. Tone: sombre, self-critical. ` +
      `End with Watson closing his diary.`,
  },
  {
    npcId: 'abberline',
    aliases: ['abberline', 'inspector abberline', 'the inspector', 'frederick abberline'],
    isGuilty: false,
    wrongDeductionNote:
      `COLD CASE (named Inspector Abberline) — Holmes is quietly taken aback. Yes, Abberline has access to ` +
      `every scene and every file; yes, a policeman could move through Whitechapel unremarked. But Holmes ` +
      `dismantles it plainly — Abberline's exhaustion is genuine, his investigation sincere to the point of ` +
      `ruining his health, and nothing in the evidence connects him to the anatomical removals or the letters. ` +
      `To accuse the one man labouring hardest to stop the killings is despair, not deduction. Write a 150-word ` +
      `final diary entry: Watson regrets the accusation, the true culprit unnamed, the murders unanswered. ` +
      `Tone: sombre and ashamed. End with Watson closing his diary.`,
  },
];

import type { SuspectProfile, PersonOfInterest } from '../types';
import type { StoryFlag } from './flags';

export type { PersonOfInterest } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PERSONS OF INTEREST — the notebook's suspect ledger.
// Rendered in resolveNotebook. Entries appear once requiresFlag is set (omit =
// always shown) and gain a "cleared/struck" annotation once clearedByFlag is set.
// DESIGN RULE (reweave): Edmund is NEVER listed here before the Act 5
// convergence — absence, not dismissal, is his camouflage.
// ─────────────────────────────────────────────────────────────────────────────

export const PERSONS_OF_INTEREST: PersonOfInterest<StoryFlag>[] = [
  // The moving-spotlight roster. One loud theory per act, raised fairly and
  // cleared fairly. Edmund appears ONLY after the convergence (asylum_unlocked).
  {
    id: 'poi_stranger',
    label: 'The Stranger',
    detail: "Hutchinson's man — prosperous, dark, astrakhan coat, gold watch-chain; seen with Kelly hours before her death. Unidentified.",
    requiresFlag: 'talked_to_hutchinson_at_dorset_street',
    clearedByFlag: 'asked_holmes_about_holmes_tumblety_performance',
    clearedNote: 'too convenient — the man London wishes to blame; no corroboration found',
  },
  {
    id: 'poi_hutchinson',
    label: 'George Hutchinson',
    detail: 'The witness himself — account suspiciously detailed; admits loitering outside the court that night.',
    requiresFlag: 'talked_to_hutchinson_at_dorset_street',
    clearedByFlag: 'asked_tumblety_about_tumblety_theatrical_denial',
    clearedNote: 'no medical knowledge of any kind; a lonely man who knew Kelly — watched, then dismissed',
  },
  {
    id: 'poi_tumblety',
    label: 'The Mad Doctor (Francis Tumblety)',
    detail: 'American specimen-collector in custody — anatomical curios, hatred of women. He fits gloriously.',
    // Was gated on the Baker Street telegrams pile, retired with the Act 0
    // rework. Re-gated onto Abberline's own account of the custody, which is
    // askable from Act 2 — the first act he is onstage under the reweave.
    requiresFlag: 'asked_abberline_about_abberline_tumblety_custody',
    clearedByFlag: 'asked_abberline_about_abberline_barrister_file',
    clearedNote: 'fled the country — the public\'s chosen culprit; but the preservation does not match his crude curios',
  },
  {
    id: 'poi_pizer',
    label: '"Leather Apron" (John Pizer)',
    detail: 'The press\'s monster — a bootmaker the mob nearly hanged.',
    requiresFlag: 'asked_pizer_about_pizer_community_fears_mob',
    clearedByFlag: 'asked_holmes_about_holmes_no_reliable_witness',
    clearedNote: 'fully alibied; the panic was prejudice dressed as deduction',
  },
  {
    id: 'poi_gentleman',
    label: 'The Vanishing Gentleman',
    detail: 'A barrister of good family — erratic, dismissed from his post, now not to be found.',
    requiresFlag: 'asked_abberline_about_abberline_barrister_file',
  },
  {
    id: 'poi_bond',
    label: 'Dr. Thomas Bond',
    detail: 'Police surgeon — anatomical knowledge and access to every scene.',
    requiresFlag: 'examined_whitechapel_mortuary',
    clearedByFlag: 'showed_medical_reports_to_abberline',
    clearedNote: 'movements on the double-event night fully accounted for (Abberline)',
  },
  {
    id: 'poi_edmund',
    label: 'Edmund Halward',
    detail: 'The assistant — present at every scene; self-taught anatomy; laboratory hands; the hand of the letter. The answer.',
    requiresFlag: 'asylum_unlocked', // listed only once the convergence has named him
  },
];

// Data-driven deduction resolution. The engine checks the
// player's theory against each profile's aliases to determine
// success or failure — no character names are hardcoded in
// the engine itself.
export const SUSPECT_PROFILES: SuspectProfile<StoryFlag>[] = [
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
  // ── REWEAVE: the loud suspects ───────────────────────────────────────────
  {
    npcId: 'tumblety',
    aliases: ['tumblety', 'francis tumblety', 'the american', 'american doctor', 'the mad doctor', 'the quack'],
    isGuilty: false,
    wrongDeductionNote:
      `COLD CASE (named Francis Tumblety) — Holmes hears it through, and concedes its appeal: the specimens, ` +
      `the hatred of women, the flight that looked so much like confession. Then he takes it apart — the man's ` +
      `anatomy is a showman's, names and flourish without practice; his curios were bought, and crudely kept, ` +
      `nothing like the laboratory hand that preserved the Lusk kidney; and he fled an indecency charge, not a ` +
      `murder warrant. History will be content to blame the fled American. Holmes is not, and the murders go ` +
      `unanswered. Write a 150-word final diary entry: Watson chose the loud man, and the quiet one walked free. ` +
      `Tone: sombre, self-critical. End with Watson closing his diary.`,
  },
  {
    npcId: 'pizer',
    aliases: ['pizer', 'john pizer', 'leather apron', 'the bootmaker'],
    isGuilty: false,
    wrongDeductionNote:
      `COLD CASE (named John Pizer) — Holmes's reply is cold and immediate: Pizer was alibied within days of ` +
      `his arrest — a dock fire watched beside a constable, a lodging house full of witnesses — and released ` +
      `without charge. To name him now is to repeat what the mob and the newspapers did in September, with ` +
      `better grammar. The easy suspicion of the foreigner is not deduction; it is the very prejudice the ` +
      `killer has hidden behind all autumn. Write a 150-word final diary entry: Watson accuses a man already ` +
      `wronged, and the case closes unsolved. Tone: sombre and ashamed. End with Watson closing his diary.`,
  },
  {
    npcId: 'hutchinson',
    aliases: ['hutchinson', 'george hutchinson', 'the witness'],
    isGuilty: false,
    wrongDeductionNote:
      `COLD CASE (named George Hutchinson) — Holmes grants the instinct: the account too detailed, the ` +
      `loitering admitted, the late coming-forward. But the substance dissolves on inspection — the man has ` +
      `no medical knowledge of any kind, his movements on the other nights are accounted for, and his vigil ` +
      `outside the court was the loneliness of a man who half-hoped a friend would shelter him. Suspicion of ` +
      `everyone is not the same as evidence against someone. Write a 150-word final diary entry: Watson named ` +
      `a sad man and missed a quiet one; the case closes unsolved. Tone: sombre. End with Watson closing his diary.`,
  },
  {
    npcId: 'gentleman',
    aliases: ['the gentleman', 'the vanishing gentleman', 'the barrister', 'druitt'],
    isGuilty: false,
    wrongDeductionNote:
      `COLD CASE (named the vanished gentleman) — Holmes shakes his head slowly. A troubled barrister of good ` +
      `family, erratic and now missing, makes a satisfying shape — but a shape is all it is. His dismissal was ` +
      `private scandal, not blood; his movements fit none of the murder nights that can be fixed; and a man may ` +
      `vanish for a hundred reasons in this city, most of them sad and none of them murder. "It is always the ` +
      `respectable one" is an instinct, Watson, not a proof. Write a 150-word final diary entry: Watson names a ` +
      `ghost, and the true answer stays at its bench. Tone: sombre, resigned. End with Watson closing his diary.`,
  },
];

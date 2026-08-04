import type { StoryEventDefinition } from '../types';
import type { StoryFlag } from './flags';

/**
 * Act 0's pivotal scenes. The engine selects these after resolving the player's
 * action, then hands the ordered semantic beats to narration. File order is
 * priority order and every event is one-shot (`story_event_<id>`).
 *
 * It is 6 August 1888. No murder has happened; nothing here may connect Nell
 * Kemp to the later Whitechapel crimes.
 */
export const STORY_EVENTS: StoryEventDefinition<StoryFlag>[] = [
  {
    id: 'act0_caller_noticed',
    act: 0,
    triggers: [
      { intentTypes: ['talk'], npcIds: ['holmes'], topicAbsent: true, requireFlags: [], forbidFlags: ['act0_caller_noticed'], locationId: 'baker_street' },
      { intentTypes: ['examine'], targetIds: ['open_window', 'crowd'], rawPhrases: ['street', 'bystanders'], requireFlags: [], forbidFlags: ['act0_caller_noticed'], locationId: 'baker_street', replacesBlocked: true },
    ],
    setFlags: ['act0_caller_noticed'],
    maxWords: 230,
    actionDescription: 'Holmes read the holiday crowd and noticed a hesitant caller below.',
    actionResultNote: 'STORY EVENT — Holmes demonstrates how he reads the crowd, then notices the hesitant woman at the area railings. The bell has not rung.',
    beats: [
      'Holmes reads three people in the holiday crowd from their clothes and bearing: a licensed victualler with his daughter, and a man who walked from Hampstead to save the fare.',
      'When Watson challenges the last inference, Holmes points to the white Heath-road dust on the man’s boots and distinguishes observation from inference.',
      'Holmes then notices a gloved woman carrying one bundle who has twice reached the area railings and turned back; on her third approach, he calls her respectable and uncertain how to begin what brought her.',
    ],
  },
  {
    id: 'act0_bell_rang',
    act: 0,
    triggers: [
      { intentTypes: ['examine', 'query'], targetIds: ['open_window', 'crowd', 'mrs_kemp'], rawPhrases: ['woman', 'caller', 'street', 'bystanders'], requireFlags: ['act0_caller_noticed'], forbidFlags: ['act0_bell_rang'], locationId: 'baker_street', replacesBlocked: true },
      { intentTypes: ['talk'], npcIds: ['holmes'], topicPhrases: ['woman', 'caller', 'her', 'area railings'], requireFlags: ['act0_caller_noticed'], forbidFlags: ['act0_bell_rang'], locationId: 'baker_street' },
    ],
    setFlags: ['act0_bell_rang'],
    maxWords: 70,
    notice: '**Door bell** is ringing.',
    actionDescription: 'The hesitant caller finally rang the bell below.',
    actionResultNote: 'STORY EVENT — the street-door bell rings once. The caller is still downstairs and has not yet been admitted.',
    beats: [
      'The bell goes at last: one short pull, as though the hand that made it had been persuaded into the act and might yet repent of it.',
    ],
  },
  {
    id: 'act0_kemp_arrives',
    act: 0,
    triggers: [
      { intentTypes: ['other', 'open', 'examine'], rawPhrases: ['answer the door', 'open the door', 'attend to the door', 'attend the door', 'check the door'], requireFlags: ['act0_bell_rang'], forbidFlags: ['world_event_kemp_arrives'], locationId: 'baker_street', replacesBlocked: true },
    ],
    setFlags: ['world_event_kemp_arrives'],
    maxWords: 160,
    actionDescription: 'Watson attended the bell and Mrs Hudson showed the caller into the sitting room.',
    actionResultNote: 'STORY EVENT — Mrs Hudson introduces Mrs Kemp. Kemp lays the boots, workbox and pawn ticket on the table but does not yet state her business.',
    beats: [
      'Mrs Hudson, only lately returned from her Bank Holiday outing and still in her good hat, shows Mrs Kemp up and withdraws.',
      'Watson observes a woman of about thirty-four, still gloved in the warm room and dressed for an appointment that did not occur.',
      'Mrs Kemp sets down a bundle containing worn boots and a closed tin workbox, then keeps hold of a pawn ticket before finally laying it beside them.',
      'She gives her name but does not volunteer why she has come; the room waits for Watson to address her.',
    ],
  },
  {
    id: 'act0_kemp_business',
    act: 0,
    triggers: [
      { intentTypes: ['talk'], npcIds: ['mrs_kemp'], topicAbsent: true, requireFlags: ['world_event_kemp_arrives'], forbidFlags: ['act0_kemp_business_heard'], locationId: 'baker_street' },
      { intentTypes: ['talk'], npcIds: ['mrs_kemp'], topicIds: ['kemp_sister_missing'], topicPhrases: ['business', 'why she came', 'why you came', 'what brings', 'nell', 'sister', 'disappearance', 'missing'], requireFlags: ['world_event_kemp_arrives'], forbidFlags: ['act0_kemp_business_heard'], locationId: 'baker_street' },
    ],
    setFlags: ['act0_kemp_business_heard'],
    maxWords: 130,
    actionDescription: 'Mrs Kemp explained why she had come to Baker Street.',
    actionResultNote: 'STORY EVENT — Kemp says Nell has been missing six days and asks for help. Do not reveal the later reconstruction.',
    beats: [
      'Mrs Kemp says her younger sister Ellen, called Nell, has not been seen for six days, since Tuesday; they have never before gone a week without a word.',
      'She went to the police, who wrote the name in a book and did nothing more.',
      'Holmes distinguishes a deliberate departure from a disappearance, but does not dismiss her concern or solve the matter before examining what she brought.',
    ],
    fallback: {
      id: 'act0_kemp_business_fallback',
      afterEligibleActions: 2,
      eligibleIntentTypes: ['examine', 'talk', 'take', 'use', 'show', 'read', 'open', 'drop', 'wait'],
      counterFlags: ['act0_kemp_fallback_action_1', 'act0_kemp_fallback_action_2'],
      setFlags: ['act0_kemp_business_heard'],
      locationId: 'baker_street',
      requireFlags: ['world_event_kemp_arrives'],
      forbidFlags: ['act0_kemp_business_heard'],
      maxWords: 130,
      beats: [
        'After Watson’s second local action, Holmes turns from the objects and invites Mrs Kemp to state the purpose of her visit.',
        'Mrs Kemp says her younger sister Ellen, called Nell, has been missing for six days, and that the police merely wrote the name down.',
      ],
    },
  },
  {
    id: 'act0_boots_analyzed',
    act: 0,
    triggers: [
      { intentTypes: ['examine'], targetIds: ['nells_boots'], requireFlags: ['world_event_kemp_arrives'], forbidFlags: ['act0_boots_analyzed'], locationId: 'baker_street' },
      { intentTypes: ['talk'], npcIds: ['mrs_kemp', 'holmes'], topicPhrases: ['boots', 'mud', 'soles', 'where she walked'], requireFlags: ['world_event_kemp_arrives'], forbidFlags: ['act0_boots_analyzed'], locationId: 'baker_street' },
      { intentTypes: ['talk'], npcIds: ['mrs_kemp', 'holmes'], rawPhrases: ['ask holmes about them', 'ask mrs kemp about them'], rawPhraseMatch: 'exact', requireFlags: ['world_event_kemp_arrives'], forbidFlags: ['act0_boots_analyzed'], locationId: 'baker_street' },
    ],
    setFlags: ['act0_boots_analyzed'],
    maxWords: 180,
    actionDescription: 'Watson and Holmes analysed the deposits on Nell’s boots.',
    actionResultNote: 'STORY EVENT — the boots yield oak bark, lime and south-bank river silt; Holmes places their wear at Bermondsey tanyards. Keep the observations in the authored order.',
    beats: [
      'Watson examines or smells the crust in the boot welts and identifies the sharp trace of oak bark used in tanning.',
      'A pale, caustic dust worked into the same seams is lime, not ordinary road dust.',
      'Holmes adds the dark south-bank river silt and notes that London has had no rain in well over a week, so the deposit belongs to a wet trade yard rather than the street.',
      'Oak bark, lime and river silt together narrow the boots to the tanyards of Bermondsey; their wear shows repeated long walks there.',
    ],
  },
  {
    id: 'act0_reconstruction',
    act: 0,
    triggers: [
      { intentTypes: ['show'], targetIds: ['charity_card'], npcIds: ['holmes'], requireFlags: ['examined_baker_street_pawn_ticket', 'act0_boots_analyzed', 'examined_baker_street_nells_letters'], forbidFlags: ['act0_reconstruction_complete'], locationId: 'baker_street' },
      { intentTypes: ['talk'], npcIds: ['holmes'], topicPhrases: ['card', 'subscriber', 'charity', 'marchant'], requireFlags: ['examined_baker_street_pawn_ticket', 'act0_boots_analyzed', 'examined_baker_street_nells_letters'], forbidFlags: ['act0_reconstruction_complete'], locationId: 'baker_street' },
    ],
    setFlags: ['act0_reconstruction_complete', 'showed_charity_card_to_holmes'],
    maxWords: 300,
    actionDescription: 'Holmes reconstructed Nell’s deliberate departure from the ticket, boots, letters and charity card.',
    actionResultNote: 'STORY EVENT — deliver the complete Act 0 reconstruction from verified evidence only, then leave Watson the choice of what to tell Mrs Kemp.',
    beats: [
      'Holmes aligns the pawn ticket, the Bermondsey wear on the boots, the Tuesday postmarks in Nell’s letters and the sixteen shilling entries on the lying-in charity card.',
      'He concludes that Nell is five months pregnant and has walked to Bermondsey to pay for a December bed and midwife where her face is unknown.',
      'The planned packing and departure show that she is not lost; the workbox was left because it belonged to the life she meant to quit, while its hidden card was forgotten.',
      'The charity surname Marchant was Mrs Kemp and Nell’s mother’s name: Nell wanted one piece of her family with her, but not the family itself.',
      'Holmes gives Mrs Kemp the district and the truth of the matter, but withholds the card’s address; Watson must decide whether to give it, ask why Nell hid, or remain silent.',
    ],
  },
  {
    id: 'act0_give_card',
    act: 0,
    triggers: [
      { intentTypes: ['show'], targetIds: ['charity_card'], npcIds: ['mrs_kemp'], requireFlags: ['act0_reconstruction_complete'], forbidFlags: ['act0_kemp_choice_resolved'], locationId: 'baker_street' },
    ],
    setFlags: ['act0_kemp_choice_resolved', 'showed_charity_card_to_mrs_kemp'],
    inventoryRemove: ["A Subscriber's Card"],
    maxWords: 100,
    actionDescription: 'Watson gave Mrs Kemp the charity card and its address.',
    actionResultNote: 'STORY EVENT — Watson gives Kemp the card. She accepts it and departs; do not decide what she later does with the address.',
    beats: [
      'Watson puts the subscriber’s card into Mrs Kemp’s hand, giving her the address Holmes chose not to supply.',
      'She studies it, accepts it with no promise about what she will do, and leaves Baker Street with the choice now hers.',
    ],
  },
  {
    id: 'act0_ask_why_nell_hid',
    act: 0,
    triggers: [
      { intentTypes: ['talk'], npcIds: ['mrs_kemp'], topicIds: ['kemp_why_she_hid'], topicPhrases: ['why she hid', 'why nell hid', 'hid this from you', 'kept this from you'], requireFlags: ['act0_reconstruction_complete'], forbidFlags: ['act0_kemp_choice_resolved'], locationId: 'baker_street' },
    ],
    setFlags: ['act0_kemp_choice_resolved', 'asked_mrs_kemp_about_kemp_why_she_hid'],
    maxWords: 100,
    actionDescription: 'Watson asked Mrs Kemp whether she knew why Nell had hidden herself.',
    actionResultNote: 'STORY EVENT — Kemp cannot answer Watson’s question. She departs without the address.',
    beats: [
      'Before she leaves, Watson asks Mrs Kemp whether she knows why Nell chose to hide the matter from her.',
      'Mrs Kemp has no answer; Watson does not press her, and she departs without the card’s address.',
    ],
  },
  {
    id: 'act0_withhold_card',
    act: 0,
    triggers: [
      { intentTypes: ['other', 'take', 'talk', 'examine'], rawPhrases: ['keep the card', 'keep it', 'keep the subscriber’s card', 'keep the subscriber\'s card', 'say nothing', 'stay silent', 'hold my tongue', 'pocket the card'], rawPhraseMatch: 'exact', requireFlags: ['act0_reconstruction_complete'], forbidFlags: ['act0_kemp_choice_resolved'], locationId: 'baker_street', replacesBlocked: true },
    ],
    setFlags: ['act0_kemp_choice_resolved', 'withheld_address'],
    inventoryAdd: ["A Subscriber's Card"],
    maxWords: 100,
    actionDescription: 'Watson kept the charity card and said nothing.',
    actionResultNote: 'STORY EVENT — Watson withholds the address. Kemp understands the silence and departs.',
    beats: [
      'Watson keeps the card in his pocket and offers Mrs Kemp no address.',
      'After a brief wait she understands that no more will be said, and leaves without asking again.',
    ],
  },
  {
    id: 'act0_closing',
    act: 0,
    triggers: [
      { intentTypes: ['talk'], npcIds: ['holmes'], topicAbsent: true, requireFlags: ['act0_kemp_choice_resolved', 'took_baker_street_pawn_ticket'], forbidFlags: ['act0_closing_complete'], locationId: 'baker_street' },
      { intentTypes: ['examine'], targetIds: ['open_window', 'crowd'], rawPhrases: ['street', 'bystanders'], requireFlags: ['act0_kemp_choice_resolved', 'took_baker_street_pawn_ticket'], forbidFlags: ['act0_closing_complete'], locationId: 'baker_street', replacesBlocked: true },
    ],
    setFlags: ['act0_closing_complete'],
    maxWords: 180,
    actionDescription: 'Holmes returned to the holiday crowd after Mrs Kemp’s departure.',
    actionResultNote: 'STORY EVENT — integrate Holmes’s reading of the crowd with his complaint that modern crime has become arithmetic, then close Act 0 without foreshadowing any later crime.',
    beats: [
      'With Mrs Kemp gone and her ticket left behind, Holmes and Watson return to the open window and the Bank Holiday crowd.',
      'Holmes observes that a person might cross such a multitude and leave no useful recollection behind, because most faces are never truly noticed.',
      'He folds the caller’s matter into his complaint that modern crime has become arithmetic—ticket, postmark, weekly shilling—and says he would welcome a problem the window could not solve.',
      'The holiday continues below, ordinary and unconnected to anything beyond this completed visit.',
    ],
  },
];

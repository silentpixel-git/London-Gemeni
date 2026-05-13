// Canonical historical facts for case-related dialogue.
// The AI uses these when NPCs speak about the investigation.
export const WHITECHAPEL_FACTS = {
  victims: [
    { name: 'Mary Ann Nichols', location: "Buck's Row", date: '31 August 1888' },
    { name: 'Annie Chapman', location: '29 Hanbury Street', date: '8 September 1888' },
    { name: 'Elizabeth Stride', location: "Dutfield's Yard", date: '30 September 1888 (interrupted)' },
    { name: 'Catherine Eddowes', location: 'Mitre Square', date: '30 September 1888 (double event, ~45 min after Stride)' },
    { name: 'Mary Jane Kelly', location: "Miller's Court", date: '9 November 1888 (killer had uninterrupted hours)' },
  ],
  forensics: {
    Chapman: 'Uterus removed; anatomical knowledge evident but not surgical mastery',
    Eddowes: 'Left kidney and uterus removed within minutes; consistent with repeated anatomical familiarity',
    Kelly: 'Most extensive injuries; fire burned through the night, providing light for the killer',
  },
  investigation: 'Over 2,000 people interviewed; Metropolitan Police (Abberline, H Division) and City Police (Eddowes scene) coordination has been problematic',
  pressureDynamics: 'The Star and Times printing speculation as fact; witnesses terrified into silence',
  fromHellLetter: {
    received: 'George Lusk, 16 October 1888',
    contents: 'Half a human kidney preserved in spirits of wine, letter beginning "From hell"',
    spelling: 'The word "prasarved" (for preserved) is idiosyncratic and consistent across the letter and other documents',
  },
};

// One is chosen at random per narration call so the AI never
// defaults to the same micro-detail.
export const ATMOSPHERIC_SEEDS: string[] = [
  'A match scraping against brick somewhere unseen',
  "A child's cough from behind a closed door",
  'The distant clatter of a handcart on cobblestones',
  'The smell of boiled cabbage drifting from an upper window',
  'A gas lamp guttering in the wind, its flame turning blue',
  'A woman arguing in a low, urgent voice two streets over',
  "The tap of a blind man's cane receding into the fog",
  'A loose shutter banging rhythmically somewhere above',
  'The distant moan of a foghorn on the Thames',
  'Wet newspaper clinging to the base of a wall',
  'A horse snorting somewhere in the dark, unseen',
  'The smell of coal smoke settling low in the fog',
  'A single church bell tolling the quarter-hour',
  'Footsteps on a wooden floor directly above, then silence',
  'The drip of a gutter, metronomic in the quiet',
  "A drunk's muffled singing fading around a corner",
  'The rustle of pigeons disturbed on a nearby roof',
  "A constable's whistle, far off, answered by silence",
  'The distant rumble of a late goods train',
  'A door opening, then closing without anyone appearing',
  'The flare of a match in an upstairs window, briefly illuminating a face',
  'Broken glass crunching underfoot somewhere off to the left',
  'The sour smell of the tannery carried on the night air',
  'A baby crying briefly, then nothing',
  'Steam rising from a grate in the pavement',
  'A stray dog nosing at something in the gutter, then fleeing',
  'The creak of a sign-board swinging overhead in the wind',
  'A pair of boots ascending iron stairs somewhere above',
  "Children's voices from a court, suddenly hushed",
  "The scratch of a pen behind a lighted window",
  'A wheel-barrow abandoned at the kerb, one handle broken',
  "The acrid smell of an extinguished tallow candle drifting past",
  'Laughter from inside a public house — low, uncomfortable',
  'A pigeon with a broken wing circling the lamp-post',
  'The echo of a dropped tin pail two streets away',
];

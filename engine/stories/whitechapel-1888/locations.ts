import type { LocationDefinition } from '../types';

export const LOCATIONS: Record<string, LocationDefinition> = {

  // ── PRESENT-DAY LOCATIONS ─────────────────────────────────────────────────

  baker_street: {
    id: 'baker_street',
    name: '221B Baker Street',
    shortName: 'Baker Street',
    act: 0,
    timeframe: 'present',
    atmosphere: 'Warm lamplight, tobacco smoke, and the familiar disorder of a working mind. Holmes\' sitting room in the grip of an urgent case.',
    description: 'The sitting room is barely recognisable. Case files have colonised the mantelpiece, the armchairs, and most of the floor. A large map of Whitechapel is pinned to the wall with coloured threads running between locations. Holmes stands at the window, his back to the room.',
    exits: ['dorset_street'],
    interactables: ['whitechapel_map', 'holmes_chemistry_table', 'telegrams_pile', 'newspaper_pile', 'case_files_wall'],
    keyClues: ['Holmes has been building a case map', 'The newspapers document public panic and press speculation', 'A clipping of the published "Dear Boss" letter is worth showing to Holmes'],
    criticalPathLead: 'Speak with Holmes — he has been at this for weeks. Examine the case files wall and the newspapers; show Holmes the clipping of the published letter; read the telegrams last.',
    locationExaminedFlag: 'examined_baker_street',
    timeOfDay: 'night',
    vignettes: [
      { text: 'Mrs Hudson leaves a supper tray outside the door without knocking — she has learned the rhythm of a case. The tea goes cold where she left it.', act: 0 },
      { text: 'A telegraph boy hammers at the street door, hands up a wire, and is gone before it can be signed for. Holmes reads it once and feeds it to the fire.' },
    ],
  },

  dorset_street: {
    id: 'dorset_street',
    name: 'Dorset Street',
    shortName: 'Dorset Street',
    act: 1,
    timeframe: 'present',
    atmosphere: 'Foggy mornings, muddy roads, constant noise from vendors and carts. A crowded and impoverished street in Whitechapel.',
    description: "The air is thick with the smell of coal smoke and the press of humanity. A crowd has gathered outside Miller's Court, their whispers a low hum against the city's noise.",
    exits: ['millers_court', 'baker_street', 'h_division_station'],
    interactables: ['police_barricade', 'street_lamps', 'lodging_house_entrances', 'crowd'],
    keyClues: ["Crowd rumors about Miller's Court", 'Abberline can brief Watson on the situation'],
    criticalPathLead: "Speak with the inspector or enter Miller's Court to begin the investigation.",
    locationExaminedFlag: 'examined_dorset_street',
    timeOfDay: 'morning',
    extras: [
      'a coster pushing his barrow one street over rather than pass the court entrance',
      'two lodging-house women sharing a clay pipe in a doorway, watching everything and saying nothing',
      'a constable stamping warmth into his feet at the corner, studiously not looking at the crowd',
    ],
    vignettes: [
      { text: 'A woman in a shawl steps out of the crowd, lays a bunch of violets at the court entrance, and walks away. When Watson looks again, the flowers are already trodden into the mud.', act: 1 },
      { text: 'A child of perhaps eight works the crowd selling matches, calling the murder like a headline. Nobody buys. Nobody sends her home.' },
    ],
  },

  millers_court: {
    id: 'millers_court',
    name: "13 Miller's Court",
    shortName: "Miller's Court",
    act: 1,
    timeframe: 'present',
    atmosphere: 'Claustrophobic, quiet, and deeply unsettling. The room where Mary Jane Kelly was found on the morning of November 9, 1888.',
    description: 'A small rented room, barely large enough for the bed that dominates it. The fireplace is cold now, but the ash in the grate speaks of a fire that burned for hours. The air is thick with what Watson\'s medical training tells him not to name aloud.',
    exits: ['dorset_street'],
    interactables: ['the_bed', 'burned_clothing', 'examination_instruments', 'bloodstained_sheets'],
    keyClues: ['Killer had time and confidence', 'Burned clothing used for light', 'Extensive mutilation indicates medical familiarity'],
    criticalPathLead: "Examine the fireplace and the bed. Speak with Dr. Bond about the nature of the injuries.",
    locationExaminedFlag: 'examined_millers_court',
    timeOfDay: 'morning',
  },

  whitechapel_mortuary: {
    id: 'whitechapel_mortuary',
    name: 'Whitechapel Mortuary',
    shortName: 'The Mortuary',
    act: 2,
    timeframe: 'present',
    atmosphere: 'Cold stone, formaldehyde, and the particular silence of a room that has seen too much death. Dr. Bond works here. His assistant is rarely far.',
    description: "The mortuary on Eagle Street is a plain municipal building that has processed more violent death this autumn than in the previous decade combined. Bond's examination table is spotless. His records are meticulous. On a shelf above his desk, five manila folders — one for each victim — are arranged in chronological order.",
    exits: ['dorset_street', 'bucks_row'],
    interactables: ['autopsy_ledger', 'specimen_cabinet', 'bonds_desk', 'victim_folders'],
    keyClues: ['All five victims examined here — patterns emerge across the campaign', "Bond's assistant has transcribed every report"],
    criticalPathLead: "Examine the autopsy ledger and the victim folders. The pattern across five murders is visible here in a way it is not at individual scenes.",
    locationExaminedFlag: 'examined_whitechapel_mortuary',
    timeOfDay: 'midday',
    extras: [
      'a mortuary porter scrubbing the stone floor by the door, methodical and unhurried',
      'a parish clerk waiting with papers to be signed, hat in his hands',
    ],
    vignettes: [
      { text: 'A man in his Sunday coat is led in to identify a body that is not, in the end, his sister. He thanks Bond twice on the way out, as though something had been given back to him.' },
    ],
  },

  h_division_station: {
    id: 'h_division_station',
    name: 'H Division Police Station',
    shortName: 'H Division',
    act: 2,
    timeframe: 'present',
    atmosphere: "Overcrowded, understaffed, and running on cold tea and exhaustion. The operational heart of the Whitechapel investigation — and a place where failure is felt personally.",
    description: "The main room of Commercial Street station is papered with witness statements, sketch portraits, and contradictory descriptions. Abberline has a small office at the back. The door is always open. He is rarely sitting down.",
    exits: ['dorset_street', 'whitechapel_pub'],
    interactables: ['witness_description_wall', 'abberline_desk', 'investigation_board', 'case_files_cabinet'],
    keyClues: ['Dozens of contradictory witness descriptions — the killer presented differently to each', "Abberline's personal cost is visible here"],
    criticalPathLead: "Study the witness description wall. The contradictions are not a failure of investigation — they are a clue in themselves.",
    locationExaminedFlag: 'examined_h_division_station',
    timeOfDay: 'afternoon',
    extras: [
      'a desk sergeant taking down a complaint from a woman who keeps starting the story over',
      'two beat constables comparing notebooks in a corner, voices low',
      'a man in handcuffs on the bench, asleep or pretending to be',
    ],
    vignettes: [
      { text: 'A constable comes in off his beat, hangs up his cape, and stands a long moment with both hands flat on the counter before he reports. Nobody hurries him.' },
    ],
  },

  whitechapel_pub: {
    id: 'whitechapel_pub',
    name: 'The Ten Bells',
    shortName: 'The Ten Bells',
    act: 2,
    timeframe: 'present',
    atmosphere: "Sawdust floors, gas lamps turned low, the smell of cheap gin and wet wool. A public house that has served Spitalfields for a century and has seen everything.",
    description: "The Ten Bells on Commercial Street stands directly opposite Spitalfields Market. It is the kind of pub that doesn't need a reputation — it simply exists, as it always has, as a place where the people of this neighbourhood come to be warm. Several of the women who worked these streets drank here. Watson is not sure all of them are still alive.",
    exits: ['h_division_station', 'bucks_row'],
    interactables: ['pub_regulars', 'the_barmaid', 'corner_table', 'notice_board'],
    keyClues: ['The human cost of these murders — women who had no protection', 'Neighbourhood fear and anger'],
    criticalPathLead: "There are no clues here in the forensic sense. But Watson is a doctor and a gentleman, and he needs to understand what is actually at stake in this investigation.",
    locationExaminedFlag: 'examined_whitechapel_pub',
    timeOfDay: 'night',
    extras: [
      'the potboy collecting glasses, working around conversations without hearing them',
      'an old man at the end of the bar nursing the same half-pint for an hour',
      'two market porters dividing their pay with great ceremony and small coins',
    ],
    vignettes: [
      { text: "The barmaid sets a gin at an empty corner seat, catches herself, and takes it back without a word. Watson does not ask whose seat it was." },
    ],
  },

  lusk_office: {
    id: 'lusk_office',
    name: "George Lusk's Office",
    shortName: 'Lusk Office',
    act: 4,
    timeframe: 'present',
    atmosphere: 'Cluttered with papers and letters. Meeting room of the Whitechapel Vigilance Committee.',
    description: 'The office is small and cramped, filled with the correspondence of a terrified district. Lusk sits behind a desk that has become a clearing house for public fear.',
    exits: ['goulston_street', 'bond_office'],
    interactables: ['parcel_box', 'from_hell_letter', 'kidney_parcel'],
    keyClues: ['From Hell letter with irregular spelling', 'Half a human kidney — Watson can confirm it is human'],
    criticalPathLead: "Examine the From Hell letter carefully — note the spelling — and have Watson examine the kidney parcel.",
    locationExaminedFlag: 'examined_lusk_office',
    timeOfDay: 'afternoon',
    extras: [
      'a committee volunteer sorting the morning post into "answer" and "burn" piles',
      'a tradesman waiting to report a suspicious lodger, rehearsing his account under his breath',
    ],
    vignettes: [
      { text: 'A clerk opens an envelope, reads two lines, and sets it face-down on the burn pile with a steadiness that has clearly been practised. Lusk does not ask what it said.', act: 4 },
    ],
  },

  bond_office: {
    id: 'bond_office',
    name: "Dr. Bond's Office",
    shortName: 'Bond Office',
    act: 5,
    timeframe: 'present',
    atmosphere: 'Clinical and quiet. Contains forensic records and anatomical specimens. Bond\'s assistant works at a small desk by the window.',
    description: 'The room smells of formaldehyde and old paper. Medical reports are stacked neatly on the desk. Near the window, Bond\'s assistant sits cataloguing notes — head down, pen moving steadily, apparently unaware of Watson\'s scrutiny.',
    exits: ['lusk_office', 'private_asylum', 'baker_street'],
    interactables: ['medical_reports', 'anatomical_texts', 'specimen_jars', 'edmund_forensic_note'],
    keyClues: ["The assistant's handwritten forensic note is worth copying for later study", 'Patterns across all five murders'],
    criticalPathLead: "Gather the assistant's handwritten notes. Careful document comparison wants a desk and good light — better done back at Baker Street.",
    locationExaminedFlag: 'examined_bond_office',
    timeOfDay: 'midday',
    extras: [
      'a hospital messenger waiting for a signature, shifting from foot to foot',
      'a charwoman polishing the brass plate on the door, breathing on it between strokes',
    ],
  },

  private_asylum: {
    id: 'private_asylum',
    name: 'The Private Asylum',
    shortName: 'Private Asylum',
    act: 6,
    // The asylum cannot be visited until Watson has correctly named the killer.
    requiresFlag: 'asylum_unlocked',
    timeframe: 'present',
    atmosphere: 'Quiet, sterile, and unsettlingly calm. An institution outside London for those whose families require discretion.',
    description: "The grounds are well-kept, but the high walls and locked doors speak of a different kind of poverty — the poverty of the mind. The superintendent receives Watson with professional courtesy. He does not ask why Watson has come.",
    exits: ['bond_office', 'baker_street'],
    interactables: ['patient_records', 'edmund_room_furnishings'],
    keyClues: ["Edmund committed after Kelly's murder", 'Family discovered disturbing medical evidence — a preserved kidney'],
    criticalPathLead: "Speak with the superintendent, examine the patient records, and look over the furnishings of Edmund's room. The truth of this case ends here.",
    locationExaminedFlag: 'visited_private_asylum',
    timeOfDay: 'afternoon',
  },

  // ── RECONSTRUCTION LOCATIONS ──────────────────────────────────────────────
  // Watson visits these weeks or months after the crimes.
  // Bond and his assistant are NOT present — they were here in the past.
  // Abberline and Holmes guide Watson through the cold evidence.

  bucks_row: {
    id: 'bucks_row',
    name: "Buck's Row",
    shortName: "Buck's Row",
    act: 2,
    timeframe: 'reconstruction',
    reconstitutionNote: "Watson visits in early November 1888 — some ten weeks after Mary Ann Nichols was murdered here on August 31st. The street has returned to its ordinary rhythm. There is no crime scene, no police presence. Watson works from Abberline's notes and Bond's written post-mortem report. Holmes reasons from the physical geography.",
    atmosphere: 'Quiet and industrial. A narrow street lined with warehouses. Ordinary now, but Watson knows what happened here.',
    description: 'The cobblestones are slick with November damp. The warehouses loom like silent sentinels. Nothing marks this spot as different from any other street in Whitechapel — which is, Watson realises, precisely the point.',
    exits: ['whitechapel_mortuary', 'hanbury_street', 'whitechapel_pub'],
    interactables: ['cobblestone_roadway', 'warehouse_doors', 'street_lamps'],
    keyClues: ['Killer approached Nichols calmly', 'Witnesses believed she was merely drunk — no alarm raised'],
    criticalPathLead: "Examine the street and work through Abberline's notes. The geography tells you something about how the killer was perceived.",
    locationExaminedFlag: 'examined_bucks_row',
    timeOfDay: 'night',
    extras: [
      'a warehouse hand rolling barrels across the cobbles, life gone back to its work',
      'a knife-grinder setting up his wheel where the body lay, not knowing or not caring',
    ],
    vignettes: [
      { text: 'An old woman pauses at the gateway, crosses herself with a small economical motion, and walks on without breaking stride. She has done this before.', act: 2 },
    ],
  },

  hanbury_street: {
    id: 'hanbury_street',
    name: 'Hanbury Street',
    shortName: 'Hanbury Street',
    act: 2,
    timeframe: 'reconstruction',
    reconstitutionNote: "Watson visits weeks after Annie Chapman's murder on September 8th. The yard behind No. 29 is back in use. Watson has Bond's surgical report in his coat pocket. He reads from it as Holmes examines the fence and the steps.",
    atmosphere: 'Crowded working-class neighbourhood. The backyard behind 29 Hanbury Street — a place of ordinary horror.',
    description: 'The yard is small, enclosed by a wooden fence. People pass through it daily now, indifferent or unaware. Watson consults Bond\'s report: the organ removal was clean, deliberate, and practised. Not the act of a man who had never done this before.',
    exits: ['bucks_row', 'dutfields_yard'],
    interactables: ['wooden_fence', 'yard_steps', 'ground_where_body_was_discovered'],
    keyClues: ['Organ removal (uterus)', 'Killer has anatomical familiarity — not surgical mastery, but practised knowledge'],
    criticalPathLead: "Examine the yard and consult Bond's report on the anatomical precision of the organ removal.",
    locationExaminedFlag: 'examined_hanbury_street',
    timeOfDay: 'morning',
    extras: [
      'a resident of No. 29 carrying washing through the yard, stepping where she has always stepped',
      'two children playing knucklebones on the steps, shooed off and back within the minute',
    ],
    vignettes: [
      { text: 'A lodger leans from an upper window and asks, without preamble, whether Watson is "another one come to look." He withdraws before any answer can be given.', act: 2 },
    ],
  },

  dutfields_yard: {
    id: 'dutfields_yard',
    name: "Dutfield's Yard",
    shortName: "Dutfield's Yard",
    act: 3,
    timeframe: 'reconstruction',
    reconstitutionNote: "Watson reconstructs the night of September 30th from Diemschutz's testimony and the City Police report. It is now November; the yard is quiet. Holmes walks the cart path slowly, measuring distances and timing in his head.",
    atmosphere: 'Lively due to the nearby club, but quiet within the yard itself. Where Elizabeth Stride was found — and where she was left unfinished.',
    description: "A small yard beside the International Working Men's Club. The sounds of political discussion drift from the open windows above, as they did on the night of September 30th. Diemschutz's cart entered through the gate. The horse shied. That was all it took.",
    exits: ['hanbury_street', 'working_mens_club', 'mitre_square'],
    interactables: ['yard_entrance_gate', 'cart_path', 'club_doorway'],
    keyClues: ['Killer was interrupted mid-act', 'Only a throat wound — no mutilation — proves ritual incompleteness', 'Compelled to seek another victim within 45 minutes'],
    criticalPathLead: "Inspect the gate and walk the cart path. The interrupted murder tells you something about compulsion that the completed ones do not.",
    locationExaminedFlag: 'examined_dutfields_yard',
    timeOfDay: 'night',
    extras: [
      'a club member smoking in the doorway, the argument indoors continuing without him',
      'a carter backing his horse into the yard with practised curses',
    ],
    vignettes: [
      { text: "The horse in the yard tonight will not pass the gate either — it plants its feet exactly where Diemschutz's pony shied. The carter swears at it. Holmes watches the animal with open respect.", act: 3 },
    ],
  },

  working_mens_club: {
    id: 'working_mens_club',
    name: "International Working Men's Club",
    shortName: "Working Men's Club",
    act: 3,
    timeframe: 'reconstruction',
    reconstitutionNote: "Watson and Holmes visit the club in November to interview members and review the circumstances of the September 30th discovery. Holmes briefly entertains a theory about dock workers and foreign community connections — a theory Abberline has also been pressured to pursue. Watson is sceptical.",
    atmosphere: 'Political discussions, cigarette smoke, crowded benches. A meeting hall where ideas about justice and labour fill the air.',
    description: 'The room is filled with the scent of cheap tobacco and the energy of debate. Posters and newspapers line the walls. Diemschutz stands near the bar, a man who discovered a body six weeks ago and has not quite recovered his equilibrium.',
    exits: ['dutfields_yard'],
    interactables: ['tables', 'posters', 'newspapers', 'club_members'],
    keyClues: ["Witness accounts of Stride's discovery", "Holmes' false theory: dock connection — he will abandon it by Act 4", 'Social tension and the foreign community being scapegoated by the press'],
    criticalPathLead: "Speak with Diemschutz and examine the newspapers. Holmes is pursuing a theory Watson finds unconvincing.",
    locationExaminedFlag: 'examined_working_mens_club',
    timeOfDay: 'night',
  },

  mitre_square: {
    id: 'mitre_square',
    name: 'Mitre Square',
    shortName: 'Mitre Square',
    act: 3,
    timeframe: 'reconstruction',
    reconstitutionNote: "Watson visits Mitre Square to reconstruct the second murder of September 30th — Catherine Eddowes, killed 45 minutes after Elizabeth Stride, in a different police jurisdiction. The square is quiet and unremarkable by day. Holmes stands at the spot and times the escape routes.",
    atmosphere: 'Cold and isolated with echoing footsteps. A stone square within the City of London, bounded by dark alleyways.',
    description: 'The dark alleyways provide multiple escape routes across three jurisdictions. Within minutes of the murder here, the killer had left City Police territory entirely. Watson reads from Bond\'s report: kidney and uterus removed in under four minutes. Holmes says nothing for a long moment.',
    exits: ['dutfields_yard', 'goulston_street'],
    interactables: ['alleyways', 'square_walls', 'police_lanterns'],
    keyClues: ['Kidney removal — surgical speed and precision', 'Killer knew the city and its escape routes', 'Two murders in 45 minutes — this is compulsion, not opportunism'],
    criticalPathLead: "Examine the alleyways and discuss the kidney removal with Holmes. The speed and precision tell you something critical about the killer's experience.",
    locationExaminedFlag: 'examined_mitre_square',
    timeOfDay: 'night',
    extras: [
      'a City constable on his beat, boots loud on the stone, timing his round to the minute',
      'a watchman in a warehouse doorway, lantern at his feet, awake in a way he was not in September',
    ],
  },

  goulston_street: {
    id: 'goulston_street',
    name: 'Goulston Street',
    shortName: 'Goulston Street',
    // Reweave: moved from Act 4 → Act 3 — the apron trail and the erased
    // graffiti belong to the Foreigner act, alongside the double event.
    act: 3,
    timeframe: 'reconstruction',
    atmosphere: 'Busy street with lingering tension. The wall where the graffiti was discovered is just a wall now — Commissioner Warren had it erased before dawn.',
    description: "The street is bustling, but Watson stands at the precise spot where, on the night of September 30th, a Metropolitan constable found a piece of Eddowes' apron and a chalk inscription on the wall above it. The inscription was wiped away before it could be photographed. Watson finds this inexplicable and infuriating.",
    exits: ['mitre_square', 'lusk_office'],
    interactables: ['graffiti_wall', 'apron_fragment_location'],
    keyClues: ['Killer moved between jurisdictions deliberately', 'Apron fragment links Mitre Square to Goulston Street', 'Graffito erased by order of Commissioner Warren — to prevent anti-Semitic riots'],
    criticalPathLead: "Examine the graffiti location and the apron fragment. The police decision to erase the inscription was a choice between evidence and public order.",
    locationExaminedFlag: 'examined_goulston_street',
    timeOfDay: 'night',
    extras: [
      'market traders crying their stalls along the street, commerce louder than memory',
      'a boy in a doorway selling bootlaces from a tray, eyes following every passer-by',
    ],
    vignettes: [
      { text: 'Someone has chalked a fresh price-list on the wall a few feet from where the inscription was wiped. Ordinary words in an ordinary hand. Watson looks at it longer than it deserves.', act: 3 },
    ],
  },
};

export const OBJECT_DISPLAY_NAMES: Record<string, string> = {
  // Baker Street
  case_files_wall: 'Case Files Wall',
  whitechapel_map: 'Whitechapel Map',
  holmes_chemistry_table: "Holmes' Chemistry Table",
  telegrams_pile: 'Telegrams from Abberline',
  newspaper_pile: 'Newspaper Pile',
  // Dorset Street
  police_barricade: 'Police Barricade',
  street_lamps: 'Street Lamps',
  lodging_house_entrances: 'Lodging House Entrances',
  crowd: 'The Crowd',
  // Miller's Court
  the_bed: 'The Bed',
  burned_clothing: 'Burned Clothing',
  examination_instruments: 'Examination Instruments',
  bloodstained_sheets: 'Bloodstained Sheets',
  // Whitechapel Mortuary
  autopsy_ledger: 'Autopsy Ledger',
  specimen_cabinet: 'Specimen Cabinet',
  bonds_desk: "Dr. Bond's Desk",
  victim_folders: 'Victim Case Folders',
  // H Division Station
  witness_description_wall: 'Witness Description Wall',
  abberline_desk: "Abberline's Desk",
  investigation_board: 'Investigation Board',
  case_files_cabinet: 'Case Files Cabinet',
  // The Ten Bells
  pub_regulars: 'Pub Regulars',
  the_barmaid: 'The Barmaid',
  corner_table: 'Corner Table',
  notice_board: 'Notice Board',
  // Buck's Row
  cobblestone_roadway: 'Cobblestone Roadway',
  warehouse_doors: 'Warehouse Doors',
  // Hanbury Street
  wooden_fence: 'Wooden Fence',
  yard_steps: 'Yard Steps',
  ground_where_body_was_discovered: 'Ground (Body Discovery Site)',
  // Dutfield's Yard
  yard_entrance_gate: 'Yard Entrance Gate',
  cart_path: 'Cart Path',
  club_doorway: 'Club Doorway',
  // Working Men's Club
  tables: 'Tables',
  posters: 'Posters',
  newspapers: 'Newspapers',
  club_members: 'Club Members',
  // Mitre Square
  alleyways: 'Dark Alleyways',
  square_walls: 'Square Walls',
  police_lanterns: 'Police Lanterns',
  // Goulston Street
  graffiti_wall: 'Graffiti Wall',
  apron_fragment_location: 'Apron Fragment Location',
  // Lusk Office
  parcel_box: 'Parcel Box',
  from_hell_letter: 'The From Hell Letter',
  kidney_parcel: 'The Kidney Parcel',
  // Bond's Office
  medical_reports: 'Forensic Examination Reports',
  anatomical_texts: 'Anatomical Textbooks',
  specimen_jars: 'Specimen Jars',
  edmund_forensic_note: "Assistant's Forensic Note",
  // Private Asylum
  patient_records: 'Patient Records',
  edmund_room_furnishings: "Patient's Room",
  superintendent: 'Asylum Superintendent',
  // Legacy / shared
  city_police: 'City Police Officers',
};

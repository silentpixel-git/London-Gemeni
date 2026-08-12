/**
 * diaryLocations.ts — authored Watson diary lines for arriving at a location.
 *
 * Keyed by locationId. The first time Watson reaches a location, a
 * DiaryEntry{kind:'location'} is captured and its body resolved from here, so
 * the casebook reads as a record of where the investigation went. The starting
 * location (baker_street) is also seeded at game start so the diary is never empty.
 *
 * Spoiler discipline: these mirror the recession rule — they describe the place
 * and its dead, never naming the killer ahead of the Act 5 convergence.
 */

export interface LocationDiaryEntry {
  name: string;       // diary entry title (the location's name)
  diaryNote: string;  // Watson's first-person arrival line
}

export const LOCATION_DIARY: Record<string, LocationDiaryEntry> = {
  // Seeded at game start, so this is the first thing a player reads in the
  // casebook. Act 0 is the August Bank Holiday: no murder has happened, there is
  // no case and no wall to pin one to, and nothing here may anticipate either.
  baker_street: {
    name: '221B Baker Street',
    diaryNote: "Looking back, I can fix the date precisely: the sixth of August, 1888, the evening of the Bank Holiday. I called at Baker Street to find Holmes with no case to occupy him — only the street below, and whatever small mysteries he could invent to fill the silence. It was the last such evening either of us would have for some time.",
  },
  dorset_street: {
    name: 'Dorset Street',
    diaryNote: "Dorset Street, and a crowd pressed against the police barricade at the mouth of Miller's Court. The poorest quarter I have seen in London — and the place where the killer did his very worst.",
  },
  millers_court: {
    name: "13 Miller's Court",
    diaryNote: "Into Kelly's room at last. I have seen battlefields, yet I stood at the foot of that bed and found no professional calm to reach for. Whatever was done here took hours, and was done without fear.",
  },
  whitechapel_mortuary: {
    name: 'Whitechapel Mortuary',
    diaryNote: "The Whitechapel mortuary — Bond's domain. Five women reduced to ledgers and jars, kept in order by a man who will not let such horror disorder his work. I find his composure both admirable and unsettling.",
  },
  h_division_station: {
    name: 'H Division Police Station',
    diaryNote: "H Division, and Abberline's desk buried under three months of fruitless labour. The investigation board is a chronicle of every lead followed to nothing. These are not idle men; they are simply beaten.",
  },
  whitechapel_pub: {
    name: 'The Ten Bells',
    diaryNote: "The Ten Bells, where three of the dead women were once regulars. The grief here is quiet and unsurprised — the look of people who had long expected such news.",
  },
  bucks_row: {
    name: "Buck's Row",
    diaryNote: "Buck's Row, where Polly Nichols was found. A narrow, bolted-up street where no one heard a thing — the killer so unremarkable that the night simply closed over him.",
  },
  hanbury_street: {
    name: 'Hanbury Street',
    diaryNote: "Hanbury Street, the yard behind No. 29 where Annie Chapman died within the hour of daylight. An ordinary thoroughfare, a latch that does not quite catch. And yet.",
  },
  dutfields_yard: {
    name: "Dutfield's Yard",
    diaryNote: "Dutfield's Yard, where Elizabeth Stride's throat was cut and nothing more — Diemschutz's cart breaking in before the work was done. Forty feet away, the club argued on about the rights of man.",
  },
  working_mens_club: {
    name: "International Working Men's Club",
    diaryNote: "The Working Men's Club beside the yard — pamphlets in four languages and the word 'justice' on every wall. A world of conviction sharing the same fog as the murders, and as helpless against them.",
  },
  mitre_square: {
    name: 'Mitre Square',
    diaryNote: "Mitre Square, where Catherine Eddowes was killed and opened within minutes, on the very night of the double event. Three alleys lead out, each into a different jurisdiction. He knew the ground.",
  },
  goulston_street: {
    name: 'Goulston Street',
    diaryNote: "Goulston Street, where a piece of Eddowes' apron was dropped and a line of chalk wiped away before dawn. I confess the erasure troubles me almost as much as the murder.",
  },
  lusk_office: {
    name: "George Lusk's Office",
    diaryNote: "George Lusk's office, and the parcel that reached him through the penny post. A man may steel himself against a letter; against half a human kidney he cannot.",
  },
  bond_office: {
    name: "Dr. Bond's Office",
    diaryNote: "Bond's office, lined with specimen jars and the quiet industry of his assistant. I came for the forensic reports; I left with the feeling I had overlooked something in plain sight.",
  },
  private_asylum: {
    name: 'The Private Asylum',
    diaryNote: "The private asylum at last — high walls, a gravel path, a great stillness. Here, behind a family's careful silence, the answer to eleven weeks of murder has been kept quietly out of the world.",
  },
};

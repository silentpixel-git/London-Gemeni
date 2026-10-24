# Where-it-is notes for the sidebar (draft for sign-off)

The prototype's sidebar sometimes follows an object with a small grey note that says where it is ("Holmes's opera glass *on the mantel*").

The game now has room for that note. This file drafts one for every object of interest so you can approve, change or strike each before anything is written to story data. That follows the act-authoring rule: no story data before sign-off.

**Rules I wrote to**
- **Short:** two to four words, lower case, and no full stop.
- **Locations only:** a note says where the thing is, never what it means. No clue content, no spoilers, and nothing the narration hasn't already put in the room.
- **Pinned to the room description:** each note is anchored in that room's authored description wherever possible. A **?** marks a placement I inferred rather than found in the text. Those need your eye.
- **Blank is fine:** a dash (—) means I suggest no note, because the name already says where it is.

**After sign-off**
- The notes go into the story data as an optional per-object field.
- The sidebar shows them.
- `qa:validate` gets a check that every listed object has a note, or is explicitly marked as having none.

## Act 0: 221B Baker Street
| Object | Note |
|---|---|
| The Open Window | — |
| Pawn Ticket | on the side table ? |
| Boots | by the door ? |
| Workbasket | on the caller's lap ? |
| Correspondence | in the workbasket ? |
| A Subscriber's Card | on the side table ? |

These Act 0 objects belong to the Kemp story, which is being replaced by The Wager. If The Wager goes ahead, this table is rewritten from its spec (for example, the opera glass *on the mantel*, the violin *in its case*, the monograph *on the side table*).

## Act 1
**Dorset Street**
| Object | Note |
|---|---|
| Police Barricade | across the court entrance |
| Street Lamps | along the pavement |
| Lodging House Entrances | along the street |
| The Crowd | outside Miller's Court |
| Miller's Court Archway | — |

**13 Miller's Court**
| Object | Note |
|---|---|
| The Bed | filling the room |
| Burned Clothing | in the grate |
| Examination Instruments | beside the bed ? |
| Bloodstained Sheets | on the bed |

## Act 2
**Whitechapel Mortuary**
| Object | Note |
|---|---|
| Autopsy Ledger | on Bond's desk ? |
| Specimen Cabinet | against the wall ? |
| Dr. Bond's Desk | — |
| Victim Case Folders | on the shelf above the desk |

**H Division Police Station**
| Object | Note |
|---|---|
| Witness Description Wall | — |
| Abberline's Desk | in the back office |
| Investigation Board | in the main room ? |
| Case Files Cabinet | in the back office ? |

**The Ten Bells**
| Object | Note |
|---|---|
| Pub Regulars | at the bar ? |
| Corner Table | — |
| Notice Board | by the door ? |

**Buck's Row**
| Object | Note |
|---|---|
| Cobblestone Roadway | — |
| Warehouse Doors | along the row |
| Street Lamps | along the row |

**Hanbury Street**
| Object | Note |
|---|---|
| Wooden Fence | round the yard |
| Yard Steps | down into the yard ? |
| Ground (Body Discovery Site) | in the yard |

## Act 3
**Dutfield's Yard**
| Object | Note |
|---|---|
| Yard Entrance Gate | — |
| Cart Path | through the gate |
| Club Doorway | beside the yard |

**International Working Men's Club**
| Object | Note |
|---|---|
| Tables | about the room |
| Posters | on the walls |
| Newspapers | on the walls |
| Club Members | at the tables ? |

**Mitre Square**
| Object | Note |
|---|---|
| Dark Alleyways | off the square |
| Square Walls | — |
| Police Lanterns | at the entrances ? |

**Goulston Street**
| Object | Note |
|---|---|
| Graffiti Wall | above the spot |
| Apron Fragment Location | at the foot of the wall |

## Act 4: George Lusk's Office
| Object | Note |
|---|---|
| Parcel Box | on the desk ? |
| The From Hell Letter | on the desk |
| The Kidney Parcel | in the parcel box ? |

## Act 5: Dr. Bond's Office
| Object | Note |
|---|---|
| Forensic Examination Reports | stacked on the desk |
| Anatomical Textbooks | on the shelves ? |
| Specimen Jars | on the shelves ? |
| Assistant's Forensic Note | by the window |

## Act 6: The Private Asylum
| Object | Note |
|---|---|
| Patient Records | in the superintendent's office ? |
| Patient's Room | down the corridor ? |

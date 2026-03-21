
export interface GameHistoryItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export interface DispositionStats {
  trust: number;
  annoyance: number;
}

export interface GameDispositions {
  holmes: DispositionStats;
  abberline: DispositionStats;
  bond: DispositionStats;
  edmund: DispositionStats;
  lusk: DispositionStats;
}

export interface GameState {
  history: GameHistoryItem[];
  location: string;
  inventory: string[];
  sanity: number;
  disposition: GameDispositions;
  flags: Record<string, boolean>;
  journalNotes: string;
  timestamp: string;
}

export interface WorldLocation {
  name: string;
  shortName?: string;
  atmosphere: string;
  description: string;
  exits: string[];
  interactables: string[];
  keyClues: string[];
  criticalPathLead: string;
}

export interface GameResponse {
  thoughtProcess?: string;
  markdownOutput: string;
  newLocationId?: string;
  inventoryUpdate?: {
    add?: string[];
    remove?: string[];
  };
  dispositionUpdate?: {
    [key in keyof GameDispositions]?: Partial<DispositionStats>;
  };
  flagsUpdate?: Record<string, boolean>;
  sanityUpdate?: number;
  gameOver?: boolean;
}

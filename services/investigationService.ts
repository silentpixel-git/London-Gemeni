
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  writeBatch,
  Timestamp,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { 
  Investigation, 
  LocationState, 
  NPCState, 
  Clue, 
  LogEntry, 
  GameState,
  InvestigationStatus
} from '../types';

const INVESTIGATIONS_COLLECTION = 'investigations';
const SAVES_COLLECTION = 'saves';

export class InvestigationService {
  /**
   * Gets the most recent active investigation for the current user.
   */
  static async getActiveInvestigation(userId: string): Promise<Investigation | null> {
    try {
      const q = query(
        collection(db, INVESTIGATIONS_COLLECTION),
        where('ownerId', '==', userId),
        where('status', '==', 'active'),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Investigation;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, INVESTIGATIONS_COLLECTION);
      return null;
    }
  }

  /**
   * Starts a new investigation.
   */
  static async startNewInvestigation(userId: string, initialData: Partial<Investigation>): Promise<Investigation> {
    try {
      const investigationRef = doc(collection(db, INVESTIGATIONS_COLLECTION));
      const now = new Date().toISOString();
      
      const newInvestigation: Investigation = {
        id: investigationRef.id,
        ownerId: userId,
        status: 'active',
        currentLocation: initialData.currentLocation || 'miller_court',
        sanity: initialData.sanity ?? 100,
        medicalPoints: initialData.medicalPoints || 0,
        moralPoints: initialData.moralPoints || 0,
        globalFlags: initialData.globalFlags || {},
        journalNotes: initialData.journalNotes || '',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(investigationRef, newInvestigation);
      return newInvestigation;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, INVESTIGATIONS_COLLECTION);
      throw error;
    }
  }

  /**
   * Migrates an old save blob to the new granular structure.
   */
  static async migrateOldSave(userId: string, oldSave: GameState): Promise<Investigation> {
    const batch = writeBatch(db);
    const investigationRef = doc(collection(db, INVESTIGATIONS_COLLECTION));
    const now = new Date().toISOString();

    const investigation: Investigation = {
      id: investigationRef.id,
      ownerId: userId,
      status: 'active',
      currentLocation: oldSave.location,
      sanity: oldSave.sanity,
      medicalPoints: 0,
      moralPoints: 0,
      globalFlags: oldSave.flags,
      journalNotes: oldSave.journalNotes,
      createdAt: now,
      updatedAt: now,
    };

    batch.set(investigationRef, investigation);

    // Migrate History to Log
    oldSave.history.forEach((item, index) => {
      const logRef = doc(collection(db, `${INVESTIGATIONS_COLLECTION}/${investigation.id}/log`));
      const logEntry: LogEntry = {
        id: logRef.id,
        timestamp: new Date(Date.now() - (oldSave.history.length - index) * 1000).toISOString(),
        type: item.role === 'user' ? 'action' : 'narration',
        content: item.text,
      };
      batch.set(logRef, logEntry);
    });

    // Mark old save as migrated
    const oldSaveRef = doc(db, SAVES_COLLECTION, `${userId}_latest`);
    batch.update(oldSaveRef, { isMigrated: true, migratedTo: investigation.id });

    try {
      await batch.commit();
      return investigation;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'migration_batch');
      throw error;
    }
  }

  /**
   * Fetches the recent log entries for an investigation.
   */
  static async getRecentLogs(investigationId: string, limitCount = 20): Promise<LogEntry[]> {
    try {
      const q = query(
        collection(db, `${INVESTIGATIONS_COLLECTION}/${investigationId}/log`),
        orderBy('timestamp', 'asc') // We want them in order for the UI
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `${INVESTIGATIONS_COLLECTION}/${investigationId}/log`);
      return [];
    }
  }

  /**
   * Adds a new log entry.
   */
  static async addLogEntry(investigationId: string, entry: Omit<LogEntry, 'id'>): Promise<void> {
    try {
      const logRef = doc(collection(db, `${INVESTIGATIONS_COLLECTION}/${investigationId}/log`));
      await setDoc(logRef, { ...entry, id: logRef.id });
      
      // Update investigation timestamp
      const investigationRef = doc(db, INVESTIGATIONS_COLLECTION, investigationId);
      await setDoc(investigationRef, { updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${INVESTIGATIONS_COLLECTION}/${investigationId}/log`);
    }
  }

  /**
   * Updates investigation state.
   */
  static async updateInvestigation(investigationId: string, updates: Partial<Investigation>): Promise<void> {
    try {
      const investigationRef = doc(db, INVESTIGATIONS_COLLECTION, investigationId);
      await setDoc(investigationRef, { ...updates, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${INVESTIGATIONS_COLLECTION}/${investigationId}`);
    }
  }

  /**
   * Upserts state for a location.
   */
  static async upsertLocationState(investigationId: string, locationId: string, updates: Partial<LocationState>): Promise<void> {
    try {
      const locRef = doc(db, `${INVESTIGATIONS_COLLECTION}/${investigationId}/locations`, locationId);
      await setDoc(locRef, { ...updates, locationId, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${INVESTIGATIONS_COLLECTION}/${investigationId}/locations/${locationId}`);
    }
  }

  /**
   * Gets state for a location.
   */
  static async getLocationState(investigationId: string, locationId: string): Promise<LocationState | null> {
    try {
      const locRef = doc(db, `${INVESTIGATIONS_COLLECTION}/${investigationId}/locations`, locationId);
      const snap = await getDoc(locRef);
      return snap.exists() ? snap.data() as LocationState : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${INVESTIGATIONS_COLLECTION}/${investigationId}/locations/${locationId}`);
      return null;
    }
  }

  /**
   * Upserts state for an NPC.
   */
  static async upsertNPCState(investigationId: string, npcId: string, updates: Partial<NPCState>): Promise<void> {
    try {
      const npcRef = doc(db, `${INVESTIGATIONS_COLLECTION}/${investigationId}/npcs`, npcId);
      await setDoc(npcRef, { ...updates, npcId, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${INVESTIGATIONS_COLLECTION}/${investigationId}/npcs/${npcId}`);
    }
  }

  /**
   * Gets state for an NPC.
   */
  static async getNPCState(investigationId: string, npcId: string): Promise<NPCState | null> {
    try {
      const npcRef = doc(db, `${INVESTIGATIONS_COLLECTION}/${investigationId}/npcs`, npcId);
      const snap = await getDoc(npcRef);
      return snap.exists() ? snap.data() as NPCState : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${INVESTIGATIONS_COLLECTION}/${investigationId}/npcs/${npcId}`);
      return null;
    }
  }

  /**
   * Adds a discovered clue.
   */
  static async addClue(investigationId: string, clue: Clue): Promise<void> {
    try {
      const clueRef = doc(db, `${INVESTIGATIONS_COLLECTION}/${investigationId}/clues`, clue.clueId);
      await setDoc(clueRef, { ...clue, discoveredAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${INVESTIGATIONS_COLLECTION}/${investigationId}/clues/${clue.clueId}`);
    }
  }

  /**
   * Gets all discovered clues.
   */
  static async getClues(investigationId: string): Promise<Clue[]> {
    try {
      const q = query(collection(db, `${INVESTIGATIONS_COLLECTION}/${investigationId}/clues`), orderBy('discoveredAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => doc.data() as Clue);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `${INVESTIGATIONS_COLLECTION}/${investigationId}/clues`);
      return [];
    }
  }
}

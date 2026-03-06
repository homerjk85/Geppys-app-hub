import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AppManifest } from '../types';

interface GeppyDB extends DBSchema {
  apps: {
    key: string;
    value: AppManifest;
    indexes: { 'by-updated': number };
  };
  archives: {
    key: string;
    value: any;
  };
  styleManifests: {
    key: string;
    value: any;
  };
  snapshots: {
    key: string;
    value: { id: string; appId: string; timestamp: number; manifest: AppManifest };
    indexes: { 'by-appId': string };
  };
}

const DB_NAME = 'geppy-hub-db';
const DB_VERSION = 2; // Incremented version for new store

let dbPromise: Promise<IDBPDatabase<GeppyDB>>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<GeppyDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('apps')) {
          const appStore = db.createObjectStore('apps', { keyPath: 'id' });
          appStore.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('archives')) {
          db.createObjectStore('archives', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('styleManifests')) {
          db.createObjectStore('styleManifests', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id' });
          snapshotStore.createIndex('by-appId', 'appId');
        }
      },
    });
  }
  return dbPromise;
};

export const storageService = {
  async getAllApps(): Promise<AppManifest[]> {
    const db = await initDB();
    return db.getAllFromIndex('apps', 'by-updated');
  },

  async getApp(id: string): Promise<AppManifest | undefined> {
    const db = await initDB();
    return db.get('apps', id);
  },

  async saveApp(app: AppManifest): Promise<void> {
    const db = await initDB();
    
    // Check if the app already exists to create a snapshot
    const existingApp = await db.get('apps', app.id);
    if (existingApp) {
      const snapshotId = `${app.id}_${Date.now()}`;
      await db.put('snapshots', {
        id: snapshotId,
        appId: app.id,
        timestamp: Date.now(),
        manifest: existingApp
      });
    }

    await db.put('apps', app);
  },

  async getSnapshots(appId: string): Promise<{ id: string; appId: string; timestamp: number; manifest: AppManifest }[]> {
    const db = await initDB();
    const snapshots = await db.getAllFromIndex('snapshots', 'by-appId', appId);
    return snapshots.sort((a, b) => b.timestamp - a.timestamp); // Sort descending
  },

  async deleteApp(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('apps', id);
    
    // Delete associated snapshots
    const snapshots = await db.getAllFromIndex('snapshots', 'by-appId', id);
    const tx = db.transaction('snapshots', 'readwrite');
    for (const snapshot of snapshots) {
      await tx.store.delete(snapshot.id);
    }
    await tx.done;
  },

  async getStorageUsage(): Promise<number> {
    // Estimate storage usage by calculating size of all data
    const db = await initDB();
    const apps = await db.getAll('apps');
    const archives = await db.getAll('archives');
    const styles = await db.getAll('styleManifests');
    const snapshots = await db.getAll('snapshots');
    
    const size = new Blob([JSON.stringify({ apps, archives, styles, snapshots })]).size;
    return size;
  },

  async saveArchive(id: string, file: Blob): Promise<void> {
    const db = await initDB();
    // Since we created the store with { keyPath: 'id' }, we must pass an object containing the ID
    await db.put('archives', { id, file });
  },

  async getArchive(id: string): Promise<Blob | undefined> {
    const db = await initDB();
    const result = await db.get('archives', id);
    return result?.file;
  }
};

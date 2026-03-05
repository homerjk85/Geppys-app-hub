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
}

const DB_NAME = 'geppy-hub-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GeppyDB>>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<GeppyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
    await db.put('apps', app);
  },

  async deleteApp(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('apps', id);
  },

  async getStorageUsage(): Promise<number> {
    // Estimate storage usage by calculating size of all data
    const db = await initDB();
    const apps = await db.getAll('apps');
    const archives = await db.getAll('archives');
    const styles = await db.getAll('styleManifests');
    
    const size = new Blob([JSON.stringify({ apps, archives, styles })]).size;
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

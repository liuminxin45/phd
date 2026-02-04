type StoredValue = any;

type StorageSetOptions = {
  prefer?: 'electron' | 'idb' | 'localStorage';
};

type StorageGetOptions = {
  prefer?: 'electron' | 'idb' | 'localStorage';
};

const DB_NAME = 'phabdash';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const LS_PREFIX = 'phabdash:';

let dbPromise: Promise<IDBDatabase> | null = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

function hasElectronStorage() {
  return isBrowser() && !!window.phabdash?.storage;
}

async function electronGet<T>(key: string): Promise<T | undefined> {
  if (!hasElectronStorage()) return undefined;
  try {
    return await window.phabdash!.storage!.get<T>(key);
  } catch {
    return undefined;
  }
}

async function electronSet<T>(key: string, value: T): Promise<boolean> {
  if (!hasElectronStorage()) return false;
  try {
    await window.phabdash!.storage!.set(key, value);
    return true;
  } catch {
    return false;
  }
}

async function electronDelete(key: string): Promise<boolean> {
  if (!hasElectronStorage()) return false;
  try {
    await window.phabdash!.storage!.delete(key);
    return true;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error('IndexedDB is not available on the server'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });

  return dbPromise;
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error || new Error('IndexedDB get failed'));
      })
  );
}

function idbSet<T>(key: string, value: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value as StoredValue, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error('IndexedDB set failed'));
      })
  );
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error('IndexedDB delete failed'));
      })
  );
}

function lsKey(key: string) {
  return `${LS_PREFIX}${key}`;
}

function lsGet<T>(key: string): T | undefined {
  if (!isBrowser()) return undefined;
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function lsSet<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  localStorage.setItem(lsKey(key), JSON.stringify(value));
}

function lsDelete(key: string): void {
  if (!isBrowser()) return;
  localStorage.removeItem(lsKey(key));
}

async function tryIdb<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    throw new Error('idb_failed');
  }
}

export const appStorage = {
  async get<T>(key: string, options?: StorageGetOptions): Promise<T | undefined> {
    if (!isBrowser()) return undefined;

    const prefer = options?.prefer;

    if (prefer === 'localStorage') {
      return lsGet<T>(key);
    }

    // Prefer Electron file storage when available (stores in user data directory)
    if (hasElectronStorage() && prefer !== 'idb') {
      const result = await electronGet<T>(key);
      if (result !== undefined) return result;
    }

    try {
      return await idbGet<T>(key);
    } catch {
      return lsGet<T>(key);
    }
  },

  async set<T>(key: string, value: T, options?: StorageSetOptions): Promise<void> {
    if (!isBrowser()) return;

    const prefer = options?.prefer;

    if (prefer === 'localStorage') {
      lsSet(key, value);
      return;
    }

    // Prefer Electron file storage when available (stores in user data directory)
    if (hasElectronStorage() && prefer !== 'idb') {
      const success = await electronSet(key, value);
      if (success) return;
    }

    try {
      await idbSet(key, value);
    } catch {
      lsSet(key, value);
    }
  },

  async delete(key: string): Promise<void> {
    if (!isBrowser()) return;

    // Try Electron storage first
    if (hasElectronStorage()) {
      const success = await electronDelete(key);
      if (success) return;
    }

    try {
      await idbDelete(key);
    } catch {
      lsDelete(key);
    }
  },

  // Expose low-level helpers for large/binary payloads (prefer IndexedDB)
  async getBinary(key: string): Promise<Blob | ArrayBuffer | undefined> {
    return this.get<Blob | ArrayBuffer>(key, { prefer: 'idb' });
  },

  async setBinary(key: string, value: Blob | ArrayBuffer): Promise<void> {
    if (!isBrowser()) return;

    try {
      await idbSet(key, value);
    } catch {
      throw new Error('Binary storage requires IndexedDB support');
    }
  },
};

"use client";

// Minimale IndexedDB-opslag voor offline herhalen. Twee stores:
// - "snapshot": de wachtrij van vandaag en de voortgang (één record per gebruiker)
// - "outbox": beoordelingen die nog naar de server moeten, in volgorde
const DB_NAME = "pa-studie";
const VERSION = 1;

export type OutboxItem = {
  /** cardId + reviewedAt: uniek, en gelijk aan de idempotentiesleutel van rate_card. */
  key: string;
  createdAt: number;
  payload: {
    cardId: string;
    rating: 1 | 2 | 3 | 4;
    reviewedAt: string;
    durationMs: number | null;
    answerText: string | null;
    sessionId: string;
    aiFeedback?: string | null;
  };
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshot")) db.createObjectStore("snapshot");
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => {
      db.close();
      resolve(req ? req.result : undefined);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}

export const available = () => typeof indexedDB !== "undefined";

export async function saveSnapshot<T>(value: T) {
  if (!available()) return;
  await tx("snapshot", "readwrite", (s) => s.put(value, "today")).catch(() => undefined);
}

export async function loadSnapshot<T>(): Promise<T | undefined> {
  if (!available()) return undefined;
  return tx<T>("snapshot", "readonly", (s) => s.get("today") as IDBRequest<T>).catch(() => undefined);
}

// Zonder IndexedDB (zeldzaam) blijft de rij in het geheugen; dan overleeft hij geen herlaadbeurt.
const memory = new Map<string, OutboxItem>();

export async function outboxAdd(item: OutboxItem) {
  if (!available()) return void memory.set(item.key, item);
  await tx("outbox", "readwrite", (s) => s.put(item)).catch(() => void memory.set(item.key, item));
}

export async function outboxAll(): Promise<OutboxItem[]> {
  if (!available()) return [...memory.values()].sort((a, b) => a.createdAt - b.createdAt);
  const items = (await tx<OutboxItem[]>("outbox", "readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>).catch(() => [])) ?? [];
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function outboxRemove(key: string) {
  memory.delete(key);
  if (!available()) return;
  await tx("outbox", "readwrite", (s) => s.delete(key));
}

/** Bij uitloggen: alles wissen, zodat er geen studiedata op het apparaat achterblijft. */
export async function clearAll() {
  if (!available()) return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

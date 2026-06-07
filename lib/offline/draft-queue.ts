"use client";

export type OfflineDraftAction = {
  id: string;
  actionType: "TAB_DRAFT" | "RETAIL_DRAFT" | "NOTE_DRAFT";
  payload: Record<string, unknown>;
  createdAt: string;
  status: "DRAFT_NOT_POSTED" | "SYNCED" | "FAILED";
};

const DB_NAME = "gamex-pos-offline";
const STORE_NAME = "draft-actions";
const DB_VERSION = 1;

export function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveDraftAction(
  draft: OfflineDraftAction,
): Promise<void> {
  const db = await openDraftDatabase();
  await withStore(db, "readwrite", (store) => store.put(draft));
  db.close();
}

export async function listDraftActions(): Promise<OfflineDraftAction[]> {
  const db = await openDraftDatabase();
  const drafts = await withStore<OfflineDraftAction[]>(
    db,
    "readonly",
    (store) => store.getAll(),
  );
  db.close();
  return drafts;
}

function withStore<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = run(transaction.objectStore(STORE_NAME));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

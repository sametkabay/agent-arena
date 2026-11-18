import type { UserAssetBackend } from "@/lib/userAssets/backend";
import {
  UserAssetError,
  classifyUserAssetError,
} from "@/lib/userAssets/errors";
import type {
  UserAssetBlobRecord,
  UserAssetKind,
  UserAssetMeta,
} from "@/lib/userAssets/types";

export const USER_ASSETS_DB = "agent-arena-user-assets";
export const USER_ASSETS_VERSION = 1;
export const META_STORE = "meta";
export const BLOBS_STORE = "blobs";

type IDBFactoryLike = IDBFactory;

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
  });
}

function openDb(factory: IDBFactoryLike): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(USER_ASSETS_DB, USER_ASSETS_VERSION);
    } catch (err) {
      reject(classifyUserAssetError(err));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        const meta = db.createObjectStore(META_STORE, { keyPath: "id" });
        meta.createIndex("kind", "kind", { unique: false });
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      reject(classifyUserAssetError(req.error));
    };
    req.onblocked = () => {
      reject(new UserAssetError("unavailable", "idb blocked"));
    };
  });
}

async function withDb<T>(
  factory: IDBFactoryLike,
  fn: (db: IDBDatabase) => Promise<T>,
): Promise<T> {
  if (typeof factory === "undefined" || factory == null) {
    throw new UserAssetError("unavailable", "indexedDB missing");
  }
  let db: IDBDatabase;
  try {
    db = await openDb(factory);
  } catch (err) {
    throw classifyUserAssetError(err);
  }
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(classifyUserAssetError(tx.error));
    tx.onabort = () => {
      const err = tx.error;
      if (err) reject(classifyUserAssetError(err));
      else reject(new UserAssetError("aborted"));
    };
  });
}

export function createIdbBackend(
  factory: IDBFactoryLike | null | undefined = globalThis.indexedDB,
): UserAssetBackend {
  const fac = factory as IDBFactoryLike;

  return {
    async getMeta(id) {
      return withDb(fac, async (db) => {
        const tx = db.transaction(META_STORE, "readonly");
        const store = tx.objectStore(META_STORE);
        const meta = await reqToPromise(store.get(id));
        await txDone(tx);
        return (meta as UserAssetMeta) ?? null;
      });
    },

    async listMeta(kind?: UserAssetKind) {
      return withDb(fac, async (db) => {
        const tx = db.transaction(META_STORE, "readonly");
        const store = tx.objectStore(META_STORE);
        let req: IDBRequest;
        if (kind) {
          req = store.index("kind").getAll(kind);
        } else {
          req = store.getAll();
        }
        const rows = (await reqToPromise(req)) as UserAssetMeta[];
        await txDone(tx);
        return rows ?? [];
      });
    },

    async getFiles(id) {
      return withDb(fac, async (db) => {
        const tx = db.transaction(BLOBS_STORE, "readonly");
        const store = tx.objectStore(BLOBS_STORE);
        const row = (await reqToPromise(
          store.get(id),
        )) as UserAssetBlobRecord | null;
        await txDone(tx);
        return row?.files ?? null;
      });
    },

    async put(meta, files) {
      return withDb(fac, async (db) => {
        const tx = db.transaction([META_STORE, BLOBS_STORE], "readwrite");
        try {
          tx.objectStore(META_STORE).put(meta);
          const blobRec: UserAssetBlobRecord = { id: meta.id, files };
          tx.objectStore(BLOBS_STORE).put(blobRec);
          await txDone(tx);
        } catch (err) {
          try {
            tx.abort();
          } catch {
            /* ignore */
          }
          throw classifyUserAssetError(err);
        }
      });
    },

    async putMeta(meta) {
      return withDb(fac, async (db) => {
        const tx = db.transaction(META_STORE, "readwrite");
        try {
          tx.objectStore(META_STORE).put(meta);
          await txDone(tx);
        } catch (err) {
          throw classifyUserAssetError(err);
        }
      });
    },

    async remove(id) {
      return withDb(fac, async (db) => {
        const tx = db.transaction([META_STORE, BLOBS_STORE], "readwrite");
        try {
          tx.objectStore(META_STORE).delete(id);
          tx.objectStore(BLOBS_STORE).delete(id);
          await txDone(tx);
        } catch (err) {
          throw classifyUserAssetError(err);
        }
      });
    },
  };
}

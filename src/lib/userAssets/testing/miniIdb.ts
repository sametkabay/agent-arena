/**
 * Minimal in-memory IDBFactory fake for unit tests (no fake-indexeddb dep).
 * Supports open/upgrade, object stores, indexes (get/getAll/put/delete),
 * readwrite transactions, abort, and injected QuotaExceededError on put.
 */

type StoreData = Map<string, unknown>;

interface MiniDb {
  name: string;
  version: number;
  stores: Map<
    string,
    { keyPath: string; data: StoreData; indexes: Map<string, string> }
  >;
}

export interface MiniIdbOptions {
  /** Throw QuotaExceededError on the Nth put (1-based). */
  quotaOnPut?: number;
  /** Fail open with this error name. */
  openError?: string;
}

type ReqHandlers = {
  onsuccess: ((ev: Event) => unknown) | null;
  onerror: ((ev: Event) => unknown) | null;
};

function makeRequest<T>(): IDBRequest<T> & {
  _succeed: (value: T) => void;
  _fail: (err: DOMException) => void;
} {
  const handlers: ReqHandlers = { onsuccess: null, onerror: null };
  const req = {
    result: undefined as unknown as T,
    error: null as DOMException | null,
    readyState: "pending" as IDBRequestReadyState,
    source: null as unknown as IDBObjectStore,
    transaction: null as IDBTransaction | null,
    get onsuccess() {
      return handlers.onsuccess as IDBRequest<T>["onsuccess"];
    },
    set onsuccess(fn: IDBRequest<T>["onsuccess"]) {
      handlers.onsuccess = fn as ((ev: Event) => unknown) | null;
    },
    get onerror() {
      return handlers.onerror as IDBRequest<T>["onerror"];
    },
    set onerror(fn: IDBRequest<T>["onerror"]) {
      handlers.onerror = fn as ((ev: Event) => unknown) | null;
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
    _succeed(value: T) {
      req.result = value;
      req.readyState = "done";
      Promise.resolve().then(() => handlers.onsuccess?.(new Event("success")));
    },
    _fail(err: DOMException) {
      req.error = err;
      req.readyState = "done";
      Promise.resolve().then(() => handlers.onerror?.(new Event("error")));
    },
  };
  return req as IDBRequest<T> & {
    _succeed: (value: T) => void;
    _fail: (err: DOMException) => void;
  };
}

class MiniIndex {
  constructor(
    private store: MiniObjectStore,
    private keyPath: string,
  ) {}

  getAll(query?: IDBValidKey): IDBRequest {
    const req = makeRequest<unknown[]>();
    const rows = [...this.store._data.values()].filter((row) => {
      if (query === undefined) return true;
      return (row as Record<string, unknown>)[this.keyPath] === query;
    });
    req._succeed(rows);
    return req;
  }

  get(query: IDBValidKey): IDBRequest {
    const req = makeRequest<unknown>();
    const row = [...this.store._data.values()].find(
      (r) => (r as Record<string, unknown>)[this.keyPath] === query,
    );
    req._succeed(row ?? undefined);
    return req;
  }
}

class MiniObjectStore {
  _data: StoreData;
  private indexes: Map<string, string>;

  constructor(
    public name: string,
    public keyPath: string,
    data: StoreData,
    indexes: Map<string, string>,
    private tx: MiniTransaction | null,
  ) {
    this._data = data;
    this.indexes = indexes;
  }

  createIndex(name: string, keyPath: string) {
    this.indexes.set(name, keyPath);
    return new MiniIndex(this, keyPath);
  }

  index(name: string) {
    const kp = this.indexes.get(name);
    if (!kp) throw new DOMException(`index ${name}`, "NotFoundError");
    return new MiniIndex(this, kp);
  }

  get(key: IDBValidKey): IDBRequest {
    const req = makeRequest<unknown>();
    req._succeed(this._data.get(String(key)) ?? undefined);
    return req;
  }

  getAll(): IDBRequest {
    const req = makeRequest<unknown[]>();
    req._succeed([...this._data.values()]);
    return req;
  }

  put(value: unknown): IDBRequest {
    const req = makeRequest<IDBValidKey>();
    if (this.tx && this.tx._quotaLeft != null) {
      this.tx._quotaLeft -= 1;
      if (this.tx._quotaLeft <= 0) {
        const err = new DOMException("quota", "QuotaExceededError");
        this.tx._abortWith(err);
        req._fail(err);
        return req;
      }
    }
    const key = String((value as Record<string, unknown>)[this.keyPath]);
    this.tx?._recordMutation(this.name, key, this._data.get(key));
    this._data.set(key, value);
    req._succeed(key);
    return req;
  }

  delete(key: IDBValidKey): IDBRequest {
    const req = makeRequest<undefined>();
    const k = String(key);
    this.tx?._recordMutation(this.name, k, this._data.get(k));
    this._data.delete(k);
    req._succeed(undefined);
    return req;
  }
}

class MiniTransaction {
  mode: IDBTransactionMode = "readonly";
  db: IDBDatabase;
  error: DOMException | null = null;
  objectStoreNames: DOMStringList;
  oncomplete: ((this: IDBTransaction, ev: Event) => unknown) | null = null;
  onerror: ((this: IDBTransaction, ev: Event) => unknown) | null = null;
  onabort: ((this: IDBTransaction, ev: Event) => unknown) | null = null;
  durability: IDBTransactionDurability = "default";
  _quotaLeft: number | null;
  private aborted = false;
  private stores: Map<string, MiniObjectStore>;
  private mini: MiniDb;
  /** Reverse-order undo log: restore prior value (or delete if undefined). */
  private undo: { store: string; key: string; prev: unknown }[] = [];

  constructor(
    mini: MiniDb,
    storeNames: string[],
    mode: IDBTransactionMode,
    quotaOnPut: number | undefined,
    db: IDBDatabase,
  ) {
    this.mini = mini;
    this.db = db;
    this.mode = mode;
    this._quotaLeft = quotaOnPut ?? null;
    this.objectStoreNames = storeNames as unknown as DOMStringList;
    this.stores = new Map();
    for (const name of storeNames) {
      const s = mini.stores.get(name);
      if (!s) throw new DOMException(name, "NotFoundError");
      this.stores.set(
        name,
        new MiniObjectStore(name, s.keyPath, s.data, s.indexes, this),
      );
    }
    setTimeout(() => {
      if (!this.aborted) {
        this.undo = [];
        this.oncomplete?.call(
          this as unknown as IDBTransaction,
          new Event("complete"),
        );
      }
    }, 0);
  }

  _recordMutation(store: string, key: string, prev: unknown) {
    this.undo.push({ store, key, prev });
  }

  private rollback() {
    for (let i = this.undo.length - 1; i >= 0; i--) {
      const m = this.undo[i]!;
      const data = this.mini.stores.get(m.store)?.data;
      if (!data) continue;
      if (m.prev === undefined) data.delete(m.key);
      else data.set(m.key, m.prev);
    }
    this.undo = [];
  }

  objectStore(name: string) {
    const s = this.stores.get(name);
    if (!s) throw new DOMException(name, "NotFoundError");
    return s as unknown as IDBObjectStore;
  }

  abort() {
    this.aborted = true;
    this.rollback();
    this.error = this.error ?? new DOMException("aborted", "AbortError");
    this.onabort?.call(this as unknown as IDBTransaction, new Event("abort"));
  }

  _abortWith(err: DOMException) {
    this.aborted = true;
    this.rollback();
    this.error = err;
    setTimeout(() => {
      this.onabort?.call(this as unknown as IDBTransaction, new Event("abort"));
    }, 0);
  }

  commit() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
}

class MiniDatabase {
  name: string;
  version: number;
  objectStoreNames: DOMStringList;
  onabort = null;
  onclose = null;
  onerror = null;
  onversionchange = null;

  constructor(
    private mini: MiniDb,
    private opts: MiniIdbOptions,
  ) {
    this.name = mini.name;
    this.version = mini.version;
    this.objectStoreNames = {
      contains: (n: string) => mini.stores.has(n),
      length: mini.stores.size,
      item: () => null,
    } as unknown as DOMStringList;
  }

  createObjectStore(
    name: string,
    optionalParameters?: IDBObjectStoreParameters,
  ) {
    const keyPath = String(optionalParameters?.keyPath ?? "id");
    const entry = {
      keyPath,
      data: new Map<string, unknown>(),
      indexes: new Map<string, string>(),
    };
    this.mini.stores.set(name, entry);
    this.objectStoreNames = {
      contains: (n: string) => this.mini.stores.has(n),
      length: this.mini.stores.size,
      item: () => null,
    } as unknown as DOMStringList;
    return new MiniObjectStore(
      name,
      keyPath,
      entry.data,
      entry.indexes,
      null,
    ) as unknown as IDBObjectStore;
  }

  deleteObjectStore(name: string) {
    this.mini.stores.delete(name);
  }

  transaction(storeNames: string | string[], mode?: IDBTransactionMode) {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new MiniTransaction(
      this.mini,
      names,
      mode ?? "readonly",
      this.opts.quotaOnPut,
      this as unknown as IDBDatabase,
    ) as unknown as IDBTransaction;
  }

  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
}

export function createMiniIdbFactory(opts: MiniIdbOptions = {}): IDBFactory {
  const dbs = new Map<string, MiniDb>();

  return {
    cmp: () => 0,
    databases: async () => [],
    deleteDatabase(name: string) {
      const req = makeRequest<undefined>();
      dbs.delete(name);
      req._succeed(undefined);
      return req as unknown as IDBOpenDBRequest;
    },
    open(name: string, version?: number) {
      const req = makeRequest<IDBDatabase>() as IDBRequest<IDBDatabase> & {
        _succeed: (v: IDBDatabase) => void;
        _fail: (e: DOMException) => void;
        onupgradeneeded: ((ev: IDBVersionChangeEvent) => unknown) | null;
        onblocked: ((ev: Event) => unknown) | null;
      };
      req.onupgradeneeded = null;
      req.onblocked = null;
      if (opts.openError) {
        const err = new DOMException(opts.openError, opts.openError);
        req._fail(err);
        return req as unknown as IDBOpenDBRequest;
      }
      const ver = version ?? 1;
      let db = dbs.get(name);
      const isNew = !db;
      if (!db) {
        db = { name, version: ver, stores: new Map() };
        dbs.set(name, db);
      }
      const database = new MiniDatabase(db, opts);
      setTimeout(() => {
        // IDB sets result before upgradeneeded so createObjectStore works.
        (req as { result: IDBDatabase }).result =
          database as unknown as IDBDatabase;
        if (isNew || (version != null && version > db!.version)) {
          db!.version = ver;
          req.onupgradeneeded?.(
            new Event("upgradeneeded") as IDBVersionChangeEvent,
          );
        }
        req._succeed(database as unknown as IDBDatabase);
      }, 0);
      return req as unknown as IDBOpenDBRequest;
    },
  } as IDBFactory;
}

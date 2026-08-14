if (typeof globalThis.window === "undefined") {
  Object.defineProperty(globalThis, "window", {
    value: globalThis,
    configurable: true,
  });
}

if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = () => {};
}

const mem = new Map<string, string>();

const localStorageMock: Storage = {
  getItem: (key: string) => mem.get(key) ?? null,
  setItem: (key: string, value: string) => {
    mem.set(key, String(value));
  },
  removeItem: (key: string) => {
    mem.delete(key);
  },
  clear: () => {
    mem.clear();
  },
  key: (index: number) => [...mem.keys()][index] ?? null,
  get length() {
    return mem.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

// Test environment shims so the browser-oriented modules (which use
// localStorage and touch the DOM inside functions) can run under Node.
// Imported first by every test file.

class MemStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

if (!globalThis.localStorage) {
  globalThis.localStorage = new MemStorage();
}

// firebase-sync's sync-status helper calls document.getElementById; a null
// return is handled gracefully, so a minimal shim is enough.
if (!globalThis.document) {
  globalThis.document = { getElementById: () => null };
}

export function resetStore() {
  globalThis.localStorage.clear();
}

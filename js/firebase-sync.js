// ============================================================
// firebase-sync.js — Firebase Realtime Database sync layer
// Writes go to both localStorage (instant) and Firebase (cloud).
// On page load, Firebase data is pulled and merged into localStorage.
// Requires Firebase Auth — data is scoped per-user under appData/{uid}/.
// ============================================================

import { FIREBASE_CONFIG } from './firebase-config.js';

// Firebase SDK globals (loaded via CDN in HTML)
let db = null;
let _ready = false;
let _readyPromise = null;
let _currentUser = null;

// Keys we sync to Firebase
const SYNC_KEYS = [
  'xp_students',
  'xp_log',
  'xp_config',
  'xp_daily_state',
  'xp_behavior_state',
  'xp_comments'
];

// Convert localStorage key to a Firebase-safe path (scoped per user)
function fbPath(key) {
  if (!_currentUser) throw new Error('Not authenticated');
  return 'appData/' + _currentUser.uid + '/' + key.replace(/[.#$/[\]]/g, '_');
}

// User data root
function userRoot() {
  if (!_currentUser) throw new Error('Not authenticated');
  return 'appData/' + _currentUser.uid;
}

// ── Authentication ──
export function signInWithEmail(email, password) {
  return firebase.auth().signInWithEmailAndPassword(email, password);
}

export function signUpWithEmail(email, password) {
  return firebase.auth().createUserWithEmailAndPassword(email, password);
}

export function resetPassword(email) {
  return firebase.auth().sendPasswordResetEmail(email);
}

export function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  // Try popup first, fall back to redirect on mobile/blocked popups
  return firebase.auth().signInWithPopup(provider).catch((err) => {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
      return firebase.auth().signInWithRedirect(provider);
    }
    throw err;
  });
}

export function signOut() {
  return firebase.auth().signOut();
}

export function onAuthChange(callback) {
  return firebase.auth().onAuthStateChanged(callback);
}

export function getCurrentUser() {
  return _currentUser;
}

// ── Initialize Firebase ──
export function initFirebase() {
  if (_readyPromise) return _readyPromise;

  _readyPromise = new Promise((resolve) => {
    try {
      // Check that Firebase SDK is loaded (from CDN)
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded — running in offline/localStorage mode');
        _ready = false;
        resolve(false);
        return;
      }

      // Initialize app if not already done
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      db = firebase.database();
      resolve(true);
    } catch (e) {
      console.error('Firebase init failed:', e);
      _ready = false;
      resolve(false);
    }
  });

  return _readyPromise;
}

// Call after auth succeeds to enable sync
export function setUser(user) {
  _currentUser = user;
  _ready = user != null && db != null;

  if (user) {
    // Clear localStorage if switching users OR first time using auth
    const lastUid = localStorage.getItem('xp_last_uid');
    if (lastUid !== user.uid) {
      for (const key of SYNC_KEYS) {
        localStorage.removeItem(key);
      }
      console.log('🔒 Cleared cached data — will pull from cloud');
    }
    localStorage.setItem('xp_last_uid', user.uid);
  }

  if (_ready) {
    // Test connection
    const connRef = firebase.database().ref('.info/connected');
    connRef.on('value', (snap) => {
      if (snap.val() === true) {
        console.log('🔥 Firebase connected');
        updateSyncStatus('connected');
      } else {
        console.log('⚡ Firebase disconnected — using localStorage');
        updateSyncStatus('offline');
      }
    });
  }
}

export function isReady() {
  return _ready && db !== null;
}

// ── Push a key's data to Firebase ──
export function pushToCloud(key, data) {
  if (!isReady()) return;
  try {
    db.ref(fbPath(key)).set(sanitizeKeys(data));
  } catch (e) {
    console.warn('Firebase push failed for', key, e);
  }
}

// ── Pull all data from Firebase into localStorage ──
export async function pullFromCloud() {
  if (!isReady()) return false;
  try {
    const snapshot = await db.ref(userRoot()).once('value');
    const cloudData = snapshot.val();
    if (!cloudData) {
      console.log('No cloud data found — starting fresh');
      return false;
    }

    // For each synced key, prefer cloud data over local
    let updated = false;
    for (const key of SYNC_KEYS) {
      const fbKey = key.replace(/[.#$/[\]]/g, '_');
      if (cloudData[fbKey] !== undefined && cloudData[fbKey] !== null) {
        const restored = unsanitizeKeys(cloudData[fbKey]);
        const cloudJson = JSON.stringify(restored);
        const localJson = localStorage.getItem(key);
        if (cloudJson !== localJson) {
          localStorage.setItem(key, cloudJson);
          updated = true;
        }
      }
    }

    // Migrate old lossy sanitized keys (e.g., "Jacob G_" → "Jacob G.")
    const migrated = migrateOldSanitizedKeys();

    if (updated) {
      console.log('☁️ Synced cloud data → localStorage');
    }
    // Re-push with new reversible encoding if old keys were migrated
    if (migrated) {
      pushAllToCloud();
    }
    return updated || migrated;
  } catch (e) {
    console.warn('Firebase pull failed:', e);
    return false;
  }
}

// Sanitize object keys recursively for Firebase (reversible encoding)
function sanitizeKeys(obj) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeKeys);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const safeKey = key
      .replace(/\./g, '__DOT__')
      .replace(/#/g, '__HASH__')
      .replace(/\$/g, '__DOLLAR__')
      .replace(/\//g, '__SLASH__')
      .replace(/\[/g, '__LBRACK__')
      .replace(/]/g, '__RBRACK__');
    result[safeKey] = sanitizeKeys(value);
  }
  return result;
}

// Reverse sanitizeKeys — restore original keys from Firebase
function unsanitizeKeys(obj) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(unsanitizeKeys);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const originalKey = key
      .replace(/__DOT__/g, '.')
      .replace(/__HASH__/g, '#')
      .replace(/__DOLLAR__/g, '$')
      .replace(/__SLASH__/g, '/')
      .replace(/__LBRACK__/g, '[')
      .replace(/__RBRACK__/g, ']');
    result[originalKey] = unsanitizeKeys(value);
  }
  return result;
}

// Migrate old lossy sanitized keys (e.g., "Jacob G_" → "Jacob G.") using student roster
function migrateOldSanitizedKeys() {
  try {
    const students = JSON.parse(localStorage.getItem('xp_students') || '[]');
    if (!students.length) return false;
    const stateKeys = ['xp_daily_state', 'xp_behavior_state'];
    let migrated = false;

    for (const key of stateKeys) {
      const state = JSON.parse(localStorage.getItem(key) || '{}');
      let changed = false;
      for (const student of students) {
        const name = student.name;
        const oldSanitized = name.replace(/[.#$/[\]]/g, '_');
        if (name !== oldSanitized && state[oldSanitized] && !state[name]) {
          state[name] = state[oldSanitized];
          delete state[oldSanitized];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(key, JSON.stringify(state));
        migrated = true;
      }
    }
    if (migrated) {
      console.log('🔄 Migrated old sanitized keys to correct student names');
    }
    return migrated;
  } catch (e) {
    console.warn('Key migration failed:', e);
    return false;
  }
}

// ── Push ALL localStorage data to Firebase (full upload) ──
export function pushAllToCloud() {
  if (!isReady()) return;
  const payload = {};
  for (const key of SYNC_KEYS) {
    const fbKey = key.replace(/[.#$/[\]]/g, '_');
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        payload[fbKey] = sanitizeKeys(JSON.parse(raw));
      }
    } catch (e) { /* skip corrupted keys */ }
  }
  db.ref(userRoot()).set(payload);
  console.log('⬆️ Pushed all data to Firebase');
}

// ── Listen for real-time updates from other devices ──
export function listenForChanges(onDataChanged) {
  if (!isReady()) return;
  for (const key of SYNC_KEYS) {
    const fbKey = key.replace(/[.#$/[\]]/g, '_');
    db.ref(userRoot() + '/' + fbKey).on('value', (snapshot) => {
      const cloudData = snapshot.val();
      if (cloudData === null || cloudData === undefined) return;
      const restored = unsanitizeKeys(cloudData);
      const cloudJson = JSON.stringify(restored);
      const localJson = localStorage.getItem(key);
      if (cloudJson !== localJson) {
        localStorage.setItem(key, cloudJson);
        if (onDataChanged) onDataChanged(key);
      }
    });
  }
}

// ── Remove a key from Firebase ──
export function removeFromCloud(key) {
  if (!isReady()) return;
  try {
    db.ref(fbPath(key)).remove();
  } catch (e) {
    console.warn('Firebase remove failed for', key, e);
  }
}

// ── Remove all data from Firebase ──
export function clearCloud() {
  if (!isReady()) return;
  db.ref(userRoot()).remove();
}

// ── Sync status indicator ──
function updateSyncStatus(status) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  switch (status) {
    case 'connected':
      el.innerHTML = '☁️ <span style="color:#2E7D32">Synced</span>';
      el.title = 'Connected to cloud — data syncs across devices';
      break;
    case 'offline':
      el.innerHTML = '💾 <span style="color:#F57F17">Local only</span>';
      el.title = 'Offline — changes saved locally, will sync when connected';
      break;
    case 'syncing':
      el.innerHTML = '🔄 <span style="color:#1565C0">Syncing...</span>';
      el.title = 'Syncing data with cloud...';
      break;
    default:
      el.innerHTML = '';
  }
}

export function showSyncing() {
  updateSyncStatus('syncing');
  setTimeout(() => {
    if (isReady()) updateSyncStatus('connected');
  }, 800);
}

// ── Migrate data to correct owner ──
// One-time: the data has already been moved in Firebase console.
// This just verifies the owner can read their data.
const ORIGINAL_OWNER_UID = '37OUwWYORqUMxnPga6EZzUOY1uZ2';

export async function migrateOldData() {
  // Migration is complete — data is already at appData/37OUw.../
  // This is now a no-op. Can be removed in a future cleanup.
  return;
}

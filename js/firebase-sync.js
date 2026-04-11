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
    db.ref(fbPath(key)).set(data);
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
      console.log('No cloud data found — uploading local data');
      pushAllToCloud();
      return false;
    }

    // For each synced key, prefer cloud data over local
    let updated = false;
    for (const key of SYNC_KEYS) {
      const fbKey = key.replace(/[.#$/[\]]/g, '_');
      if (cloudData[fbKey] !== undefined && cloudData[fbKey] !== null) {
        const cloudJson = JSON.stringify(cloudData[fbKey]);
        const localJson = localStorage.getItem(key);
        if (cloudJson !== localJson) {
          localStorage.setItem(key, cloudJson);
          updated = true;
        }
      }
    }

    if (updated) {
      console.log('☁️ Synced cloud data → localStorage');
    }
    return updated;
  } catch (e) {
    console.warn('Firebase pull failed:', e);
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
        payload[fbKey] = JSON.parse(raw);
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
      const cloudJson = JSON.stringify(cloudData);
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

// ── Migrate old flat appData/ to appData/{uid}/ ──
// One-time: moves unscoped data to the original owner's path and cleans up.
const ORIGINAL_OWNER_UID = '37OUwWYORqUMxnPga6EZzUOY1uZ2';

export async function migrateOldData() {
  if (!isReady()) return;
  try {
    // Read the entire appData node
    const rootSnap = await db.ref('appData').once('value');
    const rootData = rootSnap.val();
    if (!rootData) return;

    // Check if old flat keys still exist at appData/ level (not nested under a uid)
    const flatKeys = [];
    for (const key of SYNC_KEYS) {
      const fbKey = key.replace(/[.#$/[\]]/g, '_');
      if (rootData[fbKey] !== undefined) {
        flatKeys.push(fbKey);
      }
    }
    if (flatKeys.length === 0) return; // already migrated

    // Only the original owner gets the data
    if (_currentUser.uid === ORIGINAL_OWNER_UID) {
      // Check if owner already has scoped data
      const ownerData = rootData[ORIGINAL_OWNER_UID];
      if (!ownerData) {
        const payload = {};
        for (const fbKey of flatKeys) {
          payload[fbKey] = rootData[fbKey];
        }
        await db.ref(userRoot()).set(payload);
        console.log('📦 Migrated old data to owner path');
      }
    }

    // Delete the old flat keys (any authenticated user can trigger cleanup)
    const updates = {};
    for (const fbKey of flatKeys) {
      updates[fbKey] = null;
    }
    // Also remove any data incorrectly copied to non-owner users
    for (const nodeKey of Object.keys(rootData)) {
      if (nodeKey !== ORIGINAL_OWNER_UID && !flatKeys.includes(nodeKey)) {
        // This is a UID node that isn't the owner — check if it's an accidental copy
        if (nodeKey.length > 20) { // UIDs are long strings
          updates[nodeKey] = null;
        }
      }
    }
    await db.ref('appData').update(updates);
    console.log('🧹 Cleaned up old flat data and accidental copies');
  } catch (e) {
    console.warn('Migration failed:', e);
  }
}

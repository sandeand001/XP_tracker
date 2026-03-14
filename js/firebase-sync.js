// ============================================================
// firebase-sync.js — Firebase Realtime Database sync layer
// Writes go to both localStorage (instant) and Firebase (cloud).
// On page load, Firebase data is pulled and merged into localStorage.
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDyzjBqum1J9pCJCkNfYtfVbmDtoynyD5k",
  authDomain: "classroom-xp-tracker.firebaseapp.com",
  databaseURL: "https://classroom-xp-tracker-default-rtdb.firebaseio.com",
  projectId: "classroom-xp-tracker",
  storageBucket: "classroom-xp-tracker.firebasestorage.app",
  messagingSenderId: "439990199807",
  appId: "1:439990199807:web:ce429228dea71f1bf933ca"
};

// Firebase SDK globals (loaded via CDN in HTML)
let db = null;
let _ready = false;
let _readyPromise = null;

// Keys we sync to Firebase
const SYNC_KEYS = [
  'xp_students',
  'xp_log',
  'xp_config',
  'xp_daily_state',
  'xp_behavior_state',
  'xp_comments'
];

// Convert localStorage key to a Firebase-safe path
function fbPath(key) {
  return 'appData/' + key.replace(/[.#$/[\]]/g, '_');
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

      _ready = true;
      resolve(true);
    } catch (e) {
      console.error('Firebase init failed:', e);
      _ready = false;
      resolve(false);
    }
  });

  return _readyPromise;
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
    const snapshot = await db.ref('appData').once('value');
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
  db.ref('appData').set(payload);
  console.log('⬆️ Pushed all data to Firebase');
}

// ── Listen for real-time updates from other devices ──
export function listenForChanges(onDataChanged) {
  if (!isReady()) return;
  for (const key of SYNC_KEYS) {
    const fbKey = key.replace(/[.#$/[\]]/g, '_');
    db.ref('appData/' + fbKey).on('value', (snapshot) => {
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
  db.ref('appData').remove();
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

// ============================================================
// store.js — localStorage + Firebase cloud persistence
// ============================================================

import { pushToCloud, removeFromCloud, clearCloud, showSyncing } from './firebase-sync.js';

const KEYS = {
  STUDENTS: 'xp_students',
  XP_LOG: 'xp_log',
  CONFIG: 'xp_config',
  DAILY_STATE: 'xp_daily_state',
  BEHAVIOR_STATE: 'xp_behavior_state',
  COMMENTS: 'xp_comments',
};

// ── Generic helpers ──
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  // Also push to Firebase (non-blocking)
  pushToCloud(key, data);
  showSyncing();
}

// ── Students ──
export function getStudents() { return load(KEYS.STUDENTS, []); }
export function saveStudents(list) { save(KEYS.STUDENTS, list); }

export function addStudent(name, guild) {
  const students = getStudents();
  if (students.some(s => s.name === name)) return false;
  students.push({
    name,
    title: 'Sparkling Novice',
    cumXP: 0,
    level: 1,
    xpInLevel: 0,
    xpToNext: 100,
    progress: 0,
    xpDebt: 0,
    guild: guild || ''
  });
  saveStudents(students);
  return true;
}

export function removeStudent(name) {
  const students = getStudents().filter(s => s.name !== name);
  saveStudents(students);
}

export function updateStudent(name, updates) {
  const students = getStudents();
  const idx = students.findIndex(s => s.name === name);
  if (idx === -1) return;
  Object.assign(students[idx], updates);
  saveStudents(students);
}

// ── XP Log ──
export function getXPLog() { return load(KEYS.XP_LOG, []); }
export function saveXPLog(log) { save(KEYS.XP_LOG, log); }

export function appendXPLog(entry) {
  const log = getXPLog();
  log.push(entry);
  saveXPLog(log);
}

// Upsert: replace entries for (date, student) with new ones
export function upsertXPLogForDate(dateStr, entries) {
  let log = getXPLog();
  const namesSet = new Set(entries.map(e => e.student));
  // Remove existing entries for this date + these students
  log = log.filter(e => !(e.date === dateStr && namesSet.has(e.student)));
  log.push(...entries);
  saveXPLog(log);
}

export function clearXPLog() { saveXPLog([]); }

// ── Config ──
export function getConfig() {
  const { DEFAULT_CONFIG } = require_config();
  return load(KEYS.CONFIG, { ...DEFAULT_CONFIG });
}
export function saveConfig(cfg) { save(KEYS.CONFIG, cfg); }

// Lazy import workaround since this is a module
function require_config() {
  // We'll inline the defaults here to avoid circular deps
  return {
    DEFAULT_CONFIG: {
      XP_CAP: 50,
      EXCHANGE_RATE: 20,
      DAILY_WEIGHTS: {
        quiz: 10, faculty: 5, exitTicket: 5, writing: 5,
        kindness: 5, expectations: 10, participationEach: 2
      },
      BEHAVIOR_PENALTIES: {
        minor: -5, warning: -10, disrupt: -15,
        repeat: -20, serious: -25, severe: -30
      },
      TEST_SCORE_XP: { 0: 0, 1: 10, 2: 15, 3: 20, 4: 25 }
    }
  };
}

// ── Daily / Behavior State (for current day, pre-process) ──
export function getDailyState() { return load(KEYS.DAILY_STATE, {}); }
export function saveDailyState(state) { save(KEYS.DAILY_STATE, state); }
export function clearDailyState() {
  localStorage.removeItem(KEYS.DAILY_STATE);
  removeFromCloud(KEYS.DAILY_STATE);
}

export function getBehaviorState() { return load(KEYS.BEHAVIOR_STATE, {}); }
export function saveBehaviorState(state) { save(KEYS.BEHAVIOR_STATE, state); }
export function clearBehaviorState() {
  localStorage.removeItem(KEYS.BEHAVIOR_STATE);
  removeFromCloud(KEYS.BEHAVIOR_STATE);
}

// ── Comments ──
export function getComments() { return load(KEYS.COMMENTS, []); }
export function saveComments(c) { save(KEYS.COMMENTS, c); }

// ── Currency helpers (computed from XP Log) ──
export function getCurrencyBalances() {
  const log = getXPLog();
  const balances = {};
  for (const entry of log) {
    const name = entry.student;
    if (!name) continue;
    if (!balances[name]) balances[name] = { earned: 0, spent: 0 };
    const coins = Number(entry.currencyGain) || 0;
    if (coins > 0) balances[name].earned += coins;
    else if (coins < 0) balances[name].spent += Math.abs(coins);
  }
  return balances;
}

export function getSpendTransactions() {
  return getXPLog().filter(e => (Number(e.currencyGain) || 0) < 0).map(e => ({
    date: e.date,
    student: e.student,
    amount: Math.abs(e.currencyGain),
    note: e.dailyComment || 'Shop spend'
  }));
}

export function spendCoins(student, amount, note) {
  const balances = getCurrencyBalances();
  const bal = balances[student] || { earned: 0, spent: 0 };
  const available = bal.earned - bal.spent;
  if (available < amount) throw new Error(`Insufficient coins. Balance: ${available}, required: ${amount}`);
  const dateStr = todayStr();
  appendXPLog({
    date: dateStr,
    student,
    dailyTotalRaw: 0,
    debtApplied: 0,
    xpToLevel: 0,
    overflowXP: 0,
    currencyGain: -Math.abs(amount),
    debtAfter: 0,
    cumXPAfter: 0,
    levelAfter: 0,
    titleAfter: '',
    dailyComment: note || 'Shop spend',
    behaviorComment: ''
  });
  return available - amount;
}

// ── Full export / import ──
export function exportAllData() {
  return JSON.stringify({
    version: 1,
    students: getStudents(),
    xpLog: getXPLog(),
    config: getConfig(),
    comments: getComments(),
    exportedAt: new Date().toISOString()
  }, null, 2);
}

export function importAllData(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (data.students) saveStudents(data.students);
  if (data.xpLog) saveXPLog(data.xpLog);
  if (data.config) saveConfig(data.config);
  if (data.comments) saveComments(data.comments);
}

export function resetAllData() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  clearCloud();
}

// ── CSV Parsing ──
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',' || ch === '\t') { result.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

// Import students from XP Tracker CSV
export function importStudentsFromCSV(text) {
  const { headers, rows } = parseCSV(text);
  // Try to find columns by name (case-insensitive partial match)
  const find = (patterns) => {
    for (const p of patterns) {
      const idx = headers.findIndex(h => h.toLowerCase().includes(p.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iName = find(['name']);
  const iTitle = find(['title']);
  const iCumXP = find(['cumxp', 'cum xp', 'total xp', 'cumulative']);
  const iLevel = find(['level']);
  const iDebt = find(['debt']);
  const iGuild = find(['guild']);

  if (iName === -1) throw new Error('Could not find "Name" column in CSV');

  const students = [];
  for (const row of rows) {
    const name = (row[iName] || '').trim();
    if (!name) continue;
    students.push({
      name,
      title: iTitle !== -1 ? (row[iTitle] || 'Sparkling Novice') : 'Sparkling Novice',
      cumXP: iCumXP !== -1 ? (Number(row[iCumXP]) || 0) : 0,
      level: iLevel !== -1 ? (Number(row[iLevel]) || 1) : 1,
      xpInLevel: 0,
      xpToNext: 100,
      progress: 0,
      xpDebt: iDebt !== -1 ? (Number(row[iDebt]) || 0) : 0,
      guild: iGuild !== -1 ? (row[iGuild] || '') : ''
    });
  }
  saveStudents(students);
  return students.length;
}

// Import XP Log from CSV
export function importXPLogFromCSV(text) {
  const { headers, rows } = parseCSV(text);
  const find = (patterns) => {
    for (const p of patterns) {
      const idx = headers.findIndex(h => h.toLowerCase().includes(p.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iDate = find(['date']);
  const iStudent = find(['student', 'name']);
  const iRaw = find(['dailytotalraw', 'daily total', 'earned']);
  const iDebtApplied = find(['debtapplied', 'debt applied']);
  const iXPToLevel = find(['xptolevel', 'xp to level', 'xp applied']);
  const iOverflow = find(['overflow']);
  const iCoins = find(['currencygain', 'currency', 'coins']);
  const iDebtAfter = find(['debtafter', 'debt after']);
  const iCumXP = find(['cumxpafter', 'cum xp']);
  const iLevel = find(['levelafter', 'level']);
  const iTitle = find(['titleafter', 'title']);
  const iDailyComment = find(['dailycomment', 'daily comment']);
  const iBehaviorComment = find(['behaviorcomment', 'behavior comment']);

  if (iDate === -1 || iStudent === -1) throw new Error('Could not find Date/Student columns in CSV');

  const entries = [];
  for (const row of rows) {
    const date = (row[iDate] || '').trim();
    const student = (row[iStudent] || '').trim();
    if (!date || !student) continue;
    entries.push({
      date,
      student,
      dailyTotalRaw: iRaw !== -1 ? (Number(row[iRaw]) || 0) : 0,
      debtApplied: iDebtApplied !== -1 ? (Number(row[iDebtApplied]) || 0) : 0,
      xpToLevel: iXPToLevel !== -1 ? (Number(row[iXPToLevel]) || 0) : 0,
      overflowXP: iOverflow !== -1 ? (Number(row[iOverflow]) || 0) : 0,
      currencyGain: iCoins !== -1 ? (Number(row[iCoins]) || 0) : 0,
      debtAfter: iDebtAfter !== -1 ? (Number(row[iDebtAfter]) || 0) : 0,
      cumXPAfter: iCumXP !== -1 ? (Number(row[iCumXP]) || 0) : 0,
      levelAfter: iLevel !== -1 ? (Number(row[iLevel]) || 0) : 0,
      titleAfter: iTitle !== -1 ? (row[iTitle] || '') : '',
      dailyComment: iDailyComment !== -1 ? (row[iDailyComment] || '') : '',
      behaviorComment: iBehaviorComment !== -1 ? (row[iBehaviorComment] || '') : ''
    });
  }
  // Append to existing log
  const existing = getXPLog();
  saveXPLog([...existing, ...entries]);
  return entries.length;
}

// Export XP Log as CSV
export function exportXPLogAsCSV() {
  const log = getXPLog();
  const headers = ['Date','Student','DailyTotalRaw','DebtApplied','XPToLevel','OverflowXP',
    'CurrencyGain','DebtAfter','CumXPAfter','LevelAfter','TitleAfter','DailyComment','BehaviorComment'];
  const rows = log.map(e => [
    e.date, e.student, e.dailyTotalRaw, e.debtApplied, e.xpToLevel, e.overflowXP,
    e.currencyGain, e.debtAfter, e.cumXPAfter, e.levelAfter, e.titleAfter,
    `"${(e.dailyComment||'').replace(/"/g,'""')}"`, `"${(e.behaviorComment||'').replace(/"/g,'""')}"`
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// ── Helpers ──
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

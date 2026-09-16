// ============================================================
// engine.js — Core XP processing, level calcs, debt, coins
// ============================================================

import { computeLevelThresholds, computePrestigeTitles, BASE_TITLES, TITLE_BADGES, getStreakBadge } from './config.js';
import * as Store from './store.js';

// ── Level / Title helpers ──
export function getLevelThresholds() {
  return computeLevelThresholds(Store.getConfig().LEVEL_DIFFICULTY);
}

function getPrestigeTitles() {
  return computePrestigeTitles(Store.getConfig().LEVEL_DIFFICULTY);
}

export function getLevelFromXP(xp, thresholds = getLevelThresholds()) {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i]) return i + 1;
  }
  return 1;
}

export function getXPForLevel(level, thresholds = getLevelThresholds()) {
  if (level < 1 || level >= thresholds.length) return 0;
  return thresholds[level] - thresholds[level - 1];
}

export function determineTitle(cumXP, level, prestige = getPrestigeTitles()) {
  for (let i = prestige.length - 1; i >= 0; i--) {
    if (cumXP >= prestige[i].xp) return prestige[i].title;
  }
  return BASE_TITLES[level] || 'Adventurer';
}

export function getTitleBadge(title) {
  return TITLE_BADGES[title] || '';
}

// ── Compute daily total from checklist state ──
export function computeDailyTotal(state, cfg) {
  const w = cfg.DAILY_WEIGHTS;
  const testXP = cfg.TEST_SCORE_XP || {};
  let total = 0;

  // Test score — use String key lookup since JSON round-trip makes keys strings
  const testScore = state.test !== undefined && state.test !== null ? state.test : 0;
  total += Number(testXP[String(testScore)]) || Number(testXP[testScore]) || 0;

  // Checkboxes
  if (state.quiz) total += w.quiz;
  if (state.faculty) total += w.faculty;
  if (state.exitTicket) total += w.exitTicket;
  if (state.writing) total += w.writing;
  if (state.kindness) total += w.kindness;
  if (state.expectations) total += w.expectations;

  // Participation (5 parts)
  for (let i = 1; i <= 5; i++) {
    if (state[`part${i}`]) total += w.participationEach;
  }

  // Bonuses — checkbox means student gets the bonus, value is from header input
  if (state.bonusA) total += Number(state.bonusAVal) || 0;
  if (state.bonusB) total += Number(state.bonusBVal) || 0;
  if (state.bonusC) total += Number(state.bonusCVal) || 0;
  if (state.bonusD) total += Number(state.bonusDVal) || 0;

  return total;
}

// ── Compute behavior debt delta ──
export function computeBehaviorDebt(state, cfg) {
  const bp = cfg.BEHAVIOR_PENALTIES;
  let debt = 0;
  if (state.minor) debt += bp.minor;
  if (state.warning) debt += bp.warning;
  if (state.disrupt) debt += bp.disrupt;
  if (state.repeat) debt += bp.repeat;
  if (state.serious) debt += bp.serious;
  if (state.severe) debt += bp.severe;
  if (state.extraA) debt -= (Number(state.extraAVal) || 0);
  if (state.extraB) debt -= (Number(state.extraBVal) || 0);
  if (state.extraC) debt -= (Number(state.extraCVal) || 0);
  return debt; // negative number
}

// ── Build earned+minted totals before a date for carryover coin calculation ──
function getEarnedAndMintedBeforeDate(dateStr) {
  const log = Store.getXPLog();
  const out = {};
  for (const entry of log) {
    if (!entry.date || entry.date >= dateStr) continue;
    const nm = entry.student;
    if (!nm) continue;
    if (!out[nm]) out[nm] = { applied: 0, minted: 0 };
    out[nm].applied += Number(entry.xpToLevel) || 0;
    const cg = Number(entry.currencyGain) || 0;
    if (cg > 0) out[nm].minted += cg;
  }
  return out;
}

// ── Process Daily XP (the big one) ──
export function processDailyXP() {
  const cfg = Store.getConfig();
  const thresholds = computeLevelThresholds(cfg.LEVEL_DIFFICULTY);
  const prestige = computePrestigeTitles(cfg.LEVEL_DIFFICULTY);
  const students = Store.getStudents();
  const dailyState = Store.getDailyState();
  const behaviorState = Store.getBehaviorState();
  const dateStr = Store.todayStr();
  const prior = getEarnedAndMintedBeforeDate(dateStr);

  const logEntries = [];
  const levelUps = [];
  const guildTotals = {};
  let anyChange = false;

  // Get bonus values from daily state (stored globally)
  const bonusAVal = Number(dailyState._bonusA) || 0;
  const bonusBVal = Number(dailyState._bonusB) || 0;
  const bonusCVal = Number(dailyState._bonusC) || 0;
  const bonusDVal = Number(dailyState._bonusD) || 0;

  // Extra penalty values
  const extraAVal = Number(behaviorState._extraA) || 0;
  const extraBVal = Number(behaviorState._extraB) || 0;
  const extraCVal = Number(behaviorState._extraC) || 0;

  for (const student of students) {
    const ds = dailyState[student.name] || {};
    const bs = behaviorState[student.name] || {};

    // Inject bonus values
    ds.bonusAVal = bonusAVal;
    ds.bonusBVal = bonusBVal;
    ds.bonusCVal = bonusCVal;
    ds.bonusDVal = bonusDVal;

    // Inject extra penalty values
    bs.extraAVal = extraAVal;
    bs.extraBVal = extraBVal;
    bs.extraCVal = extraCVal;

    const earnedXP = computeDailyTotal(ds, cfg);
    const behaviorDebtDelta = computeBehaviorDebt(bs, cfg);
    const dailyComment = (ds.comment || '').trim();
    const behaviorComment = (bs.comment || '').trim();

    // Apply debt payment
    let totalDebt = (student.xpDebt || 0) + behaviorDebtDelta;
    let xpRemaining = earnedXP;
    let debtApplied = 0;

    if (totalDebt < 0 && xpRemaining > 0) {
      const pay = Math.min(xpRemaining, -totalDebt);
      totalDebt += pay;
      xpRemaining -= pay;
      debtApplied = pay;
    }

    const xpTowardLevel = Math.min(xpRemaining, cfg.XP_CAP);
    const xpOverflow = Math.max(0, xpRemaining - cfg.XP_CAP);

    // Currency (carryover rule)
    const prev = prior[student.name] || { applied: 0, minted: 0 };
    const currencyGain = Math.max(0,
      Math.floor((prev.applied + xpTowardLevel) / cfg.EXCHANGE_RATE) - prev.minted
    );

    // Update cumulative XP
    const prevLevel = student.level || 1;
    student.cumXP = (student.cumXP || 0) + xpTowardLevel;
    student.level = getLevelFromXP(student.cumXP, thresholds);
    student.xpDebt = totalDebt;

    const baseXP = thresholds[student.level - 1];
    student.xpInLevel = student.cumXP - baseXP;
    const xpForLevel = getXPForLevel(student.level, thresholds);
    student.xpToNext = xpForLevel === 0 ? 0 : Math.max(0, xpForLevel - student.xpInLevel);
    student.progress = xpForLevel === 0 ? 1 : (student.xpInLevel / xpForLevel);
    student.title = determineTitle(student.cumXP, student.level, prestige);

    if (student.level > prevLevel) {
      levelUps.push({ name: student.name, newLevel: student.level, title: student.title });
    }

    // Participation count for streak tracking
    let partCount = 0;
    for (let i = 1; i <= 5; i++) if (ds[`part${i}`]) partCount++;

    const shouldLog = earnedXP > 0 || behaviorDebtDelta !== 0 || dailyComment || behaviorComment;
    if (shouldLog) {
      anyChange = true;
      logEntries.push({
        date: dateStr,
        student: student.name,
        dailyTotalRaw: earnedXP,
        debtApplied,
        xpToLevel: xpTowardLevel,
        overflowXP: xpOverflow,
        currencyGain,
        debtAfter: totalDebt,
        cumXPAfter: student.cumXP,
        levelAfter: student.level,
        titleAfter: student.title,
        participationCount: partCount,
        dailyComment,
        behaviorComment
      });

      // Guild totals
      if (student.guild) {
        guildTotals[student.guild] = (guildTotals[student.guild] || 0) + earnedXP;
      }
    }
  }

  // Save everything
  Store.saveStudents(students);
  if (logEntries.length) {
    Store.upsertXPLogForDate(dateStr, logEntries);
  }

  // Clear daily & behavior inputs
  Store.clearDailyState();
  Store.clearBehaviorState();

  return { anyChange, levelUps, processedCount: logEntries.length, guildTotals };
}

// ── Recompute all levels/progress from stored cumXP ──
export function recomputeAllProgress() {
  const students = Store.getStudents();
  const cfg = Store.getConfig();
  const thresholds = computeLevelThresholds(cfg.LEVEL_DIFFICULTY);
  const prestige = computePrestigeTitles(cfg.LEVEL_DIFFICULTY);
  for (const s of students) {
    s.level = getLevelFromXP(s.cumXP || 0, thresholds);
    const baseXP = thresholds[s.level - 1];
    s.xpInLevel = (s.cumXP || 0) - baseXP;
    const xpForLevel = getXPForLevel(s.level, thresholds);
    s.xpToNext = xpForLevel === 0 ? 0 : Math.max(0, xpForLevel - s.xpInLevel);
    s.progress = xpForLevel === 0 ? 1 : (s.xpInLevel / xpForLevel);
    s.title = determineTitle(s.cumXP || 0, s.level, prestige);
  }
  Store.saveStudents(students);
  return students.length;
}

// Remap stored cumXP on a difficulty change so each student keeps their exact
// level and relative progress-in-level. Only the future pace changes; students
// see no shift in level or progress bar.
export function remapXPForDifficulty(oldKey, newKey) {
  if (oldKey === newKey) return 0;
  const oldTh = computeLevelThresholds(oldKey);
  const newTh = computeLevelThresholds(newKey);
  const maxLevel = oldTh.length;
  const students = Store.getStudents();
  for (const s of students) {
    const cumXP = s.cumXP || 0;
    const level = getLevelFromXP(cumXP, oldTh);
    let newCum;
    if (level < maxLevel) {
      const oldBase = oldTh[level - 1];
      const oldSpan = oldTh[level] - oldBase;
      const frac = oldSpan > 0 ? (cumXP - oldBase) / oldSpan : 0;
      const newBase = newTh[level - 1];
      newCum = Math.round(newBase + frac * (newTh[level] - newBase));
      if (newCum >= newTh[level]) newCum = newTh[level] - 1; // stay within the same band
      if (newCum < newBase) newCum = newBase;
    } else {
      // Top level: scale overflow so prestige standing is preserved too
      const oldBase = oldTh[maxLevel - 1];
      const newBase = newTh[maxLevel - 1];
      const ratio = oldBase > 0 ? newBase / oldBase : 1;
      newCum = Math.round(newBase + (cumXP - oldBase) * ratio);
    }
    s.cumXP = newCum;
  }
  Store.saveStudents(students);
  return students.length;
}

// ── Compute participation streaks from XP Log ──
export function computeStreaks() {
  const log = Store.getXPLog();
  const byNameDate = {};

  for (const entry of log) {
    if (!entry.student || !entry.date) continue;
    const pc = Number(entry.participationCount) || 0;
    if (!byNameDate[entry.student]) byNameDate[entry.student] = {};
    byNameDate[entry.student][entry.date] = pc;
  }

  const streaks = {};
  for (const [name, dateMap] of Object.entries(byNameDate)) {
    const dates = Object.keys(dateMap).sort().reverse();
    let count = 0;
    for (const d of dates) {
      if ((dateMap[d] || 0) >= 3) count++;
      else break;
    }
    streaks[name] = { count, badge: getStreakBadge(count) };
  }
  return streaks;
}

// ── Build leaderboard data ──
export function buildLeaderboardData() {
  const students = Store.getStudents();
  const streaks = computeStreaks();

  const entries = students
    .filter(s => s.name)
    .map(s => ({
      ...s,
      streak: streaks[s.name] || { count: 0, badge: '' },
      badge: getTitleBadge(s.title)
    }))
    .sort((a, b) => (b.level - a.level) || (b.cumXP - a.cumXP));

  // Assign ranks
  let rank = 0, pos = 0, prevL = null, prevXP = null;
  for (const e of entries) {
    pos++;
    if (e.level !== prevL || e.cumXP !== prevXP) { rank = pos; prevL = e.level; prevXP = e.cumXP; }
    e.rank = rank;
  }

  return entries;
}

// ── Recent Level Ups (from XP log, last N days) ──
export function getRecentLevelUps(days = 3) {
  const log = Store.getXPLog();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`;

  // Sort log by date asc, then by student
  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date) || a.student.localeCompare(b.student));

  // Track each student's previous level to detect changes
  const prevLevel = {};
  const levelUps = [];

  for (const entry of sorted) {
    const lvl = entry.levelAfter || 1;
    const prev = prevLevel[entry.student];
    if (prev !== undefined && lvl > prev && entry.date >= cutoffStr) {
      levelUps.push({
        student: entry.student,
        date: entry.date,
        prevLevel: prev,
        newLevel: lvl,
        title: entry.titleAfter || ''
      });
    }
    prevLevel[entry.student] = lvl;
  }

  // Sort most recent first
  levelUps.sort((a, b) => b.date.localeCompare(a.date) || a.student.localeCompare(b.student));
  return levelUps;
}

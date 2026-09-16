// ============================================================
// config.js — All game constants, level thresholds, prestige
// ============================================================

export const TZ = "America/Los_Angeles";

// Base (Normal difficulty) level thresholds (cumulative) for levels 1..10.
// Flatter curve than the old back-loaded one: slows early levels, keeps L10 reachable.
export const BASE_LEVEL_THRESHOLDS = [0, 150, 350, 600, 850, 1150, 1500, 1850, 2200, 2600];

// Base (Normal difficulty) prestige milestones (post-level-10 recognition)
export const BASE_PRESTIGE_TITLES = [
  { xp: 2800, title: "Sunmere Guardian" },
  { xp: 3050, title: "Keeper of the Archives" },
  { xp: 3350, title: "Chronomancer Adept" },
  { xp: 3700, title: "Eclipse Warden" },
  { xp: 4100, title: "Arcane Vanguard" },
  { xp: 4550, title: "Paragon of Realms" },
  { xp: 5050, title: "Ascendant Archmage" }
];

// Difficulty presets — scale the whole level curve. 'normal' = recommended baseline.
export const DIFFICULTY_LEVELS = [
  { key: 'easiest', label: 'Easiest', mult: 0.75 },
  { key: 'easier',  label: 'Easier',  mult: 0.875 },
  { key: 'normal',  label: 'Normal',  mult: 1.0 },
  { key: 'harder',  label: 'Harder',  mult: 1.15 },
  { key: 'hardest', label: 'Hardest', mult: 1.3 },
];
export const DEFAULT_DIFFICULTY = 'normal';

export function getDifficultyMult(key) {
  const d = DIFFICULTY_LEVELS.find(x => x.key === key);
  return d ? d.mult : 1.0;
}

// Scale a cumulative XP value to a clean multiple of 25 (level 1 stays 0)
function scaleXP(xp, mult) {
  if (xp <= 0) return 0;
  return Math.round((xp * mult) / 25) * 25;
}

export function computeLevelThresholds(difficultyKey = DEFAULT_DIFFICULTY) {
  const mult = getDifficultyMult(difficultyKey);
  return BASE_LEVEL_THRESHOLDS.map(xp => scaleXP(xp, mult));
}

export function computePrestigeTitles(difficultyKey = DEFAULT_DIFFICULTY) {
  const mult = getDifficultyMult(difficultyKey);
  return BASE_PRESTIGE_TITLES.map(p => ({ xp: scaleXP(p.xp, mult), title: p.title }));
}

// Base titles by level
export const BASE_TITLES = {
  1:  "Sparkling Novice",
  2:  "Rune Reader",
  3:  "Potion Apprentice",
  4:  "Spell Slinger",
  5:  "Wand Wielder",
  6:  "Magic Adept",
  7:  "Enchanted Knight",
  8:  "Arcane Scholar",
  9:  "Mystic Champion",
  10: "Master Spellcaster"
};

// Title badge — vivid fantasy sigils
export const TITLE_BADGES = {
  'Sparkling Novice': '💫',
  'Rune Reader': '🔮',
  'Potion Apprentice': '⚗️',
  'Spell Slinger': '🌀',
  'Wand Wielder': '🪄',
  'Magic Adept': '🔥',
  'Enchanted Knight': '⚔️',
  'Arcane Scholar': '🌙',
  'Mystic Champion': '🐉',
  'Master Spellcaster': '👑',
  'Sunmere Guardian': '🦅',
  'Keeper of the Archives': '🗝️',
  'Chronomancer Adept': '⏳',
  'Eclipse Warden': '🌑',
  'Arcane Vanguard': '🛡️',
  'Paragon of Realms': '🏰',
  'Ascendant Archmage': '⭐'
};

// Guilds
export const GUILDS = [
  { label: "Guild 1", bg: "#1e88e5", fg: "#ffffff" },
  { label: "Guild 2", bg: "#fbc02d", fg: "#000000" },
  { label: "Guild 3", bg: "#8e24aa", fg: "#ffffff" },
];

// Default configuration
export const DEFAULT_CONFIG = {
  XP_CAP: 50,
  EXCHANGE_RATE: 20,
  LEVEL_DIFFICULTY: DEFAULT_DIFFICULTY,
  DAILY_WEIGHTS: {
    quiz: 10,
    faculty: 5,
    exitTicket: 5,
    writing: 5,
    kindness: 5,
    expectations: 10,
    participationEach: 2
  },
  BEHAVIOR_PENALTIES: {
    minor: -5,
    warning: -10,
    disrupt: -15,
    repeat: -20,
    serious: -25,
    severe: -30
  },
  TEST_SCORE_XP: { 0: 0, 1: 10, 2: 15, 3: 20, 4: 25 }
};

// Streak badges
export function getStreakBadge(count) {
  if (count >= 20) return '🏆';
  if (count >= 15) return '💎';
  if (count >= 10) return '💥';
  if (count >= 5)  return '🔥';
  return '';
}

// Rank badges
export function getRankBadge(rank) {
  if (rank === 1) return '👑';
  if (rank === 2) return '⚔️';
  if (rank === 3) return '🛡️';
  return '';
}

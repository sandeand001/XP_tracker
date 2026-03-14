// ============================================================
// config.js — All game constants, level thresholds, prestige
// ============================================================

export const TZ = "America/Los_Angeles";

// Level thresholds (cumulative) for levels 1..10
export const LEVEL_THRESHOLDS = [0, 100, 200, 400, 700, 1150, 1800, 2550, 3300, 4000];

// Prestige milestones (post-level-10 recognition)
export const PRESTIGE_TITLES = [
  { xp: 4200, title: "Sunmere Guardian" },
  { xp: 4400, title: "Keeper of the Archives" },
  { xp: 4650, title: "Chronomancer Adept" },
  { xp: 4950, title: "Eclipse Warden" },
  { xp: 5300, title: "Arcane Vanguard" },
  { xp: 5700, title: "Paragon of Realms" },
  { xp: 6150, title: "Ascendant Archmage" }
];

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

// Title badge emoji map
export const TITLE_BADGES = {
  'Sparkling Novice': '🌱',
  'Rune Reader': '📜',
  'Potion Apprentice': '🧪',
  'Spell Slinger': '🎆',
  'Wand Wielder': '🪄',
  'Magic Adept': '✨',
  'Enchanted Knight': '🛡️',
  'Arcane Scholar': '📘',
  'Mystic Champion': '🏅',
  'Master Spellcaster': '🌟',
  'Sunmere Guardian': '☀️',
  'Keeper of the Archives': '🏛️',
  'Chronomancer Adept': '⏳',
  'Eclipse Warden': '🌑',
  'Arcane Vanguard': '⚔️',
  'Paragon of Realms': '👑',
  'Ascendant Archmage': '🔮'
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
  if (rank === 1) return '🏆';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

import './helpers/env.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Engine from '../js/engine.js';
import * as Store from '../js/store.js';
import { computeLevelThresholds, computePrestigeTitles, BASE_TITLES } from '../js/config.js';

const TH = computeLevelThresholds('normal');
const PRESTIGE = computePrestigeTitles('normal');

beforeEach(() => {
  localStorage.clear();
});

test('getLevelFromXP maps XP to the correct level band', () => {
  assert.equal(Engine.getLevelFromXP(0, TH), 1);
  assert.equal(Engine.getLevelFromXP(149, TH), 1);
  assert.equal(Engine.getLevelFromXP(150, TH), 2);
  assert.equal(Engine.getLevelFromXP(2599, TH), 9);
  assert.equal(Engine.getLevelFromXP(2600, TH), 10);
  assert.equal(Engine.getLevelFromXP(99999, TH), 10);
});

test('getXPForLevel returns the width of a level band', () => {
  assert.equal(Engine.getXPForLevel(2, TH), 200); // 350 - 150
  assert.equal(Engine.getXPForLevel(10, TH), 0);  // top level has no next
});

test('determineTitle uses base titles then prestige milestones', () => {
  assert.equal(Engine.determineTitle(0, 1, PRESTIGE), BASE_TITLES[1]);
  assert.equal(Engine.determineTitle(2600, 10, PRESTIGE), BASE_TITLES[10]);
  assert.equal(Engine.determineTitle(2800, 10, PRESTIGE), PRESTIGE[0].title);
  assert.equal(Engine.determineTitle(999999, 10, PRESTIGE), PRESTIGE.at(-1).title);
});

test('computeDailyTotal sums weighted checklist inputs', () => {
  const cfg = Store.getConfig();
  assert.equal(Engine.computeDailyTotal({ quiz: true }, cfg), 10);
  assert.equal(Engine.computeDailyTotal({ quiz: true, kindness: true }, cfg), 15);
  assert.equal(Engine.computeDailyTotal({ test: 3 }, cfg), 20);
  assert.equal(Engine.computeDailyTotal({ part1: true, part2: true }, cfg), 4);
  assert.equal(Engine.computeDailyTotal({ bonusA: true, bonusAVal: 7 }, cfg), 7);
});

test('computeBehaviorDebt sums penalties as a negative delta', () => {
  const cfg = Store.getConfig();
  assert.equal(Engine.computeBehaviorDebt({ minor: true }, cfg), -5);
  assert.equal(Engine.computeBehaviorDebt({ minor: true, warning: true }, cfg), -15);
  assert.equal(Engine.computeBehaviorDebt({ extraA: true, extraAVal: 8 }, cfg), -8);
});

test('remapXPForDifficulty preserves level and in-level progress', () => {
  Store.saveConfig({ ...Store.getConfig(), LEVEL_DIFFICULTY: 'normal' });
  Store.saveStudents([{ name: 'A', cumXP: 500, level: 1, xpDebt: 0 }]);
  Engine.recomputeAllProgress();
  const before = Store.getStudents()[0];

  Engine.remapXPForDifficulty('normal', 'hardest');
  Store.saveConfig({ ...Store.getConfig(), LEVEL_DIFFICULTY: 'hardest' });
  Engine.recomputeAllProgress();
  const after = Store.getStudents()[0];

  assert.equal(after.level, before.level);
  assert.ok(Math.abs(after.progress - before.progress) < 0.02);
});

test('previewDailyXP reports results without mutating state', () => {
  Store.saveStudents([{ name: 'A', cumXP: 0, level: 1, xpDebt: 0 }]);
  Store.saveDailyState({ A: { quiz: true } });

  const preview = Engine.previewDailyXP();
  assert.equal(preview[0].earnedXP, 10);
  assert.equal(preview[0].xpToLevel, 10);
  assert.equal(preview[0].changed, true);

  // Nothing applied yet
  assert.equal(Store.getStudents()[0].cumXP, 0);
  assert.equal(Store.hasProcessedToday(), false);
});

test('processDailyXP applies XP, logs it, and marks today processed', () => {
  Store.saveStudents([{ name: 'A', cumXP: 0, level: 1, xpDebt: 0, guild: '' }]);
  Store.saveDailyState({ A: { quiz: true, kindness: true } });

  const res = Engine.processDailyXP();
  assert.equal(res.processedCount, 1);
  assert.equal(Store.getStudents()[0].cumXP, 15);
  assert.equal(Store.hasProcessedToday(), true);
  assert.equal(Store.getDailyState().A, undefined); // inputs cleared
});

test('undoLastProcess restores students, log, and inputs', () => {
  Store.saveStudents([{ name: 'A', cumXP: 100, level: 1, xpDebt: 0 }]);
  Store.saveDailyState({ A: { quiz: true } });
  Engine.processDailyXP();
  assert.equal(Store.getStudents()[0].cumXP, 110);

  const ok = Engine.undoLastProcess();
  assert.equal(ok, true);
  assert.equal(Store.getStudents()[0].cumXP, 100);
  assert.equal(Store.hasProcessedToday(), false);
  assert.deepEqual(Store.getDailyState(), { A: { quiz: true } });
  assert.equal(Store.getProcessSnapshot(), null);
});

test('processing an empty day leaves no undo snapshot', () => {
  Store.saveStudents([{ name: 'A', cumXP: 0, level: 1, xpDebt: 0 }]);
  Store.saveDailyState({});
  const res = Engine.processDailyXP();
  assert.equal(res.processedCount, 0);
  assert.equal(Store.getProcessSnapshot(), null);
});

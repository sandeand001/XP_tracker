import './helpers/env.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Store from '../js/store.js';

beforeEach(() => {
  localStorage.clear();
});

test('getConfig deep-merges stored config over defaults', () => {
  Store.saveConfig({ XP_CAP: 99 });
  const cfg = Store.getConfig();
  assert.equal(cfg.XP_CAP, 99);          // overridden
  assert.equal(cfg.EXCHANGE_RATE, 20);   // default preserved
  assert.equal(cfg.LEVEL_DIFFICULTY, 'normal');
  assert.equal(cfg.DAILY_WEIGHTS.quiz, 10);
});

test('getConfig merges nested objects without dropping sibling defaults', () => {
  Store.saveConfig({ DAILY_WEIGHTS: { quiz: 42 } });
  const cfg = Store.getConfig();
  assert.equal(cfg.DAILY_WEIGHTS.quiz, 42);   // overridden
  assert.equal(cfg.DAILY_WEIGHTS.faculty, 5); // default preserved
});

test('addStudent rejects duplicates', () => {
  assert.equal(Store.addStudent('Bob', ''), true);
  assert.equal(Store.addStudent('Bob', ''), false);
  assert.equal(Store.getStudents().length, 1);
});

test('renameStudent propagates across log and daily/behavior state', () => {
  Store.addStudent('Bob', '');
  Store.saveXPLog([{ date: Store.todayStr(), student: 'Bob', levelAfter: 2, currencyGain: 5, cumXPAfter: 200 }]);
  Store.saveDailyState({ Bob: { quiz: true } });
  Store.saveBehaviorState({ Bob: { minor: true } });

  Store.renameStudent('Bob', 'Robert');

  assert.equal(Store.getStudents()[0].name, 'Robert');
  assert.equal(Store.getXPLog()[0].student, 'Robert');
  assert.ok(Store.getDailyState().Robert);
  assert.equal(Store.getDailyState().Bob, undefined);
  assert.ok(Store.getBehaviorState().Robert);
});

test('renameStudent refuses to collide with an existing name', () => {
  Store.addStudent('Robert', '');
  Store.addStudent('Sam', '');
  assert.throws(() => Store.renameStudent('Robert', 'Sam'), /already exists/);
});

test('getCoinsEarnedToday counts only today positive gains (not spends)', () => {
  const today = Store.todayStr();
  Store.saveXPLog([
    { date: today, student: 'A', currencyGain: 5, levelAfter: 2 },
    { date: today, student: 'A', currencyGain: -3, levelAfter: 0 }, // spend
    { date: '2000-01-01', student: 'A', currencyGain: 9, levelAfter: 2 },
  ]);
  const earned = Store.getCoinsEarnedToday();
  assert.equal(earned.A, 5);
});

test('hasProcessedToday and getLastProcessedDate ignore spend entries', () => {
  const today = Store.todayStr();
  Store.saveXPLog([{ date: today, student: 'A', currencyGain: -3, levelAfter: 0 }]);
  assert.equal(Store.hasProcessedToday(), false);
  assert.equal(Store.getLastProcessedDate(), null);

  Store.saveXPLog([
    { date: '2001-02-03', student: 'A', currencyGain: 2, levelAfter: 3 },
    { date: today, student: 'A', currencyGain: 2, levelAfter: 4 },
  ]);
  assert.equal(Store.hasProcessedToday(), true);
  assert.equal(Store.getLastProcessedDate(), today);
});

test('todayStr returns an ISO calendar date', () => {
  assert.match(Store.todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});

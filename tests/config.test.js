import './helpers/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLevelThresholds,
  computePrestigeTitles,
  getDifficultyMult,
  DIFFICULTY_LEVELS,
} from '../js/config.js';

test('normal difficulty matches the recommended curve', () => {
  assert.deepEqual(
    computeLevelThresholds('normal'),
    [0, 150, 350, 600, 850, 1150, 1500, 1850, 2200, 2600]
  );
});

test('every difficulty produces a strictly increasing curve', () => {
  for (const { key } of DIFFICULTY_LEVELS) {
    const th = computeLevelThresholds(key);
    for (let i = 1; i < th.length; i++) {
      assert.ok(th[i] > th[i - 1], `${key}: level ${i + 1} (${th[i]}) not > level ${i} (${th[i - 1]})`);
    }
  }
});

test('difficulty scales the Level 10 target as expected', () => {
  assert.equal(computeLevelThresholds('easiest').at(-1), 1950);
  assert.equal(computeLevelThresholds('normal').at(-1), 2600);
  assert.equal(computeLevelThresholds('hardest').at(-1), 3375);
});

test('getDifficultyMult falls back to 1.0 for unknown keys', () => {
  assert.equal(getDifficultyMult('normal'), 1.0);
  assert.equal(getDifficultyMult('does-not-exist'), 1.0);
  assert.equal(getDifficultyMult(undefined), 1.0);
});

test('prestige milestones sit above the Level 10 threshold', () => {
  for (const { key } of DIFFICULTY_LEVELS) {
    const l10 = computeLevelThresholds(key).at(-1);
    const prestige = computePrestigeTitles(key);
    assert.ok(prestige[0].xp > l10, `${key}: first prestige (${prestige[0].xp}) not above L10 (${l10})`);
    for (let i = 1; i < prestige.length; i++) {
      assert.ok(prestige[i].xp > prestige[i - 1].xp, `${key}: prestige not increasing`);
    }
  }
});

test('unknown difficulty key defaults to the normal curve', () => {
  assert.deepEqual(computeLevelThresholds('mystery'), computeLevelThresholds('normal'));
});

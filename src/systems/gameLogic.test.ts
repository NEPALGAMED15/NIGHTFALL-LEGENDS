import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMeleeDamage,
  computeSoulStrikeDamage,
  canActivateAbility,
  computeBossPhase,
  computeVictoryScore,
  selectKaelAnimation,
} from './CombatLogic.js';
import {
  computeNightFactor,
  getCyclePeriodName,
  evaluateCycleLighting,
  DayNightCycle,
} from './DayNightCycle.js';
import { SaveSystem } from './SaveSystem.js';
import { KINGDOMS, getKingdomById, getNextKingdomId } from '../levels/kingdoms.js';
import { PHYSICS_CONFIG } from '../config.js';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(k: string) {
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k: string, v: string) {
      map.set(k, String(v));
    },
    removeItem(k: string) {
      map.delete(k);
    },
  };
}

test('CombatLogic scales Nightfang combo, Eclipse Mode, and Night Vision crits', () => {
  const hit1 = computeMeleeDamage({ baseDamage: 20, comboStep: 0, roll: 0.99 });
  const hit3 = computeMeleeDamage({ baseDamage: 20, comboStep: 2, roll: 0.99 });
  assert.equal(hit1.damage, 20);
  assert.equal(hit3.damage, 33);

  const eclipseCrit = computeMeleeDamage({
    baseDamage: 20,
    comboStep: 2,
    eclipseActive: true,
    nightVisionActive: true,
    nightVisionCritBonus: 0.35,
    roll: 0.4, // < 0.45 crit chance with night vision
  });
  assert.equal(eclipseCrit.isCrit, true);
  assert.ok(eclipseCrit.damage > hit3.damage);
  assert.ok(eclipseCrit.lifesteal >= 2);

  assert.equal(computeSoulStrikeDamage({ baseDamage: 22, eclipseActive: false }), 46);
});

test('Ability activation validates energy and cooldowns', () => {
  const deniedEnergy = canActivateAbility({
    abilityId: 'eclipse_mode',
    energy: 20,
    cooldowns: {},
  });
  assert.equal(deniedEnergy.ok, false);
  assert.equal(deniedEnergy.reason, 'energy');

  const deniedCd = canActivateAbility({
    abilityId: 'shadow_dash',
    energy: 100,
    cooldowns: { shadow_dash: 0.8 },
  });
  assert.equal(deniedCd.ok, false);
  assert.equal(deniedCd.reason, 'cooldown');

  const allowed = canActivateAbility({
    abilityId: 'night_vision',
    energy: 40,
    cooldowns: {},
  });
  assert.equal(allowed.ok, true);
});

test('Boss phase transitions at 50% HP and Victory score computes cleanly', () => {
  assert.equal(computeBossPhase(420, 420), 1);
  assert.equal(computeBossPhase(210, 420), 2);
  const score = computeVictoryScore({
    baseScore: 500,
    hpRemaining: 80,
    shards: 5,
    gems: 1,
    clearTimeSec: 100,
  });
  assert.equal(score, 500 + 1200 + 800 + 250 + 150);
});

test('DayNightCycle transitions smoothly and adjusts detection and Night Vision', () => {
  assert.ok(computeNightFactor(0.0) < 0.01);
  assert.ok(computeNightFactor(0.5) > 0.99);
  assert.equal(getCyclePeriodName(0.0), 'Day');
  assert.equal(getCyclePeriodName(0.25), 'Dusk');
  assert.equal(getCyclePeriodName(0.5), 'Night');
  assert.equal(getCyclePeriodName(0.75), 'Dawn');

  const dayState = evaluateCycleLighting(0.0, null, false);
  const nightState = evaluateCycleLighting(0.5, null, false);
  const nightWithVision = evaluateCycleLighting(0.5, null, true);

  assert.ok(nightState.enemyDetectionMultiplier < dayState.enemyDetectionMultiplier);
  assert.ok(nightWithVision.ambientDarknessAlpha < nightState.ambientDarknessAlpha);
  assert.ok(nightWithVision.nightVisionCritBonus > 0.3);

  const cycle = new DayNightCycle({ initialMode: 'night', autoCycle: true, cycleDurationSec: 60 });
  const target = cycle.toggleTargetMode();
  assert.equal(target, 'day');
  for (let i = 0; i < 60; i++) {
    cycle.update(0.016);
  }
  assert.ok(computeNightFactor(cycle.progress) < 0.05);
});

test('SaveSystem persists kingdom clears, settings, and resets cleanly', () => {
  const storage = createMemoryStorage();
  const sys = new SaveSystem(storage);

  assert.equal(sys.hasContinueData(), false);
  const afterClear = sys.recordKingdomClear({
    kingdomId: 'whispering-forest',
    nextKingdomId: 'frozen-kingdom',
    score: 2400,
    shards: 8,
    gems: 2,
  });
  assert.equal(sys.hasContinueData(), true);
  assert.ok(afterClear.unlockedKingdoms.includes('frozen-kingdom'));
  assert.ok(afterClear.completedKingdoms.includes('whispering-forest'));

  const loaded = sys.load();
  assert.equal(loaded.bestScore, 2400);
  assert.equal(loaded.totalShards, 8);

  sys.reset();
  assert.equal(sys.hasContinueData(), false);
});

test('All 7 kingdoms exist and Whispering Forest jumps are physically reachable', () => {
  assert.equal(KINGDOMS.length, 7);
  assert.equal(getKingdomById('whispering-forest').bossName, 'Root Warden');
  assert.equal(getNextKingdomId('whispering-forest'), 'frozen-kingdom');
  assert.equal(getNextKingdomId('eternal-citadel'), null);

  const wf = getKingdomById('whispering-forest');
  // Max double jump height from physics config: v1^2/(2g) + v2^2/(2g)
  const maxDoubleJumpHeight =
    (PHYSICS_CONFIG.JUMP_VELOCITY ** 2 + PHYSICS_CONFIG.DOUBLE_JUMP_VELOCITY ** 2) /
    (2 * PHYSICS_CONFIG.GRAVITY_Y);
  // Ensure every non-secret platform is reachable from ground or lower stepping stone
  for (const p of wf.platforms) {
    const isSecret = 'secret' in p && Boolean(p.secret);
    if (!isSecret) {
      assert.ok(wf.groundY - p.y <= maxDoubleJumpHeight + 45, `Platform at y=${p.y} too high`);
    }
  }
  // Ensure every ground gap has a bridge platform or is narrower than single-jump range
  for (const gap of wf.groundGaps) {
    const gapWidth = gap.x2 - gap.x1;
    assert.ok(gapWidth <= 200, `Gap ${gap.x1}..${gap.x2} width ${gapWidth} too wide`);
  }
});

test('selectKaelAnimation maps all movement, combat, land, and status states cleanly', () => {
  assert.equal(selectKaelAnimation({ grounded: true, velocityX: 0 }), 'kael_idle');
  assert.equal(selectKaelAnimation({ grounded: true, velocityX: 110 }), 'kael_walk');
  assert.equal(selectKaelAnimation({ grounded: true, velocityX: -280 }), 'kael_run');
  assert.equal(selectKaelAnimation({ grounded: true, velocityX: 0, landTimer: 0.1 }), 'kael_land');
  assert.equal(selectKaelAnimation({ grounded: false, velocityY: -320, currentAnimKey: 'kael_idle' }), 'kael_jump');
  assert.equal(selectKaelAnimation({ grounded: false, velocityY: -320, currentAnimKey: 'kael_double_jump' }), 'kael_double_jump');
  assert.equal(selectKaelAnimation({ grounded: false, velocityY: 220 }), 'kael_fall');
  assert.equal(selectKaelAnimation({ isAttacking: true, comboStep: 0 }), 'kael_attack1');
  assert.equal(selectKaelAnimation({ isAttacking: true, comboStep: 1 }), 'kael_attack2');
  assert.equal(selectKaelAnimation({ isAttacking: true, comboStep: 2 }), 'kael_combo_attack');
  assert.equal(selectKaelAnimation({ isDashing: true }), 'kael_dash');
  assert.equal(selectKaelAnimation({ hurtTimer: 0.2 }), 'kael_hurt');
  assert.equal(selectKaelAnimation({ isVictory: true }), 'kael_victory');
  assert.equal(selectKaelAnimation({ isDead: true }), 'kael_defeat');
});

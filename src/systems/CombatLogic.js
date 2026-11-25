import { ABILITIES } from '../config.js';

export const COMBO_MULTIPLIERS = [1.0, 1.25, 1.65];

/**
 * @param {{ baseDamage?: number, comboStep?: number, eclipseActive?: boolean, nightVisionActive?: boolean, nightVisionCritBonus?: number | null, roll?: number }} params
 */
export function computeMeleeDamage({
  baseDamage = 22,
  comboStep = 0,
  eclipseActive = false,
  nightVisionActive = false,
  nightVisionCritBonus = /** @type {number | null} */ (null),
  roll = 0.5,
}) {
  const mult = COMBO_MULTIPLIERS[Math.max(0, Math.min(2, comboStep))] || 1.0;
  let damage = baseDamage * mult;
  if (eclipseActive) {
    damage *= 1.6;
  }
  const critChance = nightVisionActive
    ? 0.1 + (typeof nightVisionCritBonus === 'number' ? nightVisionCritBonus : 0.25)
    : 0.1;
  const isCrit = roll < critChance;
  if (isCrit) {
    damage *= 1.5;
  }
  return {
    damage: Math.round(damage),
    isCrit,
    lifesteal: eclipseActive ? Math.max(2, Math.round(damage * 0.12)) : 0,
  };
}

export function computeSoulStrikeDamage({ baseDamage = 22, eclipseActive = false }) {
  const raw = baseDamage * 2.1 * (eclipseActive ? 1.5 : 1.0);
  return Math.round(raw);
}

export function canActivateAbility({ abilityId, energy, cooldowns }) {
  const def = ABILITIES.find((a) => a.id === abilityId);
  if (!def) return { ok: false, reason: 'unknown' };
  const remainingCd = cooldowns[abilityId] || 0;
  if (remainingCd > 0.01) return { ok: false, reason: 'cooldown', remainingCd };
  if (energy < def.energyCost) return { ok: false, reason: 'energy', needed: def.energyCost };
  return { ok: true, def };
}

export function computeBossPhase(hp, maxHp) {
  if (maxHp <= 0) return 1;
  return hp / maxHp <= 0.5 ? 2 : 1;
}

export function computeVictoryScore({ baseScore = 0, hpRemaining = 0, shards = 0, gems = 0, clearTimeSec = 120 }) {
  const timeBonus = Math.max(0, Math.round((300 - clearTimeSec) * 6));
  const healthBonus = Math.round(hpRemaining * 10);
  const collectibleBonus = shards * 50 + gems * 150;
  return Math.round(baseScore + timeBonus + healthBonus + collectibleBonus);
}

/**
 * Pure animation state selector for Kael so transitions are deterministic and unit-tested.
 */
export function selectKaelAnimation({
  isDead = false,
  isVictory = false,
  hurtTimer = 0,
  isDashing = false,
  isAttacking = false,
  comboStep = 0,
  grounded = true,
  velocityX = 0,
  velocityY = 0,
  landTimer = 0,
  currentAnimKey = 'kael_idle',
}) {
  if (isDead) return 'kael_defeat';
  if (isVictory) return 'kael_victory';
  if (hurtTimer > 0) return 'kael_hurt';
  if (isDashing) return 'kael_dash';
  if (isAttacking) {
    if (comboStep === 2) return 'kael_combo_attack';
    if (comboStep === 1) return 'kael_attack2';
    return 'kael_attack1';
  }
  if (!grounded) {
    if (velocityY < 0) {
      return currentAnimKey === 'kael_double_jump' ? 'kael_double_jump' : 'kael_jump';
    }
    return 'kael_fall';
  }
  if (landTimer > 0) return 'kael_land';
  const absVx = Math.abs(velocityX);
  if (absVx >= 190) return 'kael_run';
  if (absVx >= 22) return 'kael_walk';
  return 'kael_idle';
}


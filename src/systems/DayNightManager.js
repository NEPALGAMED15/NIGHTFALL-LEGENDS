import {
  DayNightCycle,
  computeNightFactor,
  evaluateCycleLighting,
  getCyclePeriodName,
  lerp,
  lerpHexColor,
} from './DayNightCycle.js';

export {
  DayNightCycle,
  computeNightFactor,
  evaluateCycleLighting,
  getCyclePeriodName,
  lerp,
  lerpHexColor,
};

/**
 * Coordinates smooth visual Day/Night transitions across all 7 Kingdoms and 15 Bonus Worlds.
 * Guarantee: Updates lighting, celestial bodies, and detection/Night Vision modifiers
 * without ever modifying player physics, platform positions, or collision geometry.
 */
export class DayNightManager extends DayNightCycle {
  constructor(options = {}) {
    super(options);
  }

  getLightingForLevel(levelConfig, nightVisionActive = false) {
    const palette = levelConfig?.palette || null;
    const base = evaluateCycleLighting(this.progress, palette, nightVisionActive);

    // Certain worlds (e.g., Shadow Realm, Space World, Final Battle) emphasize nocturnal drama while keeping Day/Night distinct
    if (levelConfig?.biomeMechanic === 'shadow' || levelConfig?.biomeMechanic === 'eclipse_storm') {
      return {
        ...base,
        ambientDarknessAlpha: Math.min(0.42, base.ambientDarknessAlpha + 0.06),
      };
    }
    return base;
  }
}

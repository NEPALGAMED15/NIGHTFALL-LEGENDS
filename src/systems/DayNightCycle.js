export function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function lerpHexColor(c1, c2, t) {
  const clamped = Math.max(0, Math.min(1, t));
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;
  const r = Math.round(lerp(r1, r2, clamped));
  const g = Math.round(lerp(g1, g2, clamped));
  const b = Math.round(lerp(b1, b2, clamped));
  return (r << 16) | (g << 8) | b;
}

/**
 * Cycle normalized progress t in [0, 1):
 * 0.00 = Noon (Full Day)
 * 0.25 = Dusk
 * 0.50 = Midnight (Full Night)
 * 0.75 = Dawn
 */
export function computeNightFactor(cycleProgress) {
  const wrapped = ((cycleProgress % 1) + 1) % 1;
  // Cosine curve: 0 at progress=0 (Day), 1 at progress=0.5 (Night)
  return 0.5 - 0.5 * Math.cos(wrapped * Math.PI * 2);
}

export function getCyclePeriodName(cycleProgress) {
  const wrapped = ((cycleProgress % 1) + 1) % 1;
  if (wrapped < 0.18 || wrapped >= 0.86) return 'Day';
  if (wrapped < 0.34) return 'Dusk';
  if (wrapped < 0.68) return 'Night';
  return 'Dawn';
}

export function evaluateCycleLighting(cycleProgress, palette, nightVisionActive = false) {
  const wrapped = ((cycleProgress % 1) + 1) % 1;
  const nightFactor = computeNightFactor(wrapped);
  const period = getCyclePeriodName(wrapped);

  // Twilight peaks near 0.25 (Dusk) and 0.75 (Dawn)
  const twilightFactor = Math.pow(Math.sin(wrapped * Math.PI * 2), 2);

  const dayTop = palette?.daySkyTop ?? 0x3d7a8a;
  const dayBot = palette?.daySkyBottom ?? 0xa7d7b8;
  const nightTop = palette?.nightSkyTop ?? 0x070d19;
  const nightBot = palette?.nightSkyBottom ?? 0x162238;
  const duskTop = 0x2b1d42;
  const duskBot = 0xc96b4b;

  let skyTop = lerpHexColor(dayTop, nightTop, nightFactor);
  let skyBottom = lerpHexColor(dayBot, nightBot, nightFactor);
  skyTop = lerpHexColor(skyTop, duskTop, twilightFactor * 0.55);
  skyBottom = lerpHexColor(skyBottom, duskBot, twilightFactor * 0.5);

  const farTint = lerpHexColor(0x4f7d6e, 0x1a223f, nightFactor);
  const midTint = lerpHexColor(0x2e5849, 0x11182c, nightFactor);
  const fogColor = lerpHexColor(0xccead6, 0x0b1426, nightFactor);
  const fogAlpha = lerp(0.14, 0.34, nightFactor);

  // Darkness veil over world (reduced sharply when Night Vision is active!)
  const rawDarkness = lerp(0.0, 0.38, nightFactor);
  const ambientDarknessAlpha = nightVisionActive ? rawDarkness * 0.28 : rawDarkness;

  // Sunbeams fade out at dusk/night; fireflies & bioluminescence glow up at night
  const sunbeamAlpha = Math.max(0, lerp(0.18, 0.0, nightFactor * 1.35));
  const fireflyAlpha = Math.max(0.08, lerp(0.1, 0.95, nightFactor));
  const starAlpha = Math.max(0, (nightFactor - 0.35) / 0.65);

  // Celestial arc (Sun in day half, Moon in night half)
  const isNightDominant = nightFactor >= 0.5;
  const celestialColor = isNightDominant
    ? lerpHexColor(0xe2e8f0, 0xbbe6ff, nightFactor)
    : lerpHexColor(0xfff5c0, 0xfb923c, twilightFactor * 0.7);

  // Gameplay mechanics influenced by Day/Night Cycle:
  // 1. Enemies detect Kael farther in bright daylight (1.12x) and closer in night shadow (0.70x)
  const enemyDetectionMultiplier = lerp(1.12, 0.70, nightFactor);
  // 2. Night Vision grants extra crit & energy resonance in darker hours
  const nightVisionCritBonus = nightVisionActive ? lerp(0.18, 0.35, nightFactor) : 0;
  const nightwalkerEnergyBonus = nightFactor >= 0.5 ? (nightVisionActive ? 4.5 : 2.0) : 0;

  return {
    cycleProgress: wrapped,
    nightFactor,
    twilightFactor,
    period,
    isNightDominant,
    skyTop,
    skyBottom,
    farTint,
    midTint,
    fogColor,
    fogAlpha,
    ambientDarknessAlpha,
    sunbeamAlpha,
    fireflyAlpha,
    starAlpha,
    celestialColor,
    enemyDetectionMultiplier,
    nightVisionCritBonus,
    nightwalkerEnergyBonus,
  };
}

export class DayNightCycle {
  constructor({ initialMode = 'night', cycleDurationSec = 76, autoCycle = true } = {}) {
    this.cycleDurationSec = cycleDurationSec;
    this.autoCycle = autoCycle;
    this.progress = initialMode === 'day' ? 0.0 : 0.5;
    this.transitionTarget = null;
    this.transitionSpeed = 1.4; // Full shift in ~0.7s when manually toggled
  }

  setModeImmediate(mode) {
    this.progress = mode === 'day' ? 0.0 : 0.5;
    this.transitionTarget = null;
  }

  toggleTargetMode() {
    const currentlyNight = computeNightFactor(this.progress) >= 0.5;
    this.transitionTarget = currentlyNight ? 0.0 : 0.5;
    return currentlyNight ? 'day' : 'night';
  }

  setTargetMode(mode) {
    this.transitionTarget = mode === 'day' ? 0.0 : 0.5;
  }

  update(dt) {
    if (this.transitionTarget !== null) {
      // Smoothly transition along shortest circular arc toward target phase
      let diff = this.transitionTarget - this.progress;
      if (diff > 0.5) diff -= 1;
      if (diff < -0.5) diff += 1;
      const step = this.transitionSpeed * dt;
      if (Math.abs(diff) <= step) {
        this.progress = this.transitionTarget;
        this.transitionTarget = null;
      } else {
        this.progress = ((this.progress + Math.sign(diff) * step) % 1 + 1) % 1;
      }
      return this.progress;
    }

    if (this.autoCycle) {
      this.progress = (this.progress + dt / this.cycleDurationSec) % 1;
    }
    return this.progress;
  }

  getState(palette, nightVisionActive = false) {
    return evaluateCycleLighting(this.progress, palette, nightVisionActive);
  }
}

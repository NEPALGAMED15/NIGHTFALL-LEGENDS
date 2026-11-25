export const DIFFICULTY_TIERS = [
  {
    id: 'easy',
    label: 'EASY',
    minLevel: 1,
    maxLevel: 100,
    color: '#2dd4bf',
    hpMult: 0.9,
    dmgMult: 0.85,
    speedMult: 0.92,
    detectMult: 0.88,
    baseEnemyCount: 5,
    hazardRate: 0.25,
    platformComplexity: 1,
    bossPhases: 2,
    puzzleDepth: 1,
  },
  {
    id: 'normal',
    label: 'NORMAL',
    minLevel: 101,
    maxLevel: 300,
    color: '#38bdf8',
    hpMult: 1.2,
    dmgMult: 1.05,
    speedMult: 1.02,
    detectMult: 1.0,
    baseEnemyCount: 7,
    hazardRate: 0.45,
    platformComplexity: 2,
    bossPhases: 2,
    puzzleDepth: 1,
  },
  {
    id: 'hard',
    label: 'HARD',
    minLevel: 301,
    maxLevel: 600,
    color: '#f59e0b',
    hpMult: 1.55,
    dmgMult: 1.25,
    speedMult: 1.12,
    detectMult: 1.1,
    baseEnemyCount: 9,
    hazardRate: 0.65,
    platformComplexity: 3,
    bossPhases: 3,
    puzzleDepth: 2,
  },
  {
    id: 'very_hard',
    label: 'VERY HARD',
    minLevel: 601,
    maxLevel: 850,
    color: '#f97316',
    hpMult: 2.0,
    dmgMult: 1.48,
    speedMult: 1.22,
    detectMult: 1.2,
    baseEnemyCount: 11,
    hazardRate: 0.82,
    platformComplexity: 4,
    bossPhases: 3,
    puzzleDepth: 2,
  },
  {
    id: 'nightmare',
    label: 'NIGHTMARE',
    minLevel: 851,
    maxLevel: 1000,
    color: '#f43f5e',
    hpMult: 2.55,
    dmgMult: 1.75,
    speedMult: 1.32,
    detectMult: 1.3,
    baseEnemyCount: 13,
    hazardRate: 0.95,
    platformComplexity: 5,
    bossPhases: 3,
    puzzleDepth: 3,
  },
];

export function getDifficultyTierForLevel(levelNumber) {
  const lv = Math.max(1, Math.min(1000, Math.round(levelNumber || 1)));
  return (
    DIFFICULTY_TIERS.find((t) => lv >= t.minLevel && lv <= t.maxLevel) ||
    DIFFICULTY_TIERS[DIFFICULTY_TIERS.length - 1]
  );
}

/**
 * Returns deterministic difficulty parameters scaled smoothly within the level's tier.
 */
export function getDifficultyProfile(levelNumber) {
  const lv = Math.max(1, Math.min(1000, Math.round(levelNumber || 1)));
  const tier = getDifficultyTierForLevel(lv);
  const span = Math.max(1, tier.maxLevel - tier.minLevel);
  const withinTier = (lv - tier.minLevel) / span; // 0..1

  const hpScale = Number((tier.hpMult + withinTier * 0.25).toFixed(2));
  const dmgScale = Number((tier.dmgMult + withinTier * 0.14).toFixed(2));
  const speedScale = Number((tier.speedMult + withinTier * 0.08).toFixed(2));
  const detectScale = Number((tier.detectMult + withinTier * 0.06).toFixed(2));

  const enemyCount = Math.min(18, tier.baseEnemyCount + Math.floor(withinTier * 3));
  const hazardDensity = Number(Math.min(1, tier.hazardRate + withinTier * 0.1).toFixed(2));
  const rewardMultiplier = Number((1 + lv * 0.0035).toFixed(2));

  return {
    levelNumber: lv,
    tierId: tier.id,
    tierLabel: tier.label,
    tierColor: tier.color,
    hpScale,
    dmgScale,
    speedScale,
    detectScale,
    enemyCount,
    hazardDensity,
    platformComplexity: tier.platformComplexity,
    bossPhases: tier.bossPhases,
    puzzleDepth: tier.puzzleDepth,
    rewardMultiplier,
  };
}

export function getBonusDifficultyProfile(bonusOrder = 1) {
  // Bonus worlds 1..15 span pleasant story missions up to Final Battle Nightmare
  if (bonusOrder === 15) {
    return {
      ...getDifficultyProfile(980),
      tierLabel: 'NIGHTMARE',
      tierColor: '#f43f5e',
    };
  }
  const equivLevel = Math.min(820, 40 + (bonusOrder - 1) * 52);
  return getDifficultyProfile(equivLevel);
}

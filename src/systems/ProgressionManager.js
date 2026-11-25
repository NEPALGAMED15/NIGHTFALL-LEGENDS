import { PLAYER_BASE_STATS } from '../config.js';

export const UPGRADE_CATALOG = [
  {
    id: 'swordLevel',
    name: 'Nightfang Edge',
    description: 'Increases Nightfang sword & Soul Strike damage (+6 ATK / tier)',
    maxLevel: 10,
    baseCostCoins: 90,
    costStepCoins: 75,
    gemInterval: 3, // Requires 1 gem every 3 tiers
  },
  {
    id: 'armorLevel',
    name: 'Nightwalker Mail',
    description: 'Reinforces black-silver armor (+15 Max HP / tier)',
    maxLevel: 10,
    baseCostCoins: 80,
    costStepCoins: 65,
    gemInterval: 3,
  },
  {
    id: 'energyLevel',
    name: 'Lunar Core',
    description: 'Expands Shadow Energy reserve & regen (+12 EN / tier)',
    maxLevel: 10,
    baseCostCoins: 85,
    costStepCoins: 70,
    gemInterval: 4,
  },
  {
    id: 'visionLevel',
    name: 'Eclipse Mastery',
    description: 'Enhances Night Vision crit & ability potency (+3% Crit / tier)',
    maxLevel: 8,
    baseCostCoins: 110,
    costStepCoins: 95,
    gemInterval: 2,
  },
];

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'Awakened Blade', description: 'Clear Campaign Level 1' },
  { id: 'ten_levels', name: 'Nightwalker Scout', description: 'Clear 10 Campaign Levels' },
  { id: 'boss_slayer', name: 'Warden Breaker', description: 'Defeat a Kingdom Boss' },
  { id: 'kingdom_conqueror', name: 'Whispering Conqueror', description: 'Clear Level 150 (Whispering Forest)' },
  { id: 'bonus_explorer', name: 'World Hopper', description: 'Clear any Bonus World' },
  { id: 'blacksmith_upgrade', name: 'Tempered Nightfang', description: 'Upgrade any gear in the Armory' },
  { id: 'century_walker', name: 'Century Legend', description: 'Reach Campaign Level 100' },
  { id: 'final_eclipse', name: 'Legend of Nightfall', description: 'Clear Level 1000 or Final Battle World' },
];

export function xpRequiredForPlayerLevel(playerLevel) {
  return Math.round(120 + (playerLevel - 1) * 85 + Math.pow(playerLevel - 1, 1.35) * 20);
}

export function applyXpGain(currentPlayerLevel, currentXp, gainedXp) {
  let lv = Math.max(1, currentPlayerLevel || 1);
  let xp = Math.max(0, (currentXp || 0) + Math.max(0, Math.round(gainedXp || 0)));
  let levelsGained = 0;

  while (xp >= xpRequiredForPlayerLevel(lv) && lv < 100) {
    xp -= xpRequiredForPlayerLevel(lv);
    lv += 1;
    levelsGained += 1;
  }

  return { playerLevel: lv, xp, levelsGained, nextLevelXp: xpRequiredForPlayerLevel(lv) };
}

export function getUpgradeCost(upgradeId, currentTier = 1) {
  const def = UPGRADE_CATALOG.find((u) => u.id === upgradeId);
  if (!def || currentTier >= def.maxLevel) return null;
  const coins = def.baseCostCoins + (currentTier - 1) * def.costStepCoins;
  const gems = currentTier % def.gemInterval === 0 ? 1 : 0;
  return { coins, gems, nextTier: currentTier + 1 };
}

export function purchaseUpgrade(saveData, upgradeId) {
  const def = UPGRADE_CATALOG.find((u) => u.id === upgradeId);
  if (!def) return { ok: false, reason: 'unknown', saveData };

  const upgrades = {
    swordLevel: 1,
    armorLevel: 1,
    energyLevel: 1,
    visionLevel: 1,
    ...(saveData.upgrades || {}),
  };

  const curTier = upgrades[upgradeId] || 1;
  if (curTier >= def.maxLevel) return { ok: false, reason: 'maxed', saveData };

  const cost = getUpgradeCost(upgradeId, curTier);
  const coins = saveData.coins || 0;
  const gems = saveData.totalGems || 0;
  if (coins < cost.coins) return { ok: false, reason: 'coins', saveData };
  if (gems < cost.gems) return { ok: false, reason: 'gems', saveData };

  const nextUpgrades = { ...upgrades, [upgradeId]: curTier + 1 };
  const achievements = Array.from(new Set([...(saveData.achievements || []), 'blacksmith_upgrade']));

  return {
    ok: true,
    cost,
    saveData: {
      ...saveData,
      coins: coins - cost.coins,
      totalGems: gems - cost.gems,
      upgrades: nextUpgrades,
      achievements,
    },
  };
}

export function getPlayerUpgradedStats(saveData) {
  const up = {
    swordLevel: 1,
    armorLevel: 1,
    energyLevel: 1,
    visionLevel: 1,
    ...(saveData?.upgrades || {}),
  };
  const playerLevel = Math.max(1, saveData?.playerLevel || 1);
  const lvDmgBonus = Math.floor((playerLevel - 1) * 1.5);
  const lvHpBonus = Math.floor((playerLevel - 1) * 4);

  return {
    maxHealth: PLAYER_BASE_STATS.maxHealth + (up.armorLevel - 1) * 15 + lvHpBonus,
    maxEnergy: PLAYER_BASE_STATS.maxEnergy + (up.energyLevel - 1) * 12,
    energyRegenPerSec: PLAYER_BASE_STATS.energyRegenPerSec + (up.energyLevel - 1) * 0.8,
    baseDamage: PLAYER_BASE_STATS.baseDamage + (up.swordLevel - 1) * 6 + lvDmgBonus,
    critBonus: (up.visionLevel - 1) * 0.03,
    playerLevel,
  };
}

export function computeStarRating({ hpRemaining, maxHealth, shardsCollected, totalShards, clearTimeSec, targetTimeSec = 140 }) {
  let stars = 1;
  const hpRatio = maxHealth > 0 ? hpRemaining / maxHealth : 1;
  const shardRatio = totalShards > 0 ? shardsCollected / totalShards : 1;
  if (hpRatio >= 0.45 && clearTimeSec <= targetTimeSec * 1.35) stars += 1;
  if (hpRatio >= 0.7 && shardRatio >= 0.5 && clearTimeSec <= targetTimeSec) stars += 1;
  return Math.min(3, Math.max(1, stars));
}

export function computeLevelRewards({ levelNumber, score, stars, isBossLevel, isBonusWorld = false }) {
  const baseCoins = isBonusWorld ? 80 : 35 + Math.floor(levelNumber * 0.45);
  const coinBonus = stars * 15 + (isBossLevel ? 60 : 0) + Math.floor((score || 0) / 140);
  const xp = isBonusWorld ? 140 + stars * 40 : 65 + Math.floor(levelNumber * 0.65) + stars * 25 + (isBossLevel ? 90 : 0);
  const bonusGems = isBossLevel || stars === 3 ? 1 : 0;
  return {
    coins: baseCoins + coinBonus,
    xp,
    bonusGems,
  };
}

export function evaluateAchievements(saveData, { clearedLevel = null, wasBossLevel = false, clearedBonusId = null } = {}) {
  const earned = new Set(saveData.achievements || []);
  const completedCount = Object.keys(saveData.levelStars || {}).length;
  const highest = saveData.highestUnlockedLevel || 1;

  if (clearedLevel >= 1 || completedCount >= 1) earned.add('first_blood');
  if (completedCount >= 10 || highest >= 11) earned.add('ten_levels');
  if (wasBossLevel) earned.add('boss_slayer');
  if (clearedLevel >= 150 || highest > 150) earned.add('kingdom_conqueror');
  if (clearedBonusId || (saveData.completedBonusWorlds || []).length > 0) earned.add('bonus_explorer');
  if (highest >= 100 || clearedLevel >= 100) earned.add('century_walker');
  if (clearedLevel >= 1000 || clearedBonusId === 'final-battle-world') earned.add('final_eclipse');

  return Array.from(earned);
}

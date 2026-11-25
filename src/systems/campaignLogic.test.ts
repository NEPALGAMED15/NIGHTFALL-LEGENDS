import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINGDOM_DEFINITIONS,
  TOTAL_CAMPAIGN_LEVELS,
  getKingdomForLevel,
} from './KingdomManager.js';
import { BONUS_WORLDS, isBonusWorldUnlocked } from './BonusWorldManager.js';
import { getDifficultyProfile, getDifficultyTierForLevel } from './DifficultyManager.js';
import {
  generateBonusWorldLevel,
  generateCampaignLevel,
  validateLevelReachability,
} from './LevelGenerator.js';
import { buildFullBackgroundManifest } from './BackgroundManager.js';
import {
  applyXpGain,
  computeLevelRewards,
  computeStarRating,
  purchaseUpgrade,
} from './ProgressionManager.js';
import { SaveSystem } from './SaveSystem.js';

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

test('Exact 7-Kingdom distribution sums to 1000 levels with exact ranges', () => {
  assert.equal(TOTAL_CAMPAIGN_LEVELS, 1000);
  assert.equal(KINGDOM_DEFINITIONS.length, 7);

  let expectedStart = 1;
  let totalCount = 0;
  for (const k of KINGDOM_DEFINITIONS) {
    assert.equal(k.startLevel, expectedStart);
    const span = k.endLevel - k.startLevel + 1;
    totalCount += span;
    expectedStart = k.endLevel + 1;
  }
  assert.equal(totalCount, 1000);
  assert.equal(getKingdomForLevel(1).kingdom.id, 'whispering-forest');
  assert.equal(getKingdomForLevel(150).kingdom.id, 'whispering-forest');
  assert.equal(getKingdomForLevel(151).kingdom.id, 'frozen-kingdom');
  assert.equal(getKingdomForLevel(301).kingdom.id, 'ashen-empire');
  assert.equal(getKingdomForLevel(451).kingdom.id, 'drowned-kingdom');
  assert.equal(getKingdomForLevel(601).kingdom.id, 'skyfall-kingdom');
  assert.equal(getKingdomForLevel(751).kingdom.id, 'shadow-realm');
  assert.equal(getKingdomForLevel(901).kingdom.id, 'eternal-citadel');
  assert.equal(getKingdomForLevel(1000).kingdom.id, 'eternal-citadel');
});

test('All 1000 campaign levels generate uniquely and pass physics reachability validation', () => {
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();

  for (let lv = 1; lv <= 1000; lv++) {
    const cfg = generateCampaignLevel(lv);
    assert.ok(!seenIds.has(cfg.id), `Duplicate level id ${cfg.id}`);
    seenIds.add(cfg.id);

    const check = validateLevelReachability(cfg);
    assert.equal(check.valid, true, `Level ${lv} failed reachability: ${check.issues.join('; ')}`);

    assert.ok((cfg.platforms || []).length >= 2, `Level ${lv} missing platforms`);
    assert.ok((cfg.collectibles || []).length >= 3, `Level ${lv} missing collectibles`);
    assert.ok((cfg.checkpoints || []).length >= 1, `Level ${lv} missing checkpoint`);

    seenSignatures.add(`${cfg.id}:${cfg.worldWidth}:${cfg.enemies.length}:${cfg.platforms.length}`);
  }

  assert.equal(seenIds.size, 1000);
  assert.equal(seenSignatures.size, 1000);
});

test('All 15 Bonus Worlds are distinct, outside main 1000 levels, and pass reachability validation', () => {
  assert.equal(BONUS_WORLDS.length, 15);
  const seenBonusIds = new Set<string>();

  for (const bw of BONUS_WORLDS) {
    assert.ok(!seenBonusIds.has(bw.id));
    seenBonusIds.add(bw.id);

    const cfg = generateBonusWorldLevel(bw.id);
    assert.equal(cfg.isBonusWorld, true);
    assert.equal(cfg.bonusWorldId, bw.id);
    const check = validateLevelReachability(cfg);
    assert.equal(check.valid, true, `Bonus ${bw.id} failed reachability: ${check.issues.join('; ')}`);
  }
  assert.equal(seenBonusIds.size, 15);
});

test('Background manifest produces 1000 unique main signatures and 15 unique bonus signatures', () => {
  const manifest = buildFullBackgroundManifest();
  assert.equal(manifest.main.length, 1000);
  assert.equal(manifest.bonus.length, 15);

  const mainSigs = new Set(manifest.main.map((m) => m.signature));
  const bonusSigs = new Set(manifest.bonus.map((b) => b.signature));
  assert.equal(mainSigs.size, 1000);
  assert.equal(bonusSigs.size, 15);
});

test('Difficulty tiers scale monotonically across EASY -> NORMAL -> HARD -> VERY HARD -> NIGHTMARE', () => {
  assert.equal(getDifficultyTierForLevel(1).label, 'EASY');
  assert.equal(getDifficultyTierForLevel(100).label, 'EASY');
  assert.equal(getDifficultyTierForLevel(101).label, 'NORMAL');
  assert.equal(getDifficultyTierForLevel(300).label, 'NORMAL');
  assert.equal(getDifficultyTierForLevel(301).label, 'HARD');
  assert.equal(getDifficultyTierForLevel(601).label, 'VERY HARD');
  assert.equal(getDifficultyTierForLevel(851).label, 'NIGHTMARE');
  assert.equal(getDifficultyTierForLevel(1000).label, 'NIGHTMARE');

  const d1 = getDifficultyProfile(1);
  const d250 = getDifficultyProfile(250);
  const d500 = getDifficultyProfile(500);
  const d800 = getDifficultyProfile(800);
  const d1000 = getDifficultyProfile(1000);

  assert.ok(d1.hpScale < d250.hpScale);
  assert.ok(d250.hpScale < d500.hpScale);
  assert.ok(d500.hpScale < d800.hpScale);
  assert.ok(d800.hpScale < d1000.hpScale);
  assert.ok(d1.dmgScale < d1000.dmgScale);
});

test('ProgressionManager & SaveSystem v2 persist level unlocks, stars, XP, Armory upgrades, and bonus unlocks', () => {
  const storage = createMemoryStorage();
  const sys = new SaveSystem(storage);

  let save = sys.load();
  assert.equal(save.highestUnlockedLevel, 1);
  assert.equal(isBonusWorldUnlocked(BONUS_WORLDS[0], save), true); // Ghost World unlocked at Lv.1
  assert.equal(isBonusWorldUnlocked(BONUS_WORLDS[1], save), false);

  const stars = computeStarRating({
    hpRemaining: 95,
    maxHealth: 100,
    shardsCollected: 5,
    totalShards: 6,
    clearTimeSec: 80,
  });
  assert.equal(stars, 3);

  const rewards = computeLevelRewards({ levelNumber: 1, score: 1500, stars: 3, isBossLevel: true });
  const { saved } = sys.recordLevelClear({
    levelNumber: 1,
    score: 1500,
    stars,
    shards: 5,
    gems: 1 + rewards.bonusGems,
    coinsEarned: rewards.coins,
    xpEarned: rewards.xp,
    wasBossLevel: true,
  });

  assert.equal(saved.highestUnlockedLevel, 2);
  assert.equal(saved.currentLevel, 2);
  assert.equal(saved.levelStars[1], 3);
  assert.ok(saved.achievements.includes('first_blood'));
  assert.ok(saved.achievements.includes('boss_slayer'));

  // Test Armory purchase
  const upgradeRes = purchaseUpgrade(saved, 'swordLevel');
  assert.equal(upgradeRes.ok, true);
  assert.equal(upgradeRes.saveData.upgrades.swordLevel, 2);
  assert.ok(upgradeRes.saveData.achievements.includes('blacksmith_upgrade'));

  // Test XP level up
  const xpRes = applyXpGain(1, 0, 500);
  assert.ok(xpRes.playerLevel >= 3);
  assert.ok(xpRes.levelsGained >= 2);
});

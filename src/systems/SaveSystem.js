import { ABILITIES, TIME_MODES } from '../config.js';
import { getKingdomForLevel } from './KingdomManager.js';
import { applyXpGain, evaluateAchievements } from './ProgressionManager.js';

export const SAVE_STORAGE_KEY = 'nightfall_legends_save_v2';
export const LEGACY_SAVE_STORAGE_KEY = 'nightfall_legends_save_v1';

export function generatePlayerUid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      return `NL-${hex}`;
    }
  } catch {
    // Fallback below
  }
  const rand = Math.floor(0x10000000 + Math.random() * 0xefffffff)
    .toString(16)
    .toUpperCase();
  return `NL-${rand}`;
}

export function createDefaultSave() {
  return {
    version: 2,
    playerUid: generatePlayerUid(),
    accountMode: 'guest',
    hasStarted: false,
    currentLevel: 1,
    highestUnlockedLevel: 1,
    currentKingdom: 'whispering-forest',
    unlockedKingdoms: ['whispering-forest'],
    completedKingdoms: [],
    levelStars: {}, // { [levelNumber]: 1 | 2 | 3 }
    levelBestScores: {}, // { [levelNumber]: number }
    unlockedBonusWorlds: ['ghost-world'],
    completedBonusWorlds: [],
    playerLevel: 1,
    xp: 0,
    coins: 0,
    bestScore: 0,
    totalShards: 0,
    totalGems: 0,
    upgrades: {
      swordLevel: 1,
      armorLevel: 1,
      energyLevel: 1,
      visionLevel: 1,
    },
    achievements: [],
    abilitiesUnlocked: ABILITIES.map((a) => a.id),
    lastCheckpoint: null,
    lastCheckpointLevel: null,
    settings: {
      dayNightMode: TIME_MODES.NIGHT,
      muted: false,
      volume: 0.65,
      touchControls: 'auto', // 'auto' | 'always' | 'off'
    },
    updatedAt: null,
  };
}

function getStorage(storageOverride) {
  if (storageOverride) return storageOverride;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export class SaveSystem {
  /** @param {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null} [storageOverride] */
  constructor(storageOverride = null) {
    this.storage = getStorage(storageOverride);
  }

  load() {
    const defaults = createDefaultSave();
    if (!this.storage) return defaults;
    try {
      const raw =
        this.storage.getItem(SAVE_STORAGE_KEY) ||
        this.storage.getItem(LEGACY_SAVE_STORAGE_KEY);
      if (!raw) {
        try {
          this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(defaults));
        } catch {
          // ignore
        }
        return defaults;
      }
      const parsed = JSON.parse(raw);
      const merged = {
        ...defaults,
        ...parsed,
        playerUid: typeof parsed.playerUid === 'string' && parsed.playerUid ? parsed.playerUid : defaults.playerUid,
        accountMode: parsed.accountMode || 'guest',
        currentLevel: Math.max(1, Math.min(1000, parsed.currentLevel || 1)),
        highestUnlockedLevel: Math.max(1, Math.min(1000, parsed.highestUnlockedLevel || 1)),
        unlockedKingdoms:
          Array.isArray(parsed.unlockedKingdoms) && parsed.unlockedKingdoms.length > 0
            ? Array.from(new Set(['whispering-forest', ...parsed.unlockedKingdoms]))
            : defaults.unlockedKingdoms,
        completedKingdoms: Array.isArray(parsed.completedKingdoms)
          ? Array.from(new Set(parsed.completedKingdoms))
          : [],
        unlockedBonusWorlds: Array.isArray(parsed.unlockedBonusWorlds)
          ? Array.from(new Set(['ghost-world', ...parsed.unlockedBonusWorlds]))
          : defaults.unlockedBonusWorlds,
        completedBonusWorlds: Array.isArray(parsed.completedBonusWorlds)
          ? Array.from(new Set(parsed.completedBonusWorlds))
          : [],
        levelStars: parsed.levelStars && typeof parsed.levelStars === 'object' ? parsed.levelStars : {},
        levelBestScores:
          parsed.levelBestScores && typeof parsed.levelBestScores === 'object' ? parsed.levelBestScores : {},
        upgrades: {
          ...defaults.upgrades,
          ...(parsed.upgrades || {}),
        },
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
        abilitiesUnlocked:
          Array.isArray(parsed.abilitiesUnlocked) && parsed.abilitiesUnlocked.length > 0
            ? parsed.abilitiesUnlocked
            : defaults.abilitiesUnlocked,
        settings: {
          ...defaults.settings,
          ...(parsed.settings || {}),
        },
      };
      if (!parsed.playerUid) {
        try {
          this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }
      }
      return merged;
    } catch {
      return defaults;
    }
  }

  save(data) {
    const merged = {
      ...createDefaultSave(),
      ...data,
      updatedAt: new Date().toISOString(),
    };
    if (this.storage) {
      try {
        this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Ignore quota/private mode errors gracefully
      }
    }
    return merged;
  }

  hasContinueData() {
    const data = this.load();
    return Boolean(
      data.hasStarted ||
        data.highestUnlockedLevel > 1 ||
        Object.keys(data.levelStars || {}).length > 0 ||
        data.completedKingdoms.length > 0 ||
        data.bestScore > 0
    );
  }

  updateSettings(partialSettings) {
    const current = this.load();
    return this.save({
      ...current,
      settings: {
        ...current.settings,
        ...partialSettings,
      },
    });
  }

  /**
   * Records a Campaign Level clear (1..1000), unlocking level N+1, stars, XP, coins, gems & achievements.
   */
  recordLevelClear({
    levelNumber,
    score = 0,
    stars = 1,
    shards = 0,
    gems = 0,
    coinsEarned = 0,
    xpEarned = 0,
    wasBossLevel = false,
  }) {
    const current = this.load();
    const lv = Math.max(1, Math.min(1000, Math.round(levelNumber || 1)));
    const nextLevel = lv < 1000 ? lv + 1 : 1000;
    const info = getKingdomForLevel(lv);
    const nextInfo = getKingdomForLevel(nextLevel);

    const prevStars = current.levelStars[lv] || 0;
    const nextLevelStars = { ...current.levelStars, [lv]: Math.max(prevStars, stars) };
    const prevBest = current.levelBestScores[lv] || 0;
    const nextLevelBestScores = {
      ...current.levelBestScores,
      [lv]: Math.max(prevBest, Math.round(score)),
    };

    const highestUnlocked = Math.max(current.highestUnlockedLevel || 1, lv < 1000 ? lv + 1 : 1000);
    const unlockedKingdoms = Array.from(
      new Set([...current.unlockedKingdoms, info.kingdom.id, nextInfo.kingdom.id])
    );
    const completedKingdoms = info.isKingdomFinale
      ? Array.from(new Set([...current.completedKingdoms, info.kingdom.id]))
      : current.completedKingdoms;

    const xpResult = applyXpGain(current.playerLevel, current.xp, xpEarned);

    const draft = {
      ...current,
      hasStarted: true,
      currentLevel: nextLevel,
      highestUnlockedLevel: highestUnlocked,
      currentKingdom: nextInfo.kingdom.id,
      unlockedKingdoms,
      completedKingdoms,
      levelStars: nextLevelStars,
      levelBestScores: nextLevelBestScores,
      playerLevel: xpResult.playerLevel,
      xp: xpResult.xp,
      coins: (current.coins || 0) + Math.round(coinsEarned),
      bestScore: Math.max(current.bestScore || 0, Math.round(score)),
      totalShards: (current.totalShards || 0) + (shards || 0),
      totalGems: (current.totalGems || 0) + (gems || 0),
      lastCheckpoint: null,
      lastCheckpointLevel: null,
    };

    draft.achievements = evaluateAchievements(draft, { clearedLevel: lv, wasBossLevel });
    return { saved: this.save(draft), xpResult };
  }

  recordBonusWorldClear({ bonusWorldId, score = 0, shards = 0, gems = 0, coinsEarned = 0, xpEarned = 0 }) {
    const current = this.load();
    const completedBonusWorlds = Array.from(
      new Set([...(current.completedBonusWorlds || []), bonusWorldId])
    );
    const unlockedBonusWorlds = Array.from(
      new Set([...(current.unlockedBonusWorlds || []), bonusWorldId])
    );
    const xpResult = applyXpGain(current.playerLevel, current.xp, xpEarned);

    const draft = {
      ...current,
      hasStarted: true,
      unlockedBonusWorlds,
      completedBonusWorlds,
      playerLevel: xpResult.playerLevel,
      xp: xpResult.xp,
      coins: (current.coins || 0) + Math.round(coinsEarned),
      bestScore: Math.max(current.bestScore || 0, Math.round(score)),
      totalShards: (current.totalShards || 0) + (shards || 0),
      totalGems: (current.totalGems || 0) + (gems || 0),
      lastCheckpoint: null,
    };
    draft.achievements = evaluateAchievements(draft, { clearedBonusId: bonusWorldId });
    return { saved: this.save(draft), xpResult };
  }

  unlockBonusWorldWithGems(bonusWorldId, gemCost) {
    const current = this.load();
    if ((current.unlockedBonusWorlds || []).includes(bonusWorldId)) {
      return { ok: true, saveData: current };
    }
    if ((current.totalGems || 0) < gemCost) {
      return { ok: false, reason: 'gems', saveData: current };
    }
    const saved = this.save({
      ...current,
      totalGems: current.totalGems - gemCost,
      unlockedBonusWorlds: Array.from(new Set([...(current.unlockedBonusWorlds || []), bonusWorldId])),
    });
    return { ok: true, saveData: saved };
  }

  // Backwards-compatible helper preserved for existing tests and kingdom callers
  recordKingdomClear({ kingdomId, nextKingdomId, score, shards, gems }) {
    const current = this.load();
    const completed = Array.from(new Set([...current.completedKingdoms, kingdomId]));
    const unlocked = nextKingdomId
      ? Array.from(new Set([...current.unlockedKingdoms, nextKingdomId]))
      : current.unlockedKingdoms;
    return this.save({
      ...current,
      hasStarted: true,
      currentKingdom: nextKingdomId || kingdomId,
      unlockedKingdoms: unlocked,
      completedKingdoms: completed,
      bestScore: Math.max(current.bestScore, Math.round(score || 0)),
      totalShards: current.totalShards + (shards || 0),
      totalGems: current.totalGems + (gems || 0),
      lastCheckpoint: null,
    });
  }

  saveProgress({ kingdomId, levelNumber, checkpointId, score }) {
    const current = this.load();
    return this.save({
      ...current,
      hasStarted: true,
      currentLevel: levelNumber || current.currentLevel,
      currentKingdom: kingdomId || current.currentKingdom,
      bestScore: Math.max(current.bestScore, Math.round(score || 0)),
      lastCheckpoint: checkpointId || current.lastCheckpoint,
      lastCheckpointLevel: levelNumber || current.lastCheckpointLevel,
    });
  }

  reset() {
    const fresh = createDefaultSave();
    if (this.storage) {
      try {
        this.storage.removeItem(SAVE_STORAGE_KEY);
        this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return fresh;
  }
}

export const saveSystem = new SaveSystem();

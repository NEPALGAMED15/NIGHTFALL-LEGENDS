import { PHYSICS_CONFIG } from '../config.js';
import { KINGDOMS } from '../levels/kingdoms.js';
import { BONUS_WORLDS, getBonusWorldById } from './BonusWorldManager.js';
import { getDifficultyProfile, getBonusDifficultyProfile } from './DifficultyManager.js';
import { getKingdomForLevel } from './KingdomManager.js';
import { LEVEL_TEMPLATE_TYPES, buildChunkGeometry } from './LevelTemplates.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function scaleHandcraftedWhisperingForest(base, levelNumber, info, diff) {
  // Preserve handcrafted Level 1 Whispering Forest layout cleanly, with level metadata attached
  return {
    ...base,
    levelNumber,
    id: `level-${String(levelNumber).padStart(4, '0')}`,
    kingdomId: info.kingdom.id,
    kingdomOrder: info.kingdom.order,
    kingdomName: info.kingdom.name,
    subBiome: info.subBiome,
    subtitle: `${info.subBiome} · Level ${levelNumber}`,
    difficulty: diff,
    weatherType: info.kingdom.weatherType,
    biomeMechanic: info.kingdom.biomeMechanic,
    terrainStyle: info.kingdom.terrainStyle,
    landmarkStyle: info.kingdom.landmarkStyle,
    isBossLevel: true,
    isMiniBossLevel: false,
    isBonusWorld: false,
    ladders: [],
    bridges: [],
    objective: {
      type: 'defeat_boss',
      label: `Defeat ${info.kingdom.bossName} & Enter Portal`,
      targetCount: 1,
    },
    backgroundSpec: {
      seed: 10001,
      kingdomId: info.kingdom.id,
      subBiome: info.subBiome,
      levelNumber,
    },
  };
}

function scaleEnemyStats(enemyCfg, diff) {
  return {
    ...enemyCfg,
    hpMult: diff.hpScale,
    dmgMult: diff.dmgScale,
    speedMult: diff.speedScale,
    detectMult: diff.detectScale,
  };
}

/**
 * Generates any of the 1000 unique main campaign levels deterministically.
 */
export function generateCampaignLevel(levelNumber) {
  const lv = Math.max(1, Math.min(1000, Math.round(levelNumber || 1)));
  const info = getKingdomForLevel(lv);
  const diff = getDifficultyProfile(lv);

  // Level 1 preserves the iconic handcrafted Whispering Forest showcase
  if (lv === 1) {
    return scaleHandcraftedWhisperingForest(KINGDOMS[0], 1, info, diff);
  }

  const rng = mulberry32(lv * 2654435761 + info.kingdom.order * 97);
  const groundY = 620;
  const worldHeight = 720;

  // Determine how many modular chunks compose this level (3..5 chunks + entrance + exit/arena)
  const chunkCount = info.isBossLevel ? 3 : Math.min(5, 3 + Math.floor(diff.platformComplexity / 2));
  const tintNum = parseInt(info.kingdom.palette.accent.replace('#', ''), 16);

  let cursorX = 360;
  const groundGaps = [];
  const platforms = [];
  const ladders = [];
  const bridges = [];
  const hazards = [];
  const crates = [];
  const collectibles = [];
  const checkpoints = [];
  const enemies = [];
  let gate = null;

  // Pick varied chunk sequence (at most 1 gate_puzzle per level)
  let usedGate = false;
  for (let i = 0; i < chunkCount; i++) {
    let candidates = LEVEL_TEMPLATE_TYPES.filter((t) => !usedGate || t !== 'gate_puzzle');
    if (i === 0) candidates = ['canopy_steps', 'chasm_bridge', 'ladder_spire', 'breakable_vault'];
    const picked = candidates[Math.floor(rng() * candidates.length)];
    if (picked === 'gate_puzzle') usedGate = true;

    const chunk = buildChunkGeometry(picked, cursorX, groundY, {
      rng,
      biomeMechanic: info.kingdom.biomeMechanic,
      hazardDensity: diff.hazardDensity,
      difficulty: diff,
      levelSeed: `L${lv}`,
      chunkIdx: i,
    });

    groundGaps.push(...chunk.groundGaps);
    platforms.push(...chunk.platforms);
    ladders.push(...chunk.ladders);
    bridges.push(...chunk.bridges);
    hazards.push(...chunk.hazards);
    crates.push(...chunk.crates);
    collectibles.push(...chunk.collectibles);
    for (const e of chunk.enemies) {
      enemies.push(
        scaleEnemyStats(
          {
            ...e,
            variantTint: info.kingdom.order > 1 ? tintNum : null,
          },
          diff
        )
      );
    }
    if (chunk.gate && !gate) {
      gate = chunk.gate;
    }

    // Add a checkpoint midway through larger levels
    if (i === Math.floor(chunkCount / 2) - 1) {
      checkpoints.push({
        id: `L${lv}_cp1`,
        x: cursorX + chunk.width + 65,
        y: groundY - 50,
        name: `${info.subBiome} Shrine`,
      });
      cursorX += chunk.width + 130;
    } else {
      cursorX += chunk.width;
    }
  }

  // Ensure minimum enemy density matching difficulty curve
  while (enemies.length < Math.min(diff.enemyCount, chunkCount * 2)) {
    const idx = enemies.length;
    const ex = 520 + ((idx * 410) % Math.max(400, cursorX - 580));
    const types = ['blight_stalker', 'spore_wisp', 'bramble_sentinel'];
    enemies.push(
      scaleEnemyStats(
        {
          id: `L${lv}_extra_${idx}`,
          type: types[(lv + idx) % types.length],
          x: ex,
          y: types[(lv + idx) % types.length] === 'spore_wisp' ? groundY - 170 : groundY - 40,
          patrolMin: Math.max(220, ex - 120),
          patrolMax: Math.min(cursorX - 60, ex + 120),
          variantTint: info.kingdom.order > 1 ? tintNum : null,
        },
        diff
      )
    );
  }

  // Mini-boss or Full Boss Arena vs Standard Exit Sanctuary
  let bossArena = null;
  let exitPortal = null;
  let worldWidth = cursorX + 460;

  if (info.isMiniBossLevel) {
    enemies.push(
      scaleEnemyStats(
        {
          id: `L${lv}_mb`,
          type: 'corrupted_treant',
          x: cursorX + 180,
          y: groundY - 60,
          patrolMin: cursorX + 40,
          patrolMax: cursorX + 340,
          isMiniBoss: true,
          variantTint: tintNum,
        },
        diff
      )
    );
  }

  if (info.isBossLevel) {
    checkpoints.push({
      id: `L${lv}_cp_boss`,
      x: cursorX + 60,
      y: groundY - 50,
      name: `${info.kingdom.bossName} Gate`,
    });
    const arenaStart = cursorX + 150;
    platforms.push({ x: arenaStart + 180, y: groundY - 130, w: 150, h: 22, ice: info.kingdom.biomeMechanic === 'ice' });
    platforms.push({ x: arenaStart + 540, y: groundY - 130, w: 150, h: 22, ice: info.kingdom.biomeMechanic === 'ice' });
    bossArena = {
      triggerX: arenaStart + 80,
      leftWallX: arenaStart,
      rightWallX: arenaStart + 900,
      bossSpawnX: arenaStart + 680,
      bossSpawnY: groundY - 80,
      exitPortalX: arenaStart + 990,
      exitPortalY: groundY - 55,
    };
    worldWidth = arenaStart + 1140;
  } else {
    exitPortal = {
      x: cursorX + 260,
      y: groundY - 55,
    };
    collectibles.push({
      id: `L${lv}_end_heal`,
      type: 'heal',
      x: cursorX + 80,
      y: groundY - 42,
    });
  }

  // Objective definition
  let objective;
  if (info.isBossLevel) {
    objective = {
      type: 'defeat_boss',
      label: `Defeat ${info.kingdom.bossName} & Enter Portal`,
      targetCount: 1,
    };
  } else if (info.isMiniBossLevel) {
    objective = {
      type: 'defeat_miniboss',
      label: 'Defeat the Area Guardian to Unlock Exit Portal',
      targetCount: 1,
    };
  } else if (gate) {
    objective = {
      type: 'unlock_gate',
      label: 'Activate the Rune Switch & Reach the Exit Portal',
      targetCount: 1,
    };
  } else {
    objective = {
      type: 'reach_exit',
      label: `Cross ${info.subBiome} & Enter Nightfall Portal`,
      targetCount: 1,
    };
  }

  return {
    id: `level-${String(lv).padStart(4, '0')}`,
    levelNumber: lv,
    order: info.kingdom.order,
    kingdomId: info.kingdom.id,
    kingdomOrder: info.kingdom.order,
    name: `${info.kingdom.name} · Lv. ${lv}`,
    kingdomName: info.kingdom.name,
    subBiome: info.subBiome,
    subtitle: `${info.subBiome} · ${diff.tierLabel}`,
    bossId: info.kingdom.bossId,
    bossName: info.kingdom.bossName,
    bossTitle: info.kingdom.bossTitle,
    difficulty: diff,
    isBossLevel: info.isBossLevel,
    isMiniBossLevel: info.isMiniBossLevel,
    isKingdomFinale: info.isKingdomFinale,
    isBonusWorld: false,
    worldWidth,
    worldHeight,
    groundY,
    spawn: { x: 110, y: groundY - 80 },
    palette: info.kingdom.palette,
    musicMood: info.kingdom.musicMood,
    weatherType: info.kingdom.weatherType,
    biomeMechanic: info.kingdom.biomeMechanic,
    terrainStyle: info.kingdom.terrainStyle,
    landmarkStyle: info.kingdom.landmarkStyle,
    groundGaps,
    platforms,
    ladders,
    bridges,
    crates,
    hazards,
    collectibles,
    checkpoints,
    gate,
    enemies,
    bossArena,
    exitPortal,
    objective,
    backgroundSpec: {
      seed: lv * 7919 + info.kingdom.order * 313,
      kingdomId: info.kingdom.id,
      subBiome: info.subBiome,
      levelNumber: lv,
      landmarkStyle: info.kingdom.landmarkStyle,
      weatherType: info.kingdom.weatherType,
    },
  };
}

/**
 * Generates any of the 15 separate Bonus Worlds deterministically.
 */
export function generateBonusWorldLevel(bonusWorldId) {
  const bw = getBonusWorldById(bonusWorldId);
  const diff = getBonusDifficultyProfile(bw.order);
  const rng = mulberry32(hashString(bw.id) ^ 0x9e3779b9);
  const groundY = 620;
  const worldHeight = 720;
  const tintNum = bw.palette.accentHex;

  const groundGaps = [];
  const platforms = [];
  const ladders = [];
  const bridges = [];
  const hazards = [];
  const crates = [];
  const collectibles = [];
  const checkpoints = [];
  const enemies = [];
  let gate = null;

  let cursorX = 360;
  const chunkSequence = bw.peaceful
    ? ['canopy_steps', 'chasm_bridge', 'ladder_spire']
    : bw.missionType === 'unlock_gate'
    ? ['canopy_steps', 'gate_puzzle', 'vision_secret_arch']
    : ['canopy_steps', 'moving_ferry', 'breakable_vault', 'chasm_bridge'];

  chunkSequence.forEach((chunkType, idx) => {
    const chunk = buildChunkGeometry(chunkType, cursorX, groundY, {
      rng,
      biomeMechanic: bw.biomeMechanic,
      hazardDensity: bw.peaceful ? 0 : diff.hazardDensity,
      difficulty: diff,
      levelSeed: bw.id,
      chunkIdx: idx,
    });

    groundGaps.push(...chunk.groundGaps);
    platforms.push(...chunk.platforms);
    ladders.push(...chunk.ladders);
    bridges.push(...chunk.bridges);
    if (!bw.peaceful) hazards.push(...chunk.hazards);
    crates.push(...chunk.crates);
    collectibles.push(...chunk.collectibles);
    if (chunk.gate && !gate) gate = chunk.gate;

    // Friendly ghosts or themed foes
    if (bw.hasFriendlyGhosts) {
      collectibles.push({ id: `${bw.id}_spirit_${idx}`, type: 'gem', x: cursorX + 340, y: groundY - 125 });
    }
    if (!bw.peaceful) {
      for (const e of chunk.enemies) {
        enemies.push(scaleEnemyStats({ ...e, variantTint: tintNum }, diff));
      }
    }

    if (idx === 1) {
      checkpoints.push({
        id: `${bw.id}_cp1`,
        x: cursorX + chunk.width + 60,
        y: groundY - 50,
        name: `${bw.name} Shrine`,
      });
      cursorX += chunk.width + 120;
    } else {
      cursorX += chunk.width;
    }
  });

  // Guarantee minimum relic count for relic missions
  let relicCount = collectibles.filter((c) => c.type === 'shard' || c.type === 'gem').length;
  while (relicCount < 5) {
    collectibles.push({
      id: `${bw.id}_rel_${relicCount}`,
      type: relicCount % 2 === 0 ? 'shard' : 'gem',
      x: 460 + relicCount * 320,
      y: groundY - 82,
    });
    relicCount++;
  }

  let bossArena = null;
  let exitPortal = null;
  let worldWidth = cursorX + 460;

  if (bw.bossId) {
    const arenaStart = cursorX + 140;
    platforms.push({ x: arenaStart + 180, y: groundY - 130, w: 150, h: 22 });
    platforms.push({ x: arenaStart + 540, y: groundY - 130, w: 150, h: 22 });
    bossArena = {
      triggerX: arenaStart + 80,
      leftWallX: arenaStart,
      rightWallX: arenaStart + 900,
      bossSpawnX: arenaStart + 680,
      bossSpawnY: groundY - 80,
      exitPortalX: arenaStart + 990,
      exitPortalY: groundY - 55,
    };
    worldWidth = arenaStart + 1140;
  } else {
    exitPortal = {
      x: cursorX + 250,
      y: groundY - 55,
    };
  }

  return {
    id: `bonus-${bw.id}`,
    bonusWorldId: bw.id,
    bonusOrder: bw.order,
    levelNumber: bw.order,
    order: bw.order,
    kingdomId: bw.id,
    name: bw.name,
    kingdomName: bw.name,
    subBiome: bw.themeTag,
    subtitle: bw.subtitle,
    bossId: bw.bossId,
    bossName: bw.bossName,
    bossTitle: bw.subtitle,
    difficulty: diff,
    isBossLevel: Boolean(bw.bossId),
    isMiniBossLevel: false,
    isBonusWorld: true,
    peaceful: Boolean(bw.peaceful),
    hasFriendlyGhosts: Boolean(bw.hasFriendlyGhosts),
    worldWidth,
    worldHeight,
    groundY,
    spawn: { x: 110, y: groundY - 80 },
    palette: bw.palette,
    musicMood: bw.musicMood,
    weatherType: bw.weatherType,
    biomeMechanic: bw.biomeMechanic,
    terrainStyle: bw.id,
    landmarkStyle: bw.landmarkStyle,
    groundGaps,
    platforms,
    ladders,
    bridges,
    crates,
    hazards,
    collectibles,
    checkpoints,
    gate,
    enemies,
    bossArena,
    exitPortal,
    objective: {
      type: bw.missionType,
      label: bw.missionLabel,
      targetCount: bw.missionType === 'collect_relics' ? 5 : 1,
    },
    backgroundSpec: {
      seed: hashString(bw.id),
      kingdomId: bw.id,
      bonusWorldId: bw.id,
      subBiome: bw.themeTag,
      landmarkStyle: bw.landmarkStyle,
      weatherType: bw.weatherType,
    },
  };
}

/**
 * Validates that every jump, chasm, platform height, and exit portal is physically reachable
 * under Kael's physics parameters without softlocks or impossible gaps.
 */
export function validateLevelReachability(levelCfg) {
  const issues = [];
  if (!levelCfg) return { valid: false, issues: ['Missing level config'] };

  const maxSingleJumpH = (PHYSICS_CONFIG.JUMP_VELOCITY ** 2) / (2 * PHYSICS_CONFIG.GRAVITY_Y);
  const maxDoubleJumpH =
    maxSingleJumpH + (PHYSICS_CONFIG.DOUBLE_JUMP_VELOCITY ** 2) / (2 * PHYSICS_CONFIG.GRAVITY_Y);
  const safeMaxStepH = maxDoubleJumpH + 22; // ~230px double jump height (or ladder-connected)

  // 1. Validate ground gaps have bridges, moving ferries, or jumpable width <= 220px
  for (const gap of levelCfg.groundGaps || []) {
    const gapW = gap.x2 - gap.x1;
    const hasBridge = (levelCfg.bridges || []).some((b) => b.x <= gap.x1 + 10 && b.x + b.w >= gap.x2 - 10);
    const hasPlatformSpan = (levelCfg.platforms || []).some((p) => {
      const span = p.moving ? p.w + p.moving.range : p.w;
      return p.x + span >= gap.x1 + 20 && p.x <= gap.x2 - 20;
    });
    if (gapW > 220 && !hasBridge && !hasPlatformSpan) {
      issues.push(`Unjumpable chasm ${gap.x1}..${gap.x2} (w=${gapW})`);
    }
  }

  // 2. Validate non-secret platforms are reachable from ground, ladder, or lower platform
  const ladders = levelCfg.ladders || [];
  const allPlats = levelCfg.platforms || [];
  for (const p of allPlats) {
    if (p.secret) continue;
    const stepFromGround = levelCfg.groundY - p.y;
    if (stepFromGround <= safeMaxStepH) continue;

    const hasLadder = ladders.some(
      (l) => l.x >= p.x - 30 && l.x <= p.x + p.w + 30 && l.topY <= p.y + 15 && l.bottomY >= levelCfg.groundY - 10
    );
    const hasSteppingPlat = allPlats.some(
      (other) => other !== p && !other.secret && other.y > p.y && other.y - p.y <= safeMaxStepH && Math.abs(other.x - p.x) <= 260
    );
    if (!hasLadder && !hasSteppingPlat) {
      issues.push(`Unreachable platform at (${p.x}, ${p.y})`);
    }
  }

  // 3. Validate spawn is on solid ground and clear of hazards
  for (const h of levelCfg.hazards || []) {
    if (Math.abs(h.x - levelCfg.spawn.x) < 120) {
      issues.push(`Hazard overlaps spawn area at x=${h.x}`);
    }
  }

  // 4. Validate exit portal exists inside world bounds and not over a pit
  const portalPos = levelCfg.bossArena
    ? { x: levelCfg.bossArena.exitPortalX, y: levelCfg.bossArena.exitPortalY }
    : levelCfg.exitPortal;
  if (!portalPos || portalPos.x <= levelCfg.spawn.x || portalPos.x >= levelCfg.worldWidth) {
    issues.push('Invalid exit portal coordinates');
  } else {
    const overGap = (levelCfg.groundGaps || []).some((g) => portalPos.x >= g.x1 && portalPos.x <= g.x2);
    if (overGap) {
      issues.push(`Exit portal placed over pit at x=${portalPos.x}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function getAllBonusWorldCount() {
  return BONUS_WORLDS.length;
}

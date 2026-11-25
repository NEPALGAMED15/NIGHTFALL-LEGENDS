/**
 * Modular, physics-validated level chunk templates.
 * Each template generates relative geometry at cursorX that is stitched seamlessly
 * by LevelGenerator and verified by validateLevelReachability.
 */

export const LEVEL_TEMPLATE_TYPES = [
  'canopy_steps',
  'chasm_bridge',
  'moving_ferry',
  'breakable_vault',
  'ladder_spire',
  'hazard_crossing',
  'vision_secret_arch',
  'gate_puzzle',
];

export function buildChunkGeometry(type, cursorX, groundY, ctx) {
  const { rng, biomeMechanic, hazardDensity, difficulty, levelSeed, chunkIdx } = ctx;
  const uid = `${levelSeed}_c${chunkIdx}`;

  const out = {
    width: 680,
    groundGaps: [],
    platforms: [],
    ladders: [],
    bridges: [],
    hazards: [],
    crates: [],
    collectibles: [],
    enemies: [],
    gate: null,
  };

  const hazardDmg = Math.round(14 * difficulty.dmgScale);
  const enemyPool = ['blight_stalker', 'spore_wisp', 'bramble_sentinel'];
  const pickEnemy = (offset = 0) => enemyPool[(Math.floor(rng() * 10) + offset) % enemyPool.length];
  const isIce = biomeMechanic === 'ice';
  const hazardKind = biomeMechanic === 'lava' ? 'lava' : biomeMechanic === 'water' ? 'abyssal_surge' : 'spikes';

  if (type === 'canopy_steps') {
    out.width = 680;
    const h1 = 102 + Math.floor(rng() * 16);
    const h2 = 186 + Math.floor(rng() * 18);
    out.platforms.push({ x: cursorX + 120, y: groundY - h1, w: 165, h: 24, ice: isIce });
    out.platforms.push({ x: cursorX + 340, y: groundY - h2, w: 170, h: 24, ice: isIce });
    out.collectibles.push({ id: `${uid}_s1`, type: 'shard', x: cursorX + 200, y: groundY - h1 - 40 });
    out.collectibles.push({ id: `${uid}_s2`, type: 'shard', x: cursorX + 425, y: groundY - h2 - 40 });
    out.crates.push({ id: `${uid}_cr1`, x: cursorX + 570, y: groundY - 24, loot: rng() < 0.35 ? 'heal' : 'shard' });
    out.enemies.push({
      id: `${uid}_e1`,
      type: pickEnemy(0),
      x: cursorX + 390,
      y: groundY - 40,
      patrolMin: cursorX + 160,
      patrolMax: cursorX + 610,
    });
  } else if (type === 'chasm_bridge') {
    out.width = 720;
    const gapW = 148 + Math.floor(rng() * 34); // <= 182px
    const gapStart = cursorX + 250;
    const gapEnd = gapStart + gapW;
    out.groundGaps.push({ x1: gapStart, x2: gapEnd });
    // Suspension bridge OR elevated stepping stone
    if (rng() < 0.52) {
      out.bridges.push({ x: gapStart - 10, y: groundY - 12, w: gapW + 20, h: 18 });
    } else {
      out.platforms.push({ x: gapStart + 18, y: groundY - 96, w: Math.max(115, gapW - 28), h: 24, ice: isIce });
    }
    out.collectibles.push({ id: `${uid}_s1`, type: 'shard', x: gapStart + gapW / 2, y: groundY - 142 });
    out.enemies.push({
      id: `${uid}_e1`,
      type: pickEnemy(1),
      x: gapEnd + 110,
      y: groundY - 40,
      patrolMin: gapEnd + 35,
      patrolMax: cursorX + 680,
    });
  } else if (type === 'moving_ferry') {
    out.width = 760;
    const gapStart = cursorX + 210;
    const gapEnd = cursorX + 510; // Covered safely by moving ferry + mid safety pier
    out.groundGaps.push({ x1: gapStart, x2: gapEnd });
    // Central fixed safety pillar ensures reachability even without waiting!
    out.platforms.push({ x: cursorX + 315, y: groundY - 90, w: 96, h: 22, ice: isIce });
    // Moving ferry gliding across the gap
    out.platforms.push({
      x: cursorX + 235,
      y: groundY - 145,
      w: 130,
      h: 22,
      moving: { axis: 'x', range: 145, speed: 1.15 + rng() * 0.45 },
    });
    out.collectibles.push({ id: `${uid}_g1`, type: rng() < 0.4 ? 'gem' : 'shard', x: cursorX + 360, y: groundY - 195 });
    out.enemies.push({
      id: `${uid}_e1`,
      type: 'spore_wisp',
      x: cursorX + 360,
      y: groundY - 220,
      patrolMin: cursorX + 210,
      patrolMax: cursorX + 540,
    });
  } else if (type === 'breakable_vault') {
    out.width = 700;
    out.platforms.push({ x: cursorX + 130, y: groundY - 95, w: 135, h: 24, ice: isIce });
    out.platforms.push({ x: cursorX + 305, y: groundY - 155, w: 120, h: 22, breakable: true });
    out.platforms.push({ x: cursorX + 465, y: groundY - 110, w: 145, h: 24, ice: isIce });
    out.collectibles.push({ id: `${uid}_s1`, type: 'shard', x: cursorX + 365, y: groundY - 200 });
    out.crates.push({ id: `${uid}_cr1`, x: cursorX + 520, y: groundY - 24, loot: 'gem' });
    out.enemies.push({
      id: `${uid}_e1`,
      type: pickEnemy(2),
      x: cursorX + 380,
      y: groundY - 40,
      patrolMin: cursorX + 160,
      patrolMax: cursorX + 620,
    });
  } else if (type === 'ladder_spire') {
    out.width = 720;
    const upperY = groundY - 205;
    out.platforms.push({ x: cursorX + 140, y: upperY, w: 280, h: 24, ice: isIce });
    out.ladders.push({ x: cursorX + 195, topY: upperY, bottomY: groundY, w: 38 });
    out.platforms.push({ x: cursorX + 460, y: groundY - 110, w: 150, h: 24, ice: isIce });
    out.collectibles.push({ id: `${uid}_s1`, type: 'shard', x: cursorX + 290, y: upperY - 42 });
    out.collectibles.push({ id: `${uid}_h1`, type: rng() < 0.45 ? 'heal' : 'shard', x: cursorX + 370, y: upperY - 42 });
    out.enemies.push({
      id: `${uid}_e1`,
      type: pickEnemy(0),
      x: cursorX + 310,
      y: upperY - 40,
      patrolMin: cursorX + 170,
      patrolMax: cursorX + 390,
    });
  } else if (type === 'hazard_crossing') {
    out.width = 720;
    const hazW = 104 + Math.floor(hazardDensity * 36);
    out.hazards.push({ x: cursorX + 270, y: groundY - 8, w: hazW, damage: hazardDmg, kind: hazardKind });
    out.platforms.push({ x: cursorX + 145, y: groundY - 92, w: 130, h: 24, ice: isIce });
    out.platforms.push({ x: cursorX + 275, y: groundY - 148, w: 140, h: 24, ice: isIce });
    out.platforms.push({ x: cursorX + 455, y: groundY - 92, w: 135, h: 24, ice: isIce });
    out.collectibles.push({ id: `${uid}_s1`, type: 'shard', x: cursorX + 345, y: groundY - 195 });
    out.enemies.push({
      id: `${uid}_e1`,
      type: pickEnemy(1),
      x: cursorX + 540,
      y: groundY - 40,
      patrolMin: cursorX + 430,
      patrolMax: cursorX + 675,
    });
  } else if (type === 'vision_secret_arch') {
    out.width = 720;
    // Lower normal path + Upper Secret Night-Vision path
    out.platforms.push({ x: cursorX + 130, y: groundY - 96, w: 150, h: 24, ice: isIce });
    out.platforms.push({ x: cursorX + 240, y: groundY - 210, w: 150, h: 22, secret: true });
    out.platforms.push({ x: cursorX + 430, y: groundY - 230, w: 170, h: 22, secret: true });
    out.collectibles.push({ id: `${uid}_g1`, type: 'gem', x: cursorX + 515, y: groundY - 275, secret: true });
    out.collectibles.push({ id: `${uid}_s1`, type: 'shard', x: cursorX + 315, y: groundY - 255, secret: true });
    out.enemies.push({
      id: `${uid}_e1`,
      type: pickEnemy(2),
      x: cursorX + 410,
      y: groundY - 40,
      patrolMin: cursorX + 170,
      patrolMax: cursorX + 630,
    });
  } else if (type === 'gate_puzzle') {
    out.width = 780;
    const platY = groundY - 185;
    out.platforms.push({ x: cursorX + 120, y: groundY - 96, w: 145, h: 24, ice: isIce });
    out.platforms.push({ x: cursorX + 290, y: platY, w: 200, h: 24, ice: isIce });
    out.ladders.push({ x: cursorX + 315, topY: platY, bottomY: groundY, w: 38 });
    out.gate = {
      id: `${uid}_gate`,
      x: cursorX + 640,
      y: groundY - 150,
      w: 36,
      h: 300,
      switchX: cursorX + 405,
      switchY: platY - 24,
    };
    out.collectibles.push({ id: `${uid}_g1`, type: 'gem', x: cursorX + 455, y: platY - 45 });
    out.enemies.push({
      id: `${uid}_e1`,
      type: 'bramble_sentinel',
      x: cursorX + 510,
      y: groundY - 40,
      patrolMin: cursorX + 250,
      patrolMax: cursorX + 595,
    });
  }

  return out;
}

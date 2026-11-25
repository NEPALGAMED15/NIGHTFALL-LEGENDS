import { BONUS_WORLDS } from './BonusWorldManager.js';
import { getKingdomForLevel } from './KingdomManager.js';
import { mulberry32 } from './LevelGenerator.js';

function shiftHexColor(hex, hShift = 0, lShift = 0) {
  let r = ((hex >> 16) & 0xff) / 255;
  let g = ((hex >> 8) & 0xff) / 255;
  let b = (hex & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }

  h = (((h + hShift) % 1) + 1) % 1;
  l = Math.max(0.03, Math.min(0.92, l + lShift));

  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  let nr, ng, nb;
  if (s === 0) {
    nr = ng = nb = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    nr = hue2rgb(p, q, h + 1 / 3);
    ng = hue2rgb(p, q, h);
    nb = hue2rgb(p, q, h - 1 / 3);
  }

  return (
    (Math.round(nr * 255) << 16) |
    (Math.round(ng * 255) << 8) |
    Math.round(nb * 255)
  );
}

function hexToCss(hex, alpha = 1) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Pure deterministic 6-layer background descriptor for any campaign level (1..1000) or bonus world.
 * Ensures every single level has a unique signature across sky hue, celestial geometry, mountain harmonics,
 * architectural landmark composition, foliage rhythm, and foreground weather mood.
 */
export function getBackgroundComposition(levelCfg) {
  const isBonus = Boolean(levelCfg?.isBonusWorld);
  const key = isBonus ? `B_${levelCfg.bonusWorldId}` : `L_${levelCfg.levelNumber}`;
  const seed = levelCfg?.backgroundSpec?.seed || (levelCfg?.levelNumber || 1) * 7919;
  const rng = mulberry32(seed ^ 0x517cc1b7);

  const lvNum = levelCfg?.levelNumber || 1;
  const hueOffset = isBonus ? 0 : (((lvNum * 17) % 100) / 100 - 0.5) * 0.085;
  const lumOffset = isBonus ? 0 : (((lvNum * 11) % 30) / 30 - 0.5) * 0.09;

  const basePal = levelCfg?.palette || {
    nightSkyTop: 0x070d19,
    nightSkyBottom: 0x162238,
    daySkyTop: 0x3d7a8a,
    daySkyBottom: 0xa7d7b8,
    groundFill: 0x2c2018,
    groundTopNight: 0x1f5c4e,
    groundTopDay: 0x4ca657,
    accentHex: 0x2dd4bf,
  };

  const layerPalette = {
    nightSkyTop: shiftHexColor(basePal.nightSkyTop, hueOffset, lumOffset * 0.5),
    nightSkyBottom: shiftHexColor(basePal.nightSkyBottom, hueOffset * 1.2, lumOffset),
    daySkyTop: shiftHexColor(basePal.daySkyTop, hueOffset, lumOffset * 0.6),
    daySkyBottom: shiftHexColor(basePal.daySkyBottom, hueOffset * 0.8, lumOffset),
    mountainFar: shiftHexColor(basePal.nightSkyBottom, hueOffset * 0.5, -0.04),
    mountainMid: shiftHexColor(basePal.groundFill, hueOffset * 0.7, 0.03),
    accentHex: shiftHexColor(basePal.accentHex || 0x2dd4bf, hueOffset * 0.4, 0),
  };

  const celestialPos = {
    x: 240 + Math.round(rng() * 780),
    y: 85 + Math.round(rng() * 88),
    radius: 26 + Math.round(rng() * 14),
    cloudCount: 3 + Math.floor(rng() * 5),
    starCount: 35 + Math.floor(rng() * 35),
  };

  const mountainProfile = {
    freqA: Number((0.008 + rng() * 0.012).toFixed(5)),
    freqB: Number((0.018 + rng() * 0.022).toFixed(5)),
    ampA: 42 + Math.round(rng() * 46),
    ampB: 18 + Math.round(rng() * 28),
    phase: Number((rng() * Math.PI * 2).toFixed(4)),
  };

  const landmarkVariants = ['castle', 'towers', 'ruins', 'bridge', 'temple', 'spires'];
  const landmark = {
    style: levelCfg?.landmarkStyle || landmarkVariants[lvNum % landmarkVariants.length],
    variantIndex: lvNum % 7,
    spacing: 260 + Math.round(rng() * 160),
    heightScale: Number((0.8 + rng() * 0.45).toFixed(3)),
  };

  const foreground = {
    lanternFreq: 160 + Math.round(rng() * 120),
    crystalDensity: Number((0.25 + rng() * 0.65).toFixed(2)),
    foliageDensity: Number((0.35 + rng() * 0.55).toFixed(2)),
  };

  const signature = [
    key,
    layerPalette.nightSkyTop.toString(16),
    layerPalette.daySkyTop.toString(16),
    celestialPos.x,
    celestialPos.y,
    mountainProfile.freqA,
    mountainProfile.ampA,
    landmark.style,
    landmark.spacing,
    foreground.lanternFreq,
  ].join('|');

  return {
    id: key,
    seed,
    signature,
    layerPalette,
    celestialPos,
    mountainProfile,
    landmark,
    foreground,
    weatherType: levelCfg?.weatherType || 'fireflies',
    layers: [
      '1_sky_atmosphere',
      '2_celestial_clouds_stars',
      '3_distant_mountains',
      '4_buildings_castles_trees',
      '5_foreground_weather',
      '6_gameplay_terrain',
    ],
  };
}

/**
 * Generates the complete manifest metadata for all 1000 main levels and 15 bonus worlds.
 */
export function buildFullBackgroundManifest() {
  const main = [];
  for (let lv = 1; lv <= 1000; lv++) {
    const info = getKingdomForLevel(lv);
    const comp = getBackgroundComposition({
      levelNumber: lv,
      isBonusWorld: false,
      palette: info.kingdom.palette,
      landmarkStyle: info.kingdom.landmarkStyle,
      weatherType: info.kingdom.weatherType,
      backgroundSpec: { seed: lv * 7919 + info.kingdom.order * 313 },
    });
    main.push({
      levelNumber: lv,
      kingdomId: info.kingdom.id,
      subBiome: info.subBiome,
      signature: comp.signature,
      landmark: comp.landmark.style,
      weather: comp.weatherType,
    });
  }

  const bonus = BONUS_WORLDS.map((bw) => {
    const comp = getBackgroundComposition({
      isBonusWorld: true,
      bonusWorldId: bw.id,
      palette: bw.palette,
      landmarkStyle: bw.landmarkStyle,
      weatherType: bw.weatherType,
      backgroundSpec: { seed: bw.order * 13337 },
    });
    return {
      bonusWorldId: bw.id,
      name: bw.name,
      signature: comp.signature,
      landmark: comp.landmark.style,
      weather: comp.weatherType,
    };
  });

  return { main, bonus };
}

/**
 * Runtime Phaser Canvas Texture Builder with automatic cleanup (never keeps 1000 textures in RAM).
 */
export class BackgroundManager {
  constructor(scene) {
    this.scene = scene;
    this.createdKeys = [];
  }

  destroyActiveTextures() {
    for (const key of this.createdKeys) {
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key);
      }
    }
    this.createdKeys = [];
  }

  makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    return { canvas: c, ctx };
  }

  registerTex(key, canvas) {
    if (this.scene.textures.exists(key)) {
      this.scene.textures.remove(key);
    }
    this.scene.textures.addCanvas(key, canvas);
    this.createdKeys.push(key);
    return key;
  }

  /**
   * Builds 3 tileable horizontal parallax textures (Layer 3 Mountains, Layer 4 Landmarks/Trees, Layer 5 Foreground)
   * specifically authored for this exact level/bonus world's composition.
   */
  buildTexturesForLevel(levelCfg) {
    this.destroyActiveTextures();
    const comp = getBackgroundComposition(levelCfg);
    const rng = mulberry32(comp.seed ^ 0xa5a5a5a5);

    const w = 1024;
    const h = 380;

    // LAYER 3: Distant Mountains & Horizon Scenery (tileable seamlessly via periodic harmonics)
    {
      const { canvas, ctx } = this.makeCanvas(w, h);
      const { ampA, ampB, phase } = comp.mountainProfile;
      const twoPi = Math.PI * 2;
      const farHex = comp.layerPalette.mountainFar;

      // Far ridge
      ctx.fillStyle = hexToCss(farHex, 0.85);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const u = (x / w) * twoPi;
        let ridge =
          h * 0.56 -
          Math.sin(u * 2 + phase) * ampA -
          Math.cos(u * 5 + phase * 1.4) * ampB;
        if (comp.landmark.style === 'volcano_bastion') {
          const d = Math.abs(x - 512);
          if (d < 150) ridge = Math.min(ridge, h * 0.16 + d * 0.9);
        } else if (comp.landmark.style === 'desert_pyramids') {
          const d1 = Math.abs(x - 320);
          const d2 = Math.abs(x - 740);
          if (d1 < 110) ridge = Math.min(ridge, h * 0.25 + d1 * 1.1);
          if (d2 < 85) ridge = Math.min(ridge, h * 0.34 + d2 * 1.1);
        }
        ctx.lineTo(x, ridge);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Secondary mist ridge
      ctx.fillStyle = hexToCss(shiftHexColor(farHex, 0.02, -0.08), 0.92);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const u = (x / w) * twoPi;
        const ridge =
          h * 0.68 -
          Math.sin(u * 3 - phase) * (ampA * 0.55) -
          Math.sin(u * 7 + phase) * (ampB * 0.5);
        ctx.lineTo(x, ridge);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Cosmic ringed planet for Space World or Dream World
      if (comp.landmark.style === 'cosmic_station' || comp.landmark.style === 'dream_islands') {
        ctx.save();
        ctx.fillStyle = hexToCss(comp.layerPalette.accentHex, 0.28);
        ctx.beginPath();
        ctx.arc(260, 110, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexToCss(comp.layerPalette.accentHex, 0.55);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(260, 110, 88, 18, -0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      this.registerTex('bg_dyn_mountains', canvas);
    }

    // LAYER 4: Midground Architecture (Castles, Temples, Cottages, Academy, Skyline, Trees)
    {
      const { canvas, ctx } = this.makeCanvas(w, h);
      const midColor = hexToCss(comp.layerPalette.mountainMid, 0.94);
      const darkSil = hexToCss(shiftHexColor(comp.layerPalette.mountainMid, 0, -0.1), 0.98);
      const glowColor = hexToCss(comp.layerPalette.accentHex, 0.9);
      const step = Math.max(190, comp.landmark.spacing);

      for (let bx = 65; bx < w - 50; bx += step) {
        const s = comp.landmark.style;
        const sc = comp.landmark.heightScale * (0.85 + rng() * 0.25);

        if (s === 'neon_skyline' || s === 'rainy_station') {
          const bw = 66 + Math.floor(rng() * 44);
          const bh = Math.round((130 + rng() * 130) * sc);
          ctx.fillStyle = darkSil;
          ctx.fillRect(bx - bw / 2, h - bh, bw, bh);
          ctx.fillStyle = glowColor;
          for (let wy = h - bh + 16; wy < h - 25; wy += 18) {
            for (let wx = bx - bw / 2 + 10; wx < bx + bw / 2 - 10; wx += 14) {
              if (rng() > 0.35) ctx.fillRect(wx, wy, 6, 8);
            }
          }
        } else if (s === 'family_cottage' || s === 'winter_village') {
          const cw = 88;
          const ch = 64;
          ctx.fillStyle = darkSil;
          ctx.fillRect(bx - cw / 2, h - ch, cw, ch);
          ctx.beginPath();
          ctx.moveTo(bx - cw / 2 - 12, h - ch);
          ctx.lineTo(bx, h - ch - 46);
          ctx.lineTo(bx + cw / 2 + 12, h - ch);
          ctx.closePath();
          ctx.fill();
          // Warm lit cottage windows
          ctx.fillStyle = s === 'winter_village' ? '#fde68a' : '#fbbf24';
          ctx.fillRect(bx - 22, h - 42, 14, 16);
          ctx.fillRect(bx + 8, h - 42, 14, 16);
        } else if (s === 'tropical_beach') {
          // Leaning palm trees
          ctx.strokeStyle = darkSil;
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.moveTo(bx, h);
          ctx.quadraticCurveTo(bx + 18, h - 90 * sc, bx + 32, h - 160 * sc);
          ctx.stroke();
          ctx.fillStyle = midColor;
          for (let a = -2; a <= 2; a++) {
            ctx.beginPath();
            ctx.ellipse(bx + 32 + a * 18, h - 160 * sc + Math.abs(a) * 6, 28, 7, a * 0.35, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Gothic castle / arcane academy / crystal spire / royal fortress / sakura arch
          const towerH = Math.round((120 + rng() * 90) * sc);
          const towerW = 46 + Math.floor(rng() * 24);
          ctx.fillStyle = darkSil;
          ctx.fillRect(bx - towerW / 2, h - towerH, towerW, towerH);
          // Pointed spire
          ctx.beginPath();
          ctx.moveTo(bx - towerW / 2 - 6, h - towerH);
          ctx.lineTo(bx, h - towerH - 48 * sc);
          ctx.lineTo(bx + towerW / 2 + 6, h - towerH);
          ctx.closePath();
          ctx.fill();
          // Side parapet
          ctx.fillRect(bx - towerW, h - towerH * 0.6, towerW * 2, towerH * 0.6);
          // Glowing spire window
          ctx.fillStyle = glowColor;
          ctx.fillRect(bx - 4, h - towerH + 18, 8, 16);
        }

        // Flanking trees / pines / sakura
        const treeX = bx + step * 0.48;
        if (treeX < w - 25) {
          const isBlossom = s === 'sakura_bridge' || s === 'arcane_academy';
          ctx.fillStyle = darkSil;
          ctx.fillRect(treeX - 5, h - 96, 10, 96);
          ctx.fillStyle = isBlossom ? hexToCss(comp.layerPalette.accentHex, 0.72) : midColor;
          ctx.beginPath();
          ctx.arc(treeX, h - 108, 34, 0, Math.PI * 2);
          ctx.arc(treeX - 20, h - 94, 24, 0, Math.PI * 2);
          ctx.arc(treeX + 20, h - 94, 24, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      this.registerTex('bg_dyn_structures', canvas);
    }

    // LAYER 5: Foreground Scenery Props (Lanterns, Crystals, Graves, Banners)
    {
      const { canvas, ctx } = this.makeCanvas(w, h);
      const glow = hexToCss(comp.layerPalette.accentHex, 0.88);
      const step = comp.foreground.lanternFreq;

      for (let fx = 50; fx < w - 30; fx += step) {
        // Lantern / Rune post
        ctx.fillStyle = 'rgba(15, 20, 32, 0.9)';
        ctx.fillRect(fx - 3, h - 92, 6, 92);
        ctx.fillRect(fx - 3, h - 92, 22, 5);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(fx + 16, h - 78, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hexToCss(comp.layerPalette.accentHex, 0.22);
        ctx.beginPath();
        ctx.arc(fx + 16, h - 78, 22, 0, Math.PI * 2);
        ctx.fill();

        // Biome accent prop (crystals / gravestones / cacti)
        if (rng() < comp.foreground.crystalDensity) {
          const cx = fx + 64;
          if (comp.landmark.style === 'haunted_graveyard') {
            ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
            ctx.beginPath();
            ctx.arc(cx, h - 24, 14, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(cx - 14, h - 24, 28, 24);
          } else {
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.moveTo(cx, h - 38);
            ctx.lineTo(cx + 10, h);
            ctx.lineTo(cx - 10, h);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      this.registerTex('bg_dyn_foreground', canvas);
    }

    return comp;
  }
}

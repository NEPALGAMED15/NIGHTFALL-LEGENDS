import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { audioSystem } from './AudioSystem.js';
import { BackgroundManager } from './BackgroundManager.js';

export class LevelManager {
  constructor(scene, levelConfig) {
    this.scene = scene;
    this.kingdom = levelConfig;

    this.solids = scene.physics.add.staticGroup();
    this.secretSolids = scene.physics.add.staticGroup();
    this.movingPlatformsGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.breakablePlatformsGroup = scene.physics.add.staticGroup();

    this.movingPlatforms = [];
    this.breakablePlatforms = [];
    this.iceZones = [];
    this.ladders = [];
    this.crates = [];
    this.collectibles = [];
    this.checkpoints = [];
    this.hazards = [];
    this.gateObj = null;
    this.switchObj = null;
    this.exitPortal = null;
    this.bossWalls = [];

    // 6-Layer Modular Day/Night Parallax & Weather Refs
    this.backgroundManager = new BackgroundManager(scene);
    this.bgComp = null;
    this.skyGfx = null;
    this.dayLayers = [];
    this.nightLayers = [];
    this.skyArtLayers = [];
    this.mountainArtLayers = [];
    this.dayScrollTiles = [];
    this.nightScrollTiles = [];
    this.waterfallDrops = [];
    this.celestial = null;
    this.celestialGlow = null;
    this.stars = [];
    this.clouds = [];
    this.dynMountains = null;
    this.dynStructures = null;
    this.dynForeground = null;
    this.sunbeams = [];
    this.weatherParticles = [];
    this.darknessOverlay = null;
    this.nightVisionGlow = null;
    this.secretPlatformsVisual = [];
    this.groundTopStrips = [];
    this.portalUnlocked = false;
  }

  build() {
    const k = this.kingdom;
    this.buildAtmosphere(k);
    this.buildSceneryProps(k);
    this.buildTerrain(k);
    this.buildBridges(k);
    this.buildLadders(k);
    this.buildPlatforms(k);
    this.buildCrates(k);
    this.buildHazards(k);
    this.buildCollectibles(k);
    this.buildCheckpoints(k);
    this.buildGateAndSwitch(k);
    this.buildExitOrBossArena(k);
  }

  buildAtmosphere(k) {
    this.skyGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(0);
    this.bgComp = this.backgroundManager.buildTexturesForLevel(k);

    const isLevel1ArtShowcase =
      k.levelNumber === 1 &&
      !k.isBonusWorld &&
      k.kingdomId === 'whispering-forest' &&
      (this.scene.textures.exists('layer_sky_day') || this.scene.textures.exists('layer_sky_night'));

    if (isLevel1ArtShowcase) {
      // Dedicated Day Sky & Night Sky extracted art layers
      if (this.scene.textures.exists('layer_sky_day')) {
        const skyDay = this.scene.add.image(GAME_WIDTH / 2, 280, 'layer_sky_day').setScrollFactor(0, 1).setDepth(1);
        this.dayLayers.push(skyDay);
        this.skyArtLayers.push(skyDay);
      }
      if (this.scene.textures.exists('layer_sky_night')) {
        const skyNight = this.scene.add.image(GAME_WIDTH / 2, 280, 'layer_sky_night').setScrollFactor(0, 1).setDepth(1);
        this.nightLayers.push(skyNight);
        this.skyArtLayers.push(skyNight);
      }
      for (let i = 0; i < 42; i++) {
        const star = this.scene.add
          .circle(Math.random() * GAME_WIDTH, 14 + Math.random() * 210, 1 + Math.random() * 1.4, 0xe2e8f0, 0.8)
          .setScrollFactor(0.025, 1)
          .setDepth(1);
        this.stars.push(star);
      }
      if (this.scene.textures.exists('layer_mountains_day')) {
        const mDay = this.scene.add.image(810, 280, 'layer_mountains_day').setScrollFactor(0.08, 1).setDepth(2);
        this.dayLayers.push(mDay);
        this.mountainArtLayers.push(mDay);
      }
      if (this.scene.textures.exists('layer_mountains_night')) {
        const mNight = this.scene.add.image(810, 280, 'layer_mountains_night').setScrollFactor(0.08, 1).setDepth(2);
        this.nightLayers.push(mNight);
        this.mountainArtLayers.push(mNight);
      }
      if (this.scene.textures.exists('layer_forest_day')) {
        const fDay = this.scene.add
          .tileSprite(GAME_WIDTH / 2, k.groundY - 95, GAME_WIDTH, 360, 'layer_forest_day')
          .setScrollFactor(0, 1)
          .setDepth(3);
        this.dayLayers.push(fDay);
        this.dayScrollTiles.push(fDay);
      }
      if (this.scene.textures.exists('layer_forest_night')) {
        const fNight = this.scene.add
          .tileSprite(GAME_WIDTH / 2, k.groundY - 95, GAME_WIDTH, 360, 'layer_forest_night')
          .setScrollFactor(0, 1)
          .setDepth(3);
        this.nightLayers.push(fNight);
        this.nightScrollTiles.push(fNight);
      }
      for (let i = 0; i < 18; i++) {
        const drop = this.scene.add
          .circle(800 + Math.random() * 210, 320 + Math.random() * 210, 2 + Math.random() * 2.2, 0xbae6fd, 0.45)
          .setScrollFactor(0.24, 1)
          .setDepth(4);
        this.waterfallDrops.push({ sprite: drop, speed: 60 + Math.random() * 65 });
      }
    } else {
      // Modular 6-Layer Horizontal Parallax for all 1000 Main Levels & 15 Bonus Worlds
      // LAYER 2: Celestial (Sun in Day, Moon + Stars in Night, drifting Clouds)
      const { starCount, cloudCount, radius, x: celX, y: celY } = this.bgComp.celestialPos;
      for (let i = 0; i < starCount; i++) {
        const star = this.scene.add
          .circle(
            (i * 193) % GAME_WIDTH,
            18 + ((i * 71) % Math.round(GAME_HEIGHT * 0.48)),
            1 + (i % 3) * 0.55,
            0xe2e8f0,
            0.78
          )
          .setScrollFactor(0.02, 0.2)
          .setDepth(1);
        this.stars.push(star);
      }
      this.celestialGlow = this.scene.add
        .circle(celX, celY, radius * 2.0, this.bgComp.layerPalette.accentHex, 0.18)
        .setScrollFactor(0, 0.2)
        .setDepth(1);
      this.celestial = this.scene.add
        .circle(celX, celY, radius, 0xe2e8f0, 0.95)
        .setScrollFactor(0, 0.2)
        .setDepth(2);

      for (let i = 0; i < cloudCount; i++) {
        const c = this.scene.add
          .ellipse(120 + i * (GAME_WIDTH / cloudCount), 85 + (i % 3) * 42, 130 + (i % 2) * 50, 34, 0xffffff, 0.18)
          .setScrollFactor(0.05, 1)
          .setDepth(2);
        this.clouds.push({ sprite: c, speed: 6 + (i % 3) * 4 });
      }

      // LAYER 3: Distant Mountains & Cosmic Horizon (locked vertically to groundY)
      this.dynMountains = this.scene.add
        .tileSprite(GAME_WIDTH / 2, k.groundY - 190, GAME_WIDTH, 380, 'bg_dyn_mountains')
        .setScrollFactor(0, 1)
        .setDepth(3);

      // LAYER 4: Midground Architecture, Castles, Temples, Cottages, Trees
      this.dynStructures = this.scene.add
        .tileSprite(GAME_WIDTH / 2, k.groundY - 190, GAME_WIDTH, 380, 'bg_dyn_structures')
        .setScrollFactor(0, 1)
        .setDepth(4);

      // LAYER 5: Foreground Silhouettes / Lanterns / Props
      this.dynForeground = this.scene.add
        .tileSprite(GAME_WIDTH / 2, k.groundY - 190, GAME_WIDTH, 380, 'bg_dyn_foreground')
        .setScrollFactor(0, 1)
        .setDepth(6);
    }

    // Volumetric Day Sunbeams
    for (let x = 200; x < k.worldWidth; x += 560) {
      const beam = this.scene.add
        .polygon(x, 0, [0, 0, 110, 0, 210, k.groundY, 60, k.groundY], 0xfef08a, 0.08)
        .setOrigin(0, 0)
        .setDepth(5);
      this.sunbeams.push(beam);
    }

    // Weather Particle Layer (Snow, Rain, Embers, Sakura Petals, Fireflies, Sandstorm, Bubbles, Cosmic Stars)
    this.buildWeatherParticles(k);

    // Ambient darkness overlay (reduced sharply when Night Vision is active)
    this.darknessOverlay = this.scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050914, 0.16)
      .setScrollFactor(0)
      .setDepth(24);

    this.nightVisionGlow = this.scene.add.circle(0, 0, 175, 0x2dd4bf, 0.14).setDepth(23).setVisible(false);
    this.syncViewportSize(this.scene.cameras.main);
  }

  syncViewportSize(cam) {
    if (!cam) return;
    const zoom = Math.max(0.25, cam.zoom || 1);
    const visW = Math.max(GAME_WIDTH, Math.ceil(cam.width / zoom) + 80);
    const visH = Math.max(GAME_HEIGHT, Math.ceil(cam.height / zoom) + 40);
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    if (this.darknessOverlay) {
      this.darknessOverlay.setPosition(cx, cy).setSize(visW, visH);
    }
    this.skyArtLayers.forEach((img) => {
      const texW = img.width || 1440;
      const scaleX = Math.max(1, visW / texW);
      img.setPosition(cx, 280).setScale(scaleX, Math.max(1, scaleX * 0.95));
    });
    this.mountainArtLayers.forEach((img) => {
      const texW = img.width || 1680;
      const scaleX = Math.max(1, (visW + 240) / texW);
      img.setPosition(cx + 120, 280).setScale(scaleX, 1);
    });
    this.dayScrollTiles.forEach((t) => {
      t.setPosition(cx, this.kingdom.groundY - 95).setSize(visW, 360);
    });
    this.nightScrollTiles.forEach((t) => {
      t.setPosition(cx, this.kingdom.groundY - 95).setSize(visW, 360);
    });
    if (this.dynMountains) {
      this.dynMountains.setPosition(cx, this.kingdom.groundY - 190).setSize(visW, 380);
    }
    if (this.dynStructures) {
      this.dynStructures.setPosition(cx, this.kingdom.groundY - 190).setSize(visW, 380);
    }
    if (this.dynForeground) {
      this.dynForeground.setPosition(cx, this.kingdom.groundY - 190).setSize(visW, 380);
    }
  }

  buildWeatherParticles(k) {
    const wt = k.weatherType || 'fireflies';
    const count = wt === 'rain' || wt === 'snow' || wt === 'sandstorm' ? 60 : 42;
    const colorMap = {
      fireflies: 0x38f2d2,
      snow: 0xe0f2fe,
      embers: 0xf97316,
      crimson_ash: 0xf43f5e,
      bubbles: 0x5eead4,
      wind_motes: 0xfef08a,
      void_sparks: 0xc084fc,
      sakura_petals: 0xf9a8d4,
      rain: 0x93c5fd,
      golden_pollen: 0xfde047,
      sandstorm: 0xfcd34d,
      cosmic_stars: 0xa5b4fc,
      spirit_wisps: 0x7dd3fc,
    };
    const col = colorMap[wt] || 0x38f2d2;

    for (let i = 0; i < count; i++) {
      const fx = 60 + Math.random() * (k.worldWidth - 120);
      const fy = 60 + Math.random() * (k.groundY - 90);
      const rad = wt === 'rain' ? 1.8 : wt === 'sakura_petals' ? 3.2 : 2.3 + Math.random() * 1.8;
      const dot = this.scene.add.circle(fx, fy, rad, col, 0.72).setDepth(14);
      this.weatherParticles.push({
        sprite: dot,
        baseX: fx,
        baseY: fy,
        phase: Math.random() * Math.PI * 2,
        weatherType: wt,
      });
    }
  }

  buildSceneryProps(k) {
    // Entrance Rune Banner near Kael spawn
    this.scene.add
      .rectangle(k.spawn.x - 45, k.groundY - 46, 8, 92, 0x334155)
      .setDepth(8);
    this.scene.add
      .circle(k.spawn.x - 45, k.groundY - 92, 9, k.palette.accentHex || 0x2dd4bf, 0.85)
      .setDepth(8);

    if (k.levelNumber !== 1 || k.kingdomId !== 'whispering-forest') return;
    if (!this.scene.textures.exists('prop_tree_day') && !this.scene.textures.exists('prop_tree_night')) return;

    [980, 1960, 2940, 3860].forEach((tx) => {
      if (this.scene.textures.exists('prop_ruin_day')) {
        this.dayLayers.push(
          this.scene.add.image(tx, k.groundY + 2, 'prop_ruin_day').setOrigin(0.5, 1).setScrollFactor(0.68, 1).setDepth(5)
        );
      }
      if (this.scene.textures.exists('prop_ruin_night')) {
        this.nightLayers.push(
          this.scene.add.image(tx, k.groundY + 2, 'prop_ruin_night').setOrigin(0.5, 1).setScrollFactor(0.68, 1).setDepth(5)
        );
      }
    });

    [65, 2060, 3510, 4440].forEach((tx) => {
      if (this.scene.textures.exists('prop_tree_day')) {
        this.dayLayers.push(this.scene.add.image(tx, k.groundY + 12, 'prop_tree_day').setOrigin(0.5, 1).setDepth(7));
      }
      if (this.scene.textures.exists('prop_tree_night')) {
        this.nightLayers.push(this.scene.add.image(tx, k.groundY + 12, 'prop_tree_night').setOrigin(0.5, 1).setDepth(7));
      }
    });

    [1120, 2760, 4480, 5340].forEach((bx) => {
      if (this.scene.textures.exists('prop_banner_day')) {
        this.dayLayers.push(this.scene.add.image(bx, k.groundY + 8, 'prop_banner_day').setOrigin(0.5, 1).setDepth(8));
      }
      if (this.scene.textures.exists('prop_banner_night')) {
        this.nightLayers.push(this.scene.add.image(bx, k.groundY + 8, 'prop_banner_night').setOrigin(0.5, 1).setDepth(8));
      }
    });

    const crystalSpots = [
      { x: 240, key: 'prop_crystal_amethyst' },
      { x: 760, key: 'prop_crystal_cyan' },
      { x: 1410, key: 'prop_crystal_amethyst' },
      { x: 2180, key: 'prop_crystal_cyan' },
      { x: 3150, key: 'prop_crystal_amethyst' },
      { x: 4160, key: 'prop_crystal_cyan' },
      { x: 5250, key: 'prop_crystal_amethyst' },
    ];
    crystalSpots.forEach((c) => {
      if (this.scene.textures.exists(c.key)) {
        this.nightLayers.push(
          this.scene.add.image(c.x, k.groundY + 10, c.key).setOrigin(0.5, 1).setScale(0.75).setDepth(11)
        );
      }
    });
  }

  buildTerrain(k) {
    const gaps = [...(k.groundGaps || [])].sort((a, b) => a.x1 - b.x1);
    const segments = [];
    let cursor = 0;
    for (const g of gaps) {
      if (g.x1 > cursor) segments.push({ x1: cursor, x2: g.x1 });
      cursor = g.x2;
    }
    if (cursor < k.worldWidth) segments.push({ x1: cursor, x2: k.worldWidth });

    const useArtGround =
      k.levelNumber === 1 &&
      !k.isBonusWorld &&
      k.kingdomId === 'whispering-forest' &&
      (this.scene.textures.exists('art_ground_day') || this.scene.textures.exists('art_ground_night'));

    for (const seg of segments) {
      const width = seg.x2 - seg.x1;
      const centerX = seg.x1 + width / 2;
      const height = k.worldHeight - k.groundY;

      const block = this.scene.add.rectangle(centerX, k.groundY + height / 2, width, height, k.palette.groundFill, 0);
      this.scene.physics.add.existing(block, true);
      this.solids.add(block);

      if (useArtGround) {
        if (this.scene.textures.exists('art_ground_day')) {
          this.dayLayers.push(this.scene.add.tileSprite(centerX, k.groundY + 46, width, 128, 'art_ground_day').setDepth(10));
        }
        if (this.scene.textures.exists('art_ground_night')) {
          this.nightLayers.push(this.scene.add.tileSprite(centerX, k.groundY + 46, width, 128, 'art_ground_night').setDepth(10));
        }
      } else {
        this.scene.add
          .tileSprite(centerX, k.groundY + height / 2, width, height, 'tile_ground')
          .setTint(k.palette.groundFill)
          .setDepth(9);
        const topStrip = this.scene.add
          .tileSprite(centerX, k.groundY + 7, width, 14, 'tile_platform')
          .setTint(k.palette.groundTopNight)
          .setDepth(10);
        this.groundTopStrips.push(topStrip);
      }

      if (k.biomeMechanic === 'ice') {
        this.iceZones.push(new Phaser.Geom.Rectangle(seg.x1, k.groundY - 10, width, 24));
      }
    }
  }

  buildBridges(k) {
    for (const b of k.bridges || []) {
      const centerX = b.x + b.w / 2;
      const collider = this.scene.add.rectangle(centerX, b.y + b.h / 2, b.w, b.h, 0x000000, 0);
      this.scene.physics.add.existing(collider, true);
      this.solids.add(collider);

      // Wooden / stone bridge planks + side posts
      this.scene.add.rectangle(centerX, b.y + b.h / 2, b.w, b.h, 0x6b4423, 1).setStrokeStyle(2, 0x3b2310).setDepth(10);
      this.scene.add.rectangle(b.x + 8, b.y - 12, 8, 28, 0x4a2f18).setDepth(10);
      this.scene.add.rectangle(b.x + b.w - 8, b.y - 12, 8, 28, 0x4a2f18).setDepth(10);
      this.scene.add.line(0, 0, b.x + 8, b.y - 22, b.x + b.w - 8, b.y - 22, 0xc4a25e, 0.7).setOrigin(0).setDepth(10);
    }
  }

  buildLadders(k) {
    for (const l of k.ladders || []) {
      const h = l.bottomY - l.topY;
      const g = this.scene.add.graphics().setDepth(9);
      g.lineStyle(4, 0x7c5432, 1);
      g.lineBetween(l.x - 12, l.topY, l.x - 12, l.bottomY);
      g.lineBetween(l.x + 12, l.topY, l.x + 12, l.bottomY);
      g.lineStyle(3, 0xc4a25e, 0.9);
      for (let ry = l.topY + 14; ry < l.bottomY - 6; ry += 22) {
        g.lineBetween(l.x - 12, ry, l.x + 12, ry);
      }
      this.ladders.push({ ...l, height: h });
    }
  }

  buildPlatforms(k) {
    const useArtPlatform =
      k.levelNumber === 1 &&
      !k.isBonusWorld &&
      k.kingdomId === 'whispering-forest' &&
      (this.scene.textures.exists('art_platform_day') || this.scene.textures.exists('art_platform_night'));

    for (const p of k.platforms) {
      const centerX = p.x + p.w / 2;

      // Moving Platform
      if (p.moving) {
        const vis = this.scene.add
          .tileSprite(centerX, p.y + p.h / 2, p.w, p.h, 'tile_platform')
          .setTint(k.palette.accentHex || 0x38bdf8)
          .setDepth(11);
        this.scene.physics.add.existing(vis, false);
        vis.body.setAllowGravity(false);
        vis.body.setImmovable(true);
        this.movingPlatformsGroup.add(vis);
        this.movingPlatforms.push({
          sprite: vis,
          originX: centerX,
          originY: p.y + p.h / 2,
          axis: p.moving.axis || 'x',
          range: p.moving.range || 120,
          speed: p.moving.speed || 1.2,
          phase: 0,
          prevX: centerX,
          prevY: p.y + p.h / 2,
        });
        continue;
      }

      // Breakable Platform
      if (p.breakable) {
        const vis = this.scene.add
          .tileSprite(centerX, p.y + p.h / 2, p.w, p.h, 'tile_platform')
          .setTint(0xf59e0b)
          .setDepth(11);
        this.scene.physics.add.existing(vis, true);
        this.breakablePlatformsGroup.add(vis);
        this.breakablePlatforms.push({
          sprite: vis,
          baseY: p.y + p.h / 2,
          state: 'intact', // intact | shaking | broken
          timer: 0,
        });
        continue;
      }

      let vis;
      if (useArtPlatform) {
        if (p.secret) {
          vis = this.scene.add
            .image(centerX, p.y + p.h * 0.65, this.scene.textures.exists('art_platform_night') ? 'art_platform_night' : 'art_platform_day')
            .setDisplaySize(p.w + 18, Math.max(46, p.h * 2.2))
            .setTint(0x2dd4bf)
            .setAlpha(0.28)
            .setDepth(10);
        } else {
          if (this.scene.textures.exists('art_platform_day')) {
            this.dayLayers.push(
              this.scene.add
                .image(centerX, p.y + p.h * 0.65, 'art_platform_day')
                .setDisplaySize(p.w + 18, Math.max(46, p.h * 2.2))
                .setDepth(10)
            );
          }
          if (this.scene.textures.exists('art_platform_night')) {
            this.nightLayers.push(
              this.scene.add
                .image(centerX, p.y + p.h * 0.65, 'art_platform_night')
                .setDisplaySize(p.w + 18, Math.max(46, p.h * 2.2))
                .setDepth(10)
            );
          }
        }
      } else {
        vis = this.scene.add
          .tileSprite(centerX, p.y + p.h / 2, p.w, p.h, 'tile_platform')
          .setTint(p.secret ? 0x2dd4bf : p.ice ? 0xbae6fd : k.palette.groundTopNight)
          .setAlpha(p.secret ? 0.24 : 1)
          .setDepth(10);
      }

      const collider = this.scene.add.rectangle(centerX, p.y + p.h / 2, p.w, p.h, 0x000000, 0);
      this.scene.physics.add.existing(collider, true);

      if (p.secret) {
        this.secretSolids.add(collider);
        if (vis) this.secretPlatformsVisual.push(vis);
      } else {
        this.solids.add(collider);
        if (!useArtPlatform && vis) this.groundTopStrips.push(vis);
      }
      if (p.ice) {
        this.iceZones.push(new Phaser.Geom.Rectangle(p.x, p.y - 10, p.w, 22));
      }
    }
  }

  buildCrates(k) {
    for (const c of k.crates || []) {
      const sprite = this.scene.physics.add.staticSprite(c.x, c.y, 'crate_sheet', 0).setDepth(12);
      this.crates.push({
        id: c.id,
        loot: c.loot,
        sprite,
        hp: 30,
        broken: false,
      });
    }
  }

  damageCrate(crate, dmg) {
    if (crate.broken) return;
    crate.hp -= dmg;
    crate.sprite.setFrame(1);
    this.scene.combat?.spawnBurst(crate.sprite.x, crate.sprite.y, 0xb45309, 6, 110);
    audioSystem.playHit(false);
    if (crate.hp <= 0) {
      crate.broken = true;
      crate.sprite.destroy();
      this.scene.combat?.spawnBurst(crate.sprite.x, crate.sprite.y, 0xd97706, 14, 150);
      this.spawnCollectible(crate.loot || 'shard', crate.sprite.x, crate.sprite.y - 8, false);
    }
  }

  buildHazards(k) {
    for (const h of k.hazards || []) {
      const vis = this.scene.add.tileSprite(h.x + h.w / 2, h.y, h.w, 20, 'spikes').setDepth(12);
      if (h.kind === 'lava') vis.setTint(0xf97316);
      else if (h.kind === 'abyssal_surge') vis.setTint(0x2dd4bf);
      this.hazards.push({
        rect: new Phaser.Geom.Rectangle(h.x + 6, h.y - 10, h.w - 12, 18),
        damage: h.damage || 15,
        vis,
      });
    }
  }

  buildCollectibles(k) {
    for (const item of k.collectibles || []) {
      this.spawnCollectible(item.type, item.x, item.y, Boolean(item.secret));
    }
  }

  spawnCollectible(type, x, y, secret = false) {
    const frame = type === 'gem' ? 1 : type === 'heal' ? 2 : 0;
    const sprite = this.scene.add.sprite(x, y, 'collectibles_sheet', frame).setDepth(15);
    if (secret) sprite.setAlpha(0.45);
    this.collectibles.push({
      type,
      sprite,
      baseY: y,
      secret,
      collected: false,
      phase: Math.random() * Math.PI * 2,
    });
  }

  buildCheckpoints(k) {
    for (const cp of k.checkpoints || []) {
      const sprite = this.scene.add.sprite(cp.x, cp.y, 'checkpoint_sheet', 0).setDepth(11);
      this.checkpoints.push({
        id: cp.id,
        name: cp.name,
        x: cp.x,
        y: cp.y,
        sprite,
        activated: false,
      });
    }
  }

  buildGateAndSwitch(k) {
    if (!k.gate) return;
    const g = k.gate;
    const gateSprite = this.scene.add.tileSprite(g.x, g.y, g.w, g.h, 'gate_locked').setDepth(13);
    this.scene.physics.add.existing(gateSprite, true);
    this.solids.add(gateSprite);

    const switchSprite = this.scene.add.sprite(g.switchX, g.switchY, 'rune_switch', 0).setDepth(13);

    this.gateObj = {
      sprite: gateSprite,
      open: false,
      originalY: g.y,
    };
    this.switchObj = {
      sprite: switchSprite,
      x: g.switchX,
      y: g.switchY,
      activated: false,
    };
  }

  activateGateSwitch() {
    if (!this.switchObj || this.switchObj.activated) return false;
    this.switchObj.activated = true;
    this.switchObj.sprite.setFrame(1);
    audioSystem.playSwitch();
    this.scene.combat?.spawnBurst(this.switchObj.x, this.switchObj.y, 0x38f2d2, 16, 150);

    if (this.gateObj && !this.gateObj.open) {
      this.gateObj.open = true;
      this.scene.cameras.main.shake(220, 0.007);
      this.gateObj.sprite.body.enable = false;
      this.scene.tweens.add({
        targets: this.gateObj.sprite,
        y: this.gateObj.originalY - 220,
        alpha: 0.25,
        duration: 650,
        ease: 'Cubic.easeOut',
      });
    }
    return true;
  }

  buildExitOrBossArena(k) {
    if (k.bossArena) {
      const ba = k.bossArena;
      const leftWall = this.scene.add.rectangle(ba.leftWallX, k.groundY - 220, 28, 440, 0x2dd4bf, 0.2).setDepth(13);
      this.scene.physics.add.existing(leftWall, true);
      leftWall.body.enable = false;
      leftWall.setVisible(false);

      const rightWall = this.scene.add.rectangle(ba.rightWallX, k.groundY - 220, 28, 440, 0x2dd4bf, 0.2).setDepth(13);
      this.scene.physics.add.existing(rightWall, true);
      rightWall.body.enable = true;
      rightWall.setVisible(false);

      this.solids.add(leftWall);
      this.solids.add(rightWall);
      this.bossWalls = [leftWall, rightWall];

      this.exitPortal = this.scene.add
        .sprite(ba.exitPortalX, ba.exitPortalY, 'exit_portal', 0)
        .setDepth(13)
        .setAlpha(0.25);
      this.exitPortal.play('portal_spin');
      this.portalUnlocked = false;
    } else if (k.exitPortal) {
      const startOpen = !k.isMiniBossLevel && k.objective?.type !== 'unlock_gate';
      this.exitPortal = this.scene.add
        .sprite(k.exitPortal.x, k.exitPortal.y, 'exit_portal', 0)
        .setDepth(13)
        .setAlpha(startOpen ? 1 : 0.28);
      this.exitPortal.play('portal_spin');
      this.portalUnlocked = startOpen;
    }
  }

  lockBossArena() {
    this.bossWalls.forEach((w) => {
      w.body.enable = true;
      w.setVisible(true);
    });
  }

  unlockBossArenaAndPortal() {
    this.bossWalls.forEach((w) => {
      w.body.enable = false;
      w.setVisible(false);
    });
    if (this.exitPortal && !this.portalUnlocked) {
      this.portalUnlocked = true;
      this.exitPortal.setAlpha(1);
      this.scene.combat?.spawnBurst(this.exitPortal.x, this.exitPortal.y, 0x38f2d2, 24, 190);
    }
  }

  updateDynamicPlatforms(dt, player) {
    // 1. Update Moving Platforms and carry Kael if standing on top
    for (const mp of this.movingPlatforms) {
      mp.prevX = mp.sprite.x;
      mp.prevY = mp.sprite.y;
      mp.phase += dt * mp.speed;
      const offset = Math.sin(mp.phase) * mp.range * 0.5;
      const nx = mp.axis === 'x' ? mp.originX + mp.range * 0.5 + offset : mp.originX;
      const ny = mp.axis === 'y' ? mp.originY + offset : mp.originY;
      mp.sprite.setPosition(nx, ny);
      mp.sprite.body.updateFromGameObject();

      const dx = nx - mp.prevX;
      if (player && (player.body.blocked.down || player.body.touching.down)) {
        const pBounds = player.getHurtbox();
        const mBounds = mp.sprite.getBounds();
        if (
          Math.abs(pBounds.bottom - mBounds.top) <= 10 &&
          pBounds.right > mBounds.left + 4 &&
          pBounds.left < mBounds.right - 4
        ) {
          player.x += dx;
        }
      }
    }

    // 2. Update Breakable Platforms (crumble shortly after contact, then respawn)
    for (const bp of this.breakablePlatforms) {
      if (bp.state === 'intact' && player && (player.body.blocked.down || player.body.touching.down)) {
        const pBounds = player.getHurtbox();
        const bBounds = bp.sprite.getBounds();
        if (
          Math.abs(pBounds.bottom - bBounds.top) <= 8 &&
          pBounds.right > bBounds.left + 4 &&
          pBounds.left < bBounds.right - 4
        ) {
          bp.state = 'shaking';
          bp.timer = 0.65;
        }
      } else if (bp.state === 'shaking') {
        bp.timer -= dt;
        bp.sprite.y = bp.baseY + Math.sin(this.scene.time.now * 0.08) * 2.5;
        if (bp.timer <= 0) {
          bp.state = 'broken';
          bp.timer = 3.0;
          bp.sprite.body.enable = false;
          bp.sprite.setAlpha(0.18);
          this.scene.combat?.spawnBurst(bp.sprite.x, bp.sprite.y, 0xf59e0b, 8, 90);
        }
      } else if (bp.state === 'broken') {
        bp.timer -= dt;
        if (bp.timer <= 0) {
          bp.state = 'intact';
          bp.sprite.y = bp.baseY;
          bp.sprite.body.enable = true;
          bp.sprite.setAlpha(1);
        }
      }
    }

    // 3. Detect if player stands on Ice surface
    if (player) {
      const pBounds = player.getHurtbox();
      const footProbe = new Phaser.Geom.Rectangle(pBounds.x, pBounds.bottom - 4, pBounds.width, 10);
      player.onIce = this.iceZones.some((iz) => Phaser.Geom.Intersects.RectangleToRectangle(footProbe, iz));
    }
  }

  updateDayNightVisuals(dt, cycleState, player) {
    // LAYER 1: Sky gradient
    const nightAlpha = Phaser.Math.Clamp(cycleState.nightFactor, 0, 1);
    const pal = this.bgComp?.layerPalette;
    const topCol = pal
      ? Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(pal.daySkyTop),
          Phaser.Display.Color.IntegerToColor(pal.nightSkyTop),
          100,
          Math.round(nightAlpha * 100)
        )
      : null;
    const botCol = pal
      ? Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(pal.daySkyBottom),
          Phaser.Display.Color.IntegerToColor(pal.nightSkyBottom),
          100,
          Math.round(nightAlpha * 100)
        )
      : null;

    const skyTopHex = topCol ? Phaser.Display.Color.GetColor(topCol.r, topCol.g, topCol.b) : cycleState.skyTop;
    const skyBotHex = botCol ? Phaser.Display.Color.GetColor(botCol.r, botCol.g, botCol.b) : cycleState.skyBottom;

    const cam = this.scene.cameras.main;
    const zoom = Math.max(0.25, cam.zoom || 1);
    const visW = cam.width / zoom + 16;
    const visH = cam.height / zoom + 16;
    const skyLeft = cam.width / 2 - visW / 2;
    const skyTop = cam.height / 2 - visH / 2;

    this.skyGfx.clear();
    this.skyGfx.fillGradientStyle(skyTopHex, skyTopHex, skyBotHex, skyBotHex, 1);
    this.skyGfx.fillRect(skyLeft, skyTop, visW, visH);

    const camScrollX = cam.scrollX;

    if (this.dayLayers.length > 0 || this.nightLayers.length > 0) {
      const dayAlpha = 1 - nightAlpha;
      this.dayLayers.forEach((obj) => obj.setAlpha(dayAlpha));
      this.nightLayers.forEach((obj) => obj.setAlpha(nightAlpha));
      this.dayScrollTiles.forEach((t) => {
        t.tilePositionX = camScrollX * 0.24;
      });
      this.nightScrollTiles.forEach((t) => {
        t.tilePositionX = camScrollX * 0.24;
      });
      this.stars.forEach((s) => s.setAlpha(nightAlpha * 0.85));
      this.waterfallDrops.forEach((wd) => {
        wd.sprite.y += wd.speed * dt;
        if (wd.sprite.y > 530) wd.sprite.y = 320 + Math.random() * 20;
      });
    } else {
      // Strictly show Sun during Day and Moon+Stars during Night (never combined)
      const dayAlpha = 1 - nightAlpha;
      const spanW = Math.min(visW * 0.66, 840);
      const arcX = cam.width / 2 - spanW / 2 + cycleState.cycleProgress * spanW;
      const arcY = Math.round(cam.height / 2 - visH * 0.30 - Math.sin(cycleState.cycleProgress * Math.PI * 2) * 35);
      this.celestial?.setPosition(arcX, arcY).setFillStyle(cycleState.celestialColor, 0.95);
      this.celestialGlow?.setPosition(arcX, arcY).setFillStyle(cycleState.celestialColor, cycleState.isNightDominant ? 0.16 : 0.24);
      this.stars.forEach((s) => s.setAlpha(cycleState.starAlpha * 0.88));
      this.clouds.forEach((c) => {
        c.sprite.x = (c.sprite.x + c.speed * dt) % (GAME_WIDTH + 160);
        c.sprite.setAlpha(0.08 + dayAlpha * 0.24);
      });

      if (this.dynMountains) {
        this.dynMountains.tilePositionX = camScrollX * 0.18;
        this.dynMountains.setAlpha(0.75 + nightAlpha * 0.2);
      }
      if (this.dynStructures) {
        this.dynStructures.tilePositionX = camScrollX * 0.38;
      }
      if (this.dynForeground) {
        this.dynForeground.tilePositionX = camScrollX * 0.72;
      }

      const topTint = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(this.kingdom.palette.groundTopDay),
        Phaser.Display.Color.IntegerToColor(this.kingdom.palette.groundTopNight),
        100,
        Math.round(nightAlpha * 100)
      );
      const mergedTopTint = Phaser.Display.Color.GetColor(topTint.r, topTint.g, topTint.b);
      this.groundTopStrips.forEach((strip) => strip.setTint(mergedTopTint));
    }

    // Sunbeams & Biome Weather Particles
    this.sunbeams.forEach((b) => b.setAlpha(cycleState.sunbeamAlpha));
    const time = this.scene.time.now * 0.002;
    this.weatherParticles.forEach((f) => {
      const wt = f.weatherType;
      if (wt === 'snow' || wt === 'sakura_petals' || wt === 'rain') {
        f.baseY += (wt === 'rain' ? 290 : 48) * dt;
        f.baseX += (wt === 'rain' ? -55 : Math.sin(time + f.phase) * 24) * dt;
        if (f.baseY > this.kingdom.groundY) {
          f.baseY = 20;
          f.baseX = 40 + Math.random() * (this.kingdom.worldWidth - 80);
        }
        f.sprite.setPosition(f.baseX, f.baseY);
        f.sprite.setAlpha(wt === 'rain' ? 0.55 : 0.75);
      } else if (wt === 'embers' || wt === 'crimson_ash' || wt === 'bubbles') {
        f.baseY -= 42 * dt;
        f.sprite.x = f.baseX + Math.sin(time + f.phase) * 16;
        f.sprite.y = f.baseY;
        if (f.baseY < 40) f.baseY = this.kingdom.groundY - 20;
        f.sprite.setAlpha(0.75);
      } else if (wt === 'sandstorm' || wt === 'wind_motes') {
        f.baseX += 110 * dt;
        if (f.baseX > this.kingdom.worldWidth) f.baseX = 20;
        f.sprite.setPosition(f.baseX, f.baseY + Math.sin(time + f.phase) * 8);
        f.sprite.setAlpha(0.5);
      } else {
        f.sprite.x = f.baseX + Math.sin(time + f.phase) * 14;
        f.sprite.y = f.baseY + Math.cos(time * 1.3 + f.phase) * 10;
        f.sprite.setAlpha(cycleState.fireflyAlpha * (0.5 + 0.5 * Math.sin(time * 2 + f.phase)));
      }
    });

    this.darknessOverlay.setAlpha(cycleState.ambientDarknessAlpha * 0.42);

    const nv = Boolean(player?.nightVisionActive);
    this.nightVisionGlow.setVisible(nv);
    if (nv && player) {
      this.nightVisionGlow.setPosition(player.x, player.y - 28);
    }
    this.secretPlatformsVisual.forEach((p) => {
      p.setAlpha(nv ? 0.95 : 0.28);
    });
    this.collectibles.forEach((c) => {
      if (c.collected) return;
      c.phase += dt * 3;
      c.sprite.y = c.baseY + Math.sin(c.phase) * 5;
      if (c.secret) c.sprite.setAlpha(nv ? 1 : 0.35);
    });
  }

  destroy() {
    this.backgroundManager.destroyActiveTextures();
  }
}

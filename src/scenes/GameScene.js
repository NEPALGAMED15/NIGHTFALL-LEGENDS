import Phaser from 'phaser';
import { PHYSICS_CONFIG } from '../config.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { LevelManager } from '../systems/LevelManager.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { DayNightManager } from '../systems/DayNightManager.js';
import { computeVictoryScore } from '../systems/CombatLogic.js';
import { generateBonusWorldLevel, generateCampaignLevel } from '../systems/LevelGenerator.js';
import { getKingdomByDefId } from '../systems/KingdomManager.js';
import { computeLevelRewards, computeStarRating, getPlayerUpgradedStats } from '../systems/ProgressionManager.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { audioSystem } from '../systems/AudioSystem.js';
import { GameHUD } from '../ui/GameHUD.js';
import { MobileControls } from '../ui/MobileControls.js';
import { computeCameraFraming } from '../systems/ViewportLayout.js';
import { adManager } from '../systems/AdManager.js';
import { androidBridge } from '../systems/AndroidBridge.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.hud = null;
    this.mobileControls = null;
  }

  init(data) {
    adManager.setGameplayActive(true);
    this.bonusWorldId = data?.bonusWorldId || null;
    if (data?.levelNumber) {
      this.levelNumber = Math.max(1, Math.min(1000, Number(data.levelNumber)));
    } else if (data?.kingdomId && !this.bonusWorldId) {
      this.levelNumber = getKingdomByDefId(data.kingdomId).startLevel;
    } else {
      const save = saveSystem.load();
      this.levelNumber = save.currentLevel || 1;
    }
    this.fromSave = Boolean(data?.fromSave);
  }

  create() {
    adManager.setGameplayActive(true);
    document.body.dataset.state = 'playing';
    document.getElementById('boot-loader')?.classList.add('hidden');
    if (typeof window !== 'undefined') window.__NIGHTFALL_BOOT_READY__ = true;
    androidBridge.hideSplash();

    const save = saveSystem.load();

    // Generate Campaign Level (1..1000) or Bonus World (1..15)
    this.kingdom = this.bonusWorldId
      ? generateBonusWorldLevel(this.bonusWorldId)
      : generateCampaignLevel(this.levelNumber);

    // Low-gravity adjustment for Space World / Dream World while keeping normal levels identical
    const gravityY =
      this.kingdom.biomeMechanic === 'low_gravity'
        ? Math.round(PHYSICS_CONFIG.GRAVITY_Y * 0.72)
        : PHYSICS_CONFIG.GRAVITY_Y;

    this.physics.world.setBounds(0, 0, this.kingdom.worldWidth, this.kingdom.worldHeight + 180);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.physics.world.gravity.y = gravityY;

    // Day & Night Cycle
    this.dayNightCycle = new DayNightManager({
      initialMode: save.settings.dayNightMode || 'night',
      cycleDurationSec: 76,
      autoCycle: true,
    });
    this.dayNightState = this.dayNightCycle.getLightingForLevel(this.kingdom, false);
    audioSystem.setTimeMood(this.dayNightState.isNightDominant);
    audioSystem.startAmbient(this.kingdom.musicMood);

    // Systems
    this.combat = new CombatSystem(this);
    this.levelManager = new LevelManager(this, this.kingdom);
    this.levelManager.build();

    // Determine spawn point (restore checkpoint if continuing same level)
    let spawnX = this.kingdom.spawn.x;
    let spawnY = this.kingdom.spawn.y;
    if (
      this.fromSave &&
      save.lastCheckpoint &&
      !this.bonusWorldId &&
      save.lastCheckpointLevel === this.kingdom.levelNumber
    ) {
      const cp = this.kingdom.checkpoints.find((c) => c.id === save.lastCheckpoint);
      if (cp) {
        spawnX = cp.x;
        spawnY = cp.y - 6;
      }
    }
    this.respawnPoint = { x: spawnX, y: spawnY };
    this.activeCheckpointId = save.lastCheckpoint || null;

    // Spawn Kael with ProgressionManager upgrades
    const playerStats = getPlayerUpgradedStats(save);
    this.player = new Player(this, spawnX, spawnY, playerStats, this.kingdom.biomeMechanic);
    this.physics.add.collider(this.player, this.levelManager.solids);
    this.physics.add.collider(this.player, this.levelManager.secretSolids);
    this.physics.add.collider(this.player, this.levelManager.movingPlatformsGroup);
    this.physics.add.collider(this.player, this.levelManager.breakablePlatformsGroup);

    // Spawn Enemies
    this.enemies = (this.kingdom.enemies || []).map((eCfg) => {
      const enemy = new Enemy(this, eCfg);
      this.physics.add.collider(enemy, this.levelManager.solids);
      return enemy;
    });

    // Spawn Boss if level has Boss Arena
    if (this.kingdom.bossArena) {
      const ba = this.kingdom.bossArena;
      this.boss = new Boss(this, ba.bossSpawnX, ba.bossSpawnY, this.kingdom);
      this.physics.add.collider(this.boss, this.levelManager.solids);
    } else {
      this.boss = null;
    }

    // Responsive Camera follow (fills 100% viewport across portrait, mobile landscape, and desktop)
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.kingdom.worldWidth, this.kingdom.worldHeight);
    cam.startFollow(this.player, true, 0.14, 0.14);
    this.applyCameraFraming();

    // Run stats
    this.stats = {
      score: 0,
      shards: 0,
      gems: 0,
      enemiesSlain: 0,
      elapsedSec: 0,
    };
    this.hazardCooldown = 0;
    this.gameOverTriggered = false;
    this.victoryTriggered = false;

    this.setupInputs();

    // HUD & Touch Controls
    const uiRoot = document.getElementById('ui-overlay');
    this.hud = new GameHUD(uiRoot, {
      onToggleDayNight: () => this.toggleDayNightMode(),
      onToggleMute: () => this.toggleMute(),
      onPause: () => this.pauseGame(),
      onToggleFullscreen: () => this.requestFullscreenLandscape(),
      onTriggerAbility: (abilityId) => this.player?.tryActivateAbility(abilityId),
    });
    this.hud.mount({
      kingdomName: this.kingdom.isBonusWorld ? this.kingdom.subBiome : this.kingdom.kingdomName,
      levelLabel: this.kingdom.isBonusWorld ? `Bonus #${this.kingdom.bonusOrder}` : `Lv.${this.kingdom.levelNumber}`,
      difficultyLabel: this.kingdom.difficulty?.tierLabel || 'EASY',
      difficultyColor: this.kingdom.difficulty?.tierColor || '#2dd4bf',
      playerLevel: playerStats.playerLevel,
      objectiveText: this.kingdom.objective?.label || '',
    });

    this.mobileControls = new MobileControls(uiRoot, {
      onPause: () => this.pauseGame(),
    });
    this.mobileControls.mount(save.settings.touchControls || 'auto');
    this.applyCameraFraming();

    this.resizeHandler = () => {
      this.applyCameraFraming();
      this.mobileControls?.mount(saveSystem.load().settings.touchControls || 'auto');
    };
    this.scale.on('resize', this.resizeHandler);
    window.addEventListener('resize', this.resizeHandler);

    const registerGameBack = () => {
      androidBridge.setBackHandler(() => {
        this.pauseGame();
        return true;
      });
    };
    registerGameBack();

    this.events.once('shutdown', () => {
      androidBridge.setBackHandler(null);
      this.cleanup();
    });
    this.events.on('resume', () => {
      document.body.dataset.state = 'playing';
      registerGameBack();
      this.clearHeldKeys();
      this.applyCameraFraming();
    });
  }

  applyCameraFraming() {
    if (!this.cameras?.main || !this.kingdom) return;
    const cam = this.cameras.main;
    const framing = computeCameraFraming(this.scale.width, this.scale.height, this.kingdom.worldHeight);
    cam.setZoom(framing.zoom);
    cam.setFollowOffset(framing.followOffsetX, framing.followOffsetY);
    this.levelManager?.syncViewportSize?.(cam);
    const touchMode = saveSystem.load().settings.touchControls || 'auto';
    const showTouch = Boolean(this.mobileControls?.shouldShow(touchMode));
    this.hud?.setOrientationHint?.(framing.isPortrait, showTouch);
  }

  async requestFullscreenLandscape() {
    try {
      const shell = document.getElementById('game-shell') || document.documentElement;
      if (!document.fullscreenElement && shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
      if (screen.orientation?.lock) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Non-fatal: iOS Safari / restricted iframes may disallow orientation lock
    }
  }

  setupInputs() {
    this.heldKeys = new Set();
    this.edgeFlags = {
      jumpJustPressed: false,
      jumpJustReleased: false,
      attackJustPressed: false,
      dashJustPressed: false,
      abilityJustPressed: false,
      interactJustPressed: false,
      slot2JustPressed: false,
      slot3JustPressed: false,
      slot4JustPressed: false,
      slot5JustPressed: false,
    };

    this.onKeyDown = (e) => {
      if (this.scene.isPaused()) return;
      audioSystem.ensureContext();
      const code = e.code;
      const firstPress = !this.heldKeys.has(code);
      this.heldKeys.add(code);

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }

      if (!firstPress) return;

      if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
        this.edgeFlags.jumpJustPressed = true;
      } else if (code === 'KeyJ') {
        this.edgeFlags.attackJustPressed = true;
      } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
        this.edgeFlags.dashJustPressed = true;
      } else if (code === 'KeyK') {
        this.edgeFlags.abilityJustPressed = true;
      } else if (code === 'Digit2') {
        this.edgeFlags.slot2JustPressed = true;
      } else if (code === 'Digit3') {
        this.edgeFlags.slot3JustPressed = true;
      } else if (code === 'Digit4') {
        this.edgeFlags.slot4JustPressed = true;
      } else if (code === 'Digit5') {
        this.edgeFlags.slot5JustPressed = true;
      } else if (code === 'KeyE') {
        this.edgeFlags.interactJustPressed = true;
      } else if (code === 'KeyT') {
        this.toggleDayNightMode();
      } else if (code === 'KeyM') {
        this.toggleMute();
      } else if (code === 'Escape' || code === 'KeyP') {
        this.pauseGame();
      }
    };

    this.onKeyUp = (e) => {
      const code = e.code;
      this.heldKeys.delete(code);
      if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
        this.edgeFlags.jumpJustReleased = true;
      }
    };

    this.onBlurOrHide = () => {
      this.clearHeldKeys();
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlurOrHide);
    document.addEventListener('visibilitychange', this.onBlurOrHide);
  }

  clearHeldKeys() {
    this.heldKeys?.clear();
    this.mobileControls?.reset();
    if (this.edgeFlags) {
      Object.keys(this.edgeFlags).forEach((k) => {
        this.edgeFlags[k] = false;
      });
    }
  }

  consumeCombinedInput() {
    const touch = this.mobileControls ? this.mobileControls.consumeSnapshot() : {};
    const combined = {
      left: this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') || Boolean(touch.left),
      right: this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') || Boolean(touch.right),
      up: this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') || Boolean(touch.up),
      down: this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown'),
      jumpJustPressed: this.edgeFlags.jumpJustPressed || Boolean(touch.jumpJustPressed),
      jumpJustReleased: this.edgeFlags.jumpJustReleased || Boolean(touch.jumpJustReleased),
      attackJustPressed: this.edgeFlags.attackJustPressed || Boolean(touch.attackJustPressed),
      dashJustPressed: this.edgeFlags.dashJustPressed || Boolean(touch.dashJustPressed),
      abilityJustPressed: this.edgeFlags.abilityJustPressed || Boolean(touch.abilityJustPressed),
      interactJustPressed: this.edgeFlags.interactJustPressed || Boolean(touch.interactJustPressed),
      slot2JustPressed: this.edgeFlags.slot2JustPressed,
      slot3JustPressed: this.edgeFlags.slot3JustPressed,
      slot4JustPressed: this.edgeFlags.slot4JustPressed,
      slot5JustPressed: this.edgeFlags.slot5JustPressed,
    };

    Object.keys(this.edgeFlags).forEach((k) => {
      this.edgeFlags[k] = false;
    });
    return combined;
  }

  toggleDayNightMode() {
    const next = this.dayNightCycle.toggleTargetMode();
    saveSystem.updateSettings({ dayNightMode: next });
    audioSystem.setTimeMood(next === 'night');
  }

  toggleMute() {
    const nextMuted = !audioSystem.muted;
    audioSystem.setMuted(nextMuted);
    saveSystem.updateSettings({ muted: nextMuted });
  }

  pauseGame() {
    if (this.gameOverTriggered || this.victoryTriggered) return;
    this.clearHeldKeys();
    this.scene.pause();
    this.scene.launch('PauseScene', {
      kingdomId: this.kingdom.kingdomId,
      levelNumber: this.kingdom.levelNumber,
      bonusWorldId: this.bonusWorldId,
    });
  }

  update(_, rawDelta) {
    const dt = Math.min(rawDelta / 1000, 0.05);

    this.dayNightCycle.update(dt);
    this.dayNightState = this.dayNightCycle.getLightingForLevel(this.kingdom, this.player.nightVisionActive);
    audioSystem.setTimeMood(this.dayNightState.isNightDominant);
    this.levelManager.updateDayNightVisuals(dt, this.dayNightState, this.player);

    const hitstopped = this.combat.update(dt);
    if (hitstopped) {
      this.hud?.update({
        player: this.player,
        boss: this.boss,
        stats: this.stats,
        cycleState: this.dayNightState,
        muted: audioSystem.muted,
        interactLabel: null,
      });
      return;
    }

    if (!this.victoryTriggered && !this.gameOverTriggered) {
      this.stats.elapsedSec += dt;
    }

    this.levelManager.updateDynamicPlatforms(dt, this.player);

    const input = this.consumeCombinedInput();
    this.player.update(dt, input, this.dayNightState.nightwalkerEnergyBonus);

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.update(dt, this.player, this.dayNightState.enemyDetectionMultiplier);
    }

    if (
      this.boss &&
      !this.boss.active &&
      !this.boss.isDefeated &&
      this.player.x >= this.kingdom.bossArena.triggerX
    ) {
      this.boss.activate();
      this.levelManager.lockBossArena();
    }
    if (this.boss && this.boss.active && !this.boss.isDefeated) {
      this.boss.update(dt, this.player);
    }

    const pHurtbox = this.player.getHurtbox();
    const pPickupBounds = Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(pHurtbox), 10, 6);
    for (const item of this.levelManager.collectibles) {
      if (item.collected) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(pPickupBounds, item.sprite.getBounds())) {
        item.collected = true;
        item.sprite.destroy();
        audioSystem.playPickup(item.type);
        if (item.type === 'heal') {
          this.player.heal(30);
          this.combat.spawnBurst(this.player.x, this.player.y - 24, 0x10b981, 10, 120);
        } else if (item.type === 'gem') {
          this.stats.gems += 1;
          this.stats.score += 150;
          this.player.addEnergy(25);
          this.combat.spawnBurst(item.sprite.x, item.sprite.y, 0xc084fc, 12, 140);
        } else {
          this.stats.shards += 1;
          this.stats.score += 50;
          this.player.addEnergy(10);
          this.combat.spawnBurst(item.sprite.x, item.sprite.y, 0x38bdf8, 8, 120);
        }
      }
    }

    if (this.hazardCooldown > 0) this.hazardCooldown = Math.max(0, this.hazardCooldown - dt);
    if (!this.player.isDead && this.hazardCooldown <= 0) {
      for (const h of this.levelManager.hazards) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(pHurtbox, h.rect)) {
          this.hazardCooldown = 0.75;
          this.player.takeDamage(h.damage, -this.player.facing);
          break;
        }
      }
    }
    if (!this.player.isDead && this.player.y > this.kingdom.worldHeight + 45) {
      this.player.takeDamage(25, 1);
      if (!this.player.isDead) {
        this.player.setPosition(this.respawnPoint.x, this.respawnPoint.y);
        this.player.body.setVelocity(0, 0);
      }
    }

    // Unlock non-boss Exit Portal automatically if objective satisfied (gate opened / mini-boss defeated)
    if (!this.kingdom.bossArena && !this.levelManager.portalUnlocked) {
      const gateDone = !this.levelManager.switchObj || this.levelManager.switchObj.activated;
      const miniDone =
        !this.kingdom.isMiniBossLevel ||
        this.enemies.filter((e) => e.isMiniBoss).every((e) => e.aiState === 'DEFEAT');
      if (gateDone && miniDone) {
        this.levelManager.unlockBossArenaAndPortal();
      }
    }

    const interactLabel = this.handleInteractables(input.interactJustPressed);

    if (this.player.isDead && !this.gameOverTriggered) {
      this.gameOverTriggered = true;
      this.time.delayedCall(650, () => {
        this.scene.pause();
        this.scene.launch('GameOverScene', {
          kingdomId: this.kingdom.kingdomId,
          kingdomName: this.kingdom.name,
          levelNumber: this.kingdom.levelNumber,
          bonusWorldId: this.bonusWorldId,
          score: this.stats.score,
          shards: this.stats.shards,
          enemiesSlain: this.stats.enemiesSlain,
          hasCheckpoint: Boolean(this.activeCheckpointId),
        });
      });
    }

    this.hud?.update({
      player: this.player,
      boss: this.boss,
      stats: this.stats,
      cycleState: this.dayNightState,
      muted: audioSystem.muted,
      interactLabel,
    });
  }

  handleInteractables(interactPressed) {
    let prompt = null;

    for (const cp of this.levelManager.checkpoints) {
      const dist = Math.hypot(this.player.x - cp.x, this.player.y - cp.y);
      if (dist < 68) {
        if (!cp.activated) {
          cp.activated = true;
          cp.sprite.setFrame(1);
          this.activeCheckpointId = cp.id;
          this.respawnPoint = { x: cp.x, y: cp.y - 6 };
          this.player.heal(30);
          audioSystem.playCheckpoint();
          this.combat.spawnBurst(cp.x, cp.y - 36, 0x2dd4bf, 18, 160);
          saveSystem.saveProgress({
            kingdomId: this.kingdom.kingdomId,
            levelNumber: this.kingdom.levelNumber,
            checkpointId: cp.id,
            score: this.stats.score,
          });
        }
        prompt = `[E] ${cp.name} (Sanctified)`;
        if (interactPressed) {
          this.player.heal(20);
          this.player.addEnergy(30);
          audioSystem.playCheckpoint();
        }
      }
    }

    const sw = this.levelManager.switchObj;
    if (sw && !sw.activated) {
      const dist = Math.hypot(this.player.x - sw.x, this.player.y - sw.y);
      if (dist < 76) {
        prompt = '[E] Activate Rune Switch';
        if (interactPressed) {
          this.levelManager.activateGateSwitch();
        }
      }
    }

    const portal = this.levelManager.exitPortal;
    if (portal && this.levelManager.portalUnlocked && !this.victoryTriggered) {
      const dist = Math.hypot(this.player.x - portal.x, this.player.y - portal.y);
      if (dist < 62) {
        this.triggerVictory();
      } else if (dist < 110) {
        prompt = '[E] Enter Nightfall Portal';
        if (interactPressed) this.triggerVictory();
      }
    } else if (portal && !this.levelManager.portalUnlocked) {
      const dist = Math.hypot(this.player.x - portal.x, this.player.y - portal.y);
      if (dist < 95) {
        prompt = this.kingdom.isMiniBossLevel
          ? 'Defeat the Area Guardian to Unlock Portal'
          : 'Activate Rune Switch to Unlock Portal';
      }
    }

    return prompt;
  }

  onEnemyDefeated(enemy) {
    this.stats.enemiesSlain += 1;
    this.stats.score += enemy.arch?.scoreValue || 90;
    this.player.addEnergy(12);
  }

  onBossDefeated() {
    this.stats.score += 650;
    this.levelManager.unlockBossArenaAndPortal();
  }

  triggerVictory() {
    if (this.victoryTriggered) return;
    this.victoryTriggered = true;
    this.player.playVictory();
    audioSystem.playVictory();

    const finalScore = computeVictoryScore({
      baseScore: this.stats.score,
      hpRemaining: this.player.health,
      shards: this.stats.shards,
      gems: this.stats.gems,
      clearTimeSec: this.stats.elapsedSec,
    });

    const totalShardsInLevel = (this.kingdom.collectibles || []).filter((c) => c.type === 'shard').length;
    const stars = computeStarRating({
      hpRemaining: this.player.health,
      maxHealth: this.player.maxHealth,
      shardsCollected: this.stats.shards,
      totalShards: totalShardsInLevel,
      clearTimeSec: this.stats.elapsedSec,
    });

    const rewards = computeLevelRewards({
      levelNumber: this.kingdom.levelNumber,
      score: finalScore,
      stars,
      isBossLevel: Boolean(this.kingdom.isBossLevel),
      isBonusWorld: Boolean(this.bonusWorldId),
    });

    const totalGemsEarned = this.stats.gems + rewards.bonusGems;

    let saveOutcome;
    if (this.bonusWorldId) {
      saveOutcome = saveSystem.recordBonusWorldClear({
        bonusWorldId: this.bonusWorldId,
        score: finalScore,
        shards: this.stats.shards,
        gems: totalGemsEarned,
        coinsEarned: rewards.coins,
        xpEarned: rewards.xp,
      });
    } else {
      saveOutcome = saveSystem.recordLevelClear({
        levelNumber: this.kingdom.levelNumber,
        score: finalScore,
        stars,
        shards: this.stats.shards,
        gems: totalGemsEarned,
        coinsEarned: rewards.coins,
        xpEarned: rewards.xp,
        wasBossLevel: Boolean(this.kingdom.isBossLevel),
      });
    }

    const nextLevelNumber =
      !this.bonusWorldId && this.kingdom.levelNumber < 1000 ? this.kingdom.levelNumber + 1 : null;

    this.time.delayedCall(650, () => {
      this.scene.pause();
      this.scene.launch('VictoryScene', {
        isBonusWorld: Boolean(this.bonusWorldId),
        bonusWorldId: this.bonusWorldId,
        levelNumber: this.kingdom.levelNumber,
        nextLevelNumber,
        kingdomId: this.kingdom.kingdomId,
        kingdomName: this.kingdom.name,
        bossName: this.kingdom.bossName,
        stars,
        coinsEarned: rewards.coins,
        xpEarned: rewards.xp,
        levelsGained: saveOutcome.xpResult.levelsGained,
        playerLevel: saveOutcome.xpResult.playerLevel,
        finalScore,
        clearTimeSec: this.stats.elapsedSec,
        shards: this.stats.shards,
        gems: totalGemsEarned,
        enemiesSlain: this.stats.enemiesSlain,
      });
    });
  }

  respawnAtCheckpoint() {
    this.gameOverTriggered = false;
    this.player.respawnAt(this.respawnPoint.x, this.respawnPoint.y, true);
    this.clearHeldKeys();
  }

  cleanup() {
    audioSystem.stopAmbient();
    this.hud?.unmount();
    this.mobileControls?.unmount();
    this.levelManager?.destroy();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlurOrHide);
    document.removeEventListener('visibilitychange', this.onBlurOrHide);
    this.scale.off('resize', this.resizeHandler);
    window.removeEventListener('resize', this.resizeHandler);
  }
}

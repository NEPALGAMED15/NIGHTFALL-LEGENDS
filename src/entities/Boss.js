import Phaser from 'phaser';
import { computeBossPhase } from '../systems/CombatLogic.js';
import { getBossConfig } from '../systems/BossManager.js';
import { audioSystem } from '../systems/AudioSystem.js';

export class Boss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, kingdom) {
    super(scene, x, y, 'boss_sheet', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kingdom = kingdom;
    this.cfg = getBossConfig(kingdom.bossId, kingdom.difficulty);

    this.setOrigin(0.5, 1);
    this.body.setSize(64, 102);
    this.body.setOffset(32, 20);
    this.setDepth(17);
    if (this.cfg.tint) this.setTint(this.cfg.tint);

    this.maxHp = this.cfg.maxHp;
    this.hp = this.cfg.maxHp;
    this.phase = 1;
    this.active = false; // Activated when player crosses arena trigger
    this.isDefeated = false;

    this.state = 'IDLE'; // IDLE | APPROACH | WINDUP | SLAM_LEAP | CAST | ERUPTION | RECOVER | DEFEAT
    this.stateTimer = 1.0;
    this.patternIndex = 0;
    this.facing = -1;
    this.setFlipX(true);
    this.hurtFlashTimer = 0;
    this.hasLandedSlam = false;
  }

  activate() {
    if (this.active || this.isDefeated) return;
    this.active = true;
    this.state = 'APPROACH';
    this.stateTimer = 1.4;
    audioSystem.playBossTelegraph();
  }

  update(dt, player) {
    if (!this.active || this.isDefeated) return;

    if (this.hurtFlashTimer > 0) {
      this.hurtFlashTimer -= dt;
      if (this.hurtFlashTimer <= 0) {
        if (this.phase === 2) {
          this.setTint(0xfca5a5);
        } else if (this.cfg.tint) {
          this.setTint(this.cfg.tint);
        } else {
          this.clearTint();
        }
      }
    }

    const nextPhase = computeBossPhase(this.hp, this.maxHp);
    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.setFrame(5);
      this.setTint(0xfca5a5);
      this.scene.cameras.main.shake(260, 0.012);
      this.scene.combat?.spawnBurst(this.x, this.y - 60, 0xf43f5e, 28, 250);
      audioSystem.playBossTelegraph();
    }

    const dx = player.x - this.x;
    this.facing = dx >= 0 ? 1 : -1;
    this.setFlipX(this.facing < 0);

    const speedMult = this.phase === 2 ? 1.32 : 1.0;
    this.stateTimer -= dt;

    if (this.state === 'APPROACH') {
      this.setFrame(Math.floor(this.scene.time.now / 220) % 2);
      if (Math.abs(dx) > 95) {
        this.body.setVelocityX(this.facing * this.cfg.speed * speedMult);
      } else {
        this.body.setVelocityX(0);
      }
      if (this.stateTimer <= 0) {
        this.chooseNextPattern(player);
      }
    } else if (this.state === 'WINDUP') {
      this.body.setVelocityX(0);
      this.setFrame(this.phase === 2 ? 3 : 2);
      if (this.stateTimer <= 0) {
        this.executePattern(player);
      }
    } else if (this.state === 'SLAM_LEAP') {
      this.setFrame(4);
      const grounded = this.body.blocked.down || this.body.touching.down;
      if (!this.hasLandedSlam && grounded && this.body.velocity.y >= 0 && this.stateTimer < 0.75) {
        this.hasLandedSlam = true;
        this.body.setVelocityX(0);
        this.scene.cameras.main.shake(220, 0.012);
        audioSystem.playHit(true);
        this.scene.combat?.spawnBurst(this.x, this.y - 6, this.cfg.accent, 20, 210);
        // Shockwave orbs left & right
        this.scene.combat?.spawnEnemyProjectile(this.x - 18, this.y - 16, -1, 0, 260, this.cfg.damage * 0.8);
        this.scene.combat?.spawnEnemyProjectile(this.x + 18, this.y - 16, 1, 0, 260, this.cfg.damage * 0.8);
        if (Math.abs(player.x - this.x) < 115 && Math.abs(player.y - this.y) < 75) {
          player.takeDamage(this.cfg.damage, player.x >= this.x ? 1 : -1);
        }
        this.state = 'RECOVER';
        this.stateTimer = this.phase === 2 ? 0.55 : 0.85;
      } else if (this.stateTimer <= 0) {
        this.state = 'RECOVER';
        this.stateTimer = 0.7;
      }
    } else if (this.state === 'RECOVER') {
      this.setFrame(0);
      this.body.setVelocityX(0);
      if (this.stateTimer <= 0) {
        this.state = 'APPROACH';
        this.stateTimer = this.phase === 2 ? 0.95 : 1.35;
      }
    }
  }

  chooseNextPattern(player) {
    const patterns = ['slam', 'barrage', 'eruption'];
    this.pendingPattern = patterns[this.patternIndex % patterns.length];
    this.patternIndex += 1;

    this.state = 'WINDUP';
    this.stateTimer = this.phase === 2 ? 0.48 : 0.65;
    audioSystem.playBossTelegraph();
    this.scene.combat?.spawnBurst(this.x, this.y - 60, 0xfde047, 10, 120);

    // Pre-mark ground eruption zones during windup so player can jump onto platforms or dodge!
    if (this.pendingPattern === 'eruption') {
      const targets = [player.x - 130, player.x, player.x + 130];
      this.eruptionTargets = targets.map((tx) =>
        Math.max(this.kingdom.bossArena.leftWallX + 40, Math.min(this.kingdom.bossArena.rightWallX - 40, tx))
      );
      this.eruptionMarkers = this.eruptionTargets.map((tx) =>
        this.scene.add.ellipse(tx, this.kingdom.groundY - 4, 62, 14, 0xf43f5e, 0.55).setDepth(12)
      );
    }
  }

  executePattern(player) {
    if (this.pendingPattern === 'slam') {
      this.state = 'SLAM_LEAP';
      this.stateTimer = 1.1;
      this.hasLandedSlam = false;
      this.body.setVelocity(this.facing * 240, -430);
    } else if (this.pendingPattern === 'barrage') {
      const count = this.phase === 2 ? 5 : 3;
      const baseAngle = Math.atan2(player.y - 30 - (this.y - 60), player.x - this.x);
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 0.24;
        const vx = Math.cos(baseAngle + offset);
        const vy = Math.sin(baseAngle + offset);
        this.scene.combat?.spawnEnemyProjectile(
          this.x + this.facing * 24,
          this.y - 60,
          vx,
          vy,
          this.phase === 2 ? 275 : 230,
          Math.round(this.cfg.damage * 0.75)
        );
      }
      this.state = 'RECOVER';
      this.stateTimer = this.phase === 2 ? 0.65 : 0.95;
    } else {
      // Root / Element Eruption Pillars
      (this.eruptionMarkers || []).forEach((m) => m.destroy());
      this.eruptionMarkers = [];
      const targets = this.eruptionTargets || [player.x];
      targets.forEach((tx) => {
        const pillar = this.scene.add
          .rectangle(tx, this.kingdom.groundY - 75, 42, 150, this.cfg.accent, 0.85)
          .setDepth(18);
        if (Math.abs(player.x - tx) < 36 && player.y > this.kingdom.groundY - 145) {
          player.takeDamage(this.cfg.damage, player.x >= tx ? 1 : -1);
        }
        this.scene.combat?.spawnBurst(tx, this.kingdom.groundY - 12, this.cfg.accent, 12, 170);
        this.scene.tweens.add({
          targets: pillar,
          alpha: 0,
          scaleY: 0.2,
          duration: 380,
          onComplete: () => pillar.destroy(),
        });
      });
      this.scene.cameras.main.shake(170, 0.008);
      this.state = 'RECOVER';
      this.stateTimer = this.phase === 2 ? 0.7 : 1.05;
    }
  }

  takeDamage(amount, isCrit = false) {
    if (this.isDefeated) return false;
    if (!this.active) this.activate();
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlashTimer = 0.08;
    this.setTint(0xffffff);
    this.setFrame(6);
    this.scene.combat?.spawnDamageNumber(this.x, this.y - 115, amount, isCrit);

    if (this.hp <= 0) {
      this.defeat();
    } else {
      audioSystem.playHit(isCrit);
    }
    return true;
  }

  defeat() {
    this.isDefeated = true;
    this.state = 'DEFEAT';
    this.setFrame(7);
    this.body.setEnable(false);
    (this.eruptionMarkers || []).forEach((m) => m.destroy());
    this.eruptionMarkers = [];
    audioSystem.playVictory();
    this.scene.cameras.main.shake(320, 0.015);
    this.scene.combat?.spawnBurst(this.x, this.y - 60, this.cfg.accent, 36, 260);
    this.scene.onBossDefeated(this);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y + 18,
      duration: 850,
      onComplete: () => this.destroy(),
    });
  }
}

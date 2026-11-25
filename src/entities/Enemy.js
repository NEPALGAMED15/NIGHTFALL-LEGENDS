import Phaser from 'phaser';
import { audioSystem } from '../systems/AudioSystem.js';

const ENEMY_ARCHETYPES = {
  blight_stalker: {
    sheet: 'blight_stalker',
    idleAnim: 'stalker_idle',
    moveAnim: 'stalker_run',
    windupAnim: 'stalker_windup',
    attackAnim: 'stalker_attack',
    maxHp: 46,
    speed: 115,
    chaseSpeed: 215,
    detectRange: 300,
    attackRange: 62,
    damage: 14,
    scoreValue: 90,
    gravity: true,
    bodySize: [36, 32],
    bodyOffset: [10, 14],
    policy: 'chaser',
  },
  spore_wisp: {
    sheet: 'spore_wisp',
    idleAnim: 'wisp_idle',
    moveAnim: 'wisp_idle',
    windupAnim: 'wisp_charge',
    attackAnim: 'wisp_charge',
    maxHp: 38,
    speed: 85,
    chaseSpeed: 105,
    detectRange: 360,
    attackRange: 270,
    damage: 12,
    scoreValue: 110,
    gravity: false,
    bodySize: [30, 32],
    bodyOffset: [9, 8],
    policy: 'ranged_kiter',
  },
  bramble_sentinel: {
    sheet: 'bramble_sentinel',
    idleAnim: 'sentinel_idle',
    moveAnim: 'sentinel_walk',
    windupAnim: 'sentinel_windup',
    attackAnim: 'sentinel_attack',
    maxHp: 90,
    speed: 65,
    chaseSpeed: 135,
    detectRange: 280,
    attackRange: 74,
    damage: 20,
    scoreValue: 160,
    gravity: true,
    bodySize: [40, 52],
    bodyOffset: [12, 10],
    policy: 'charger_shielded',
  },
  corrupted_treant: {
    sheet: 'corrupted_treant',
    idleAnim: 'treant_idle',
    moveAnim: 'treant_idle',
    windupAnim: 'treant_windup',
    attackAnim: 'treant_attack',
    maxHp: 195,
    speed: 60,
    chaseSpeed: 110,
    detectRange: 340,
    attackRange: 88,
    damage: 24,
    scoreValue: 420,
    gravity: true,
    bodySize: [52, 72],
    bodyOffset: [16, 14],
    policy: 'mini_boss',
  },
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, cfg) {
    const arch = ENEMY_ARCHETYPES[cfg.type] || ENEMY_ARCHETYPES.blight_stalker;
    super(scene, cfg.x, cfg.y, arch.sheet, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.cfg = cfg;
    this.arch = arch;
    this.isMiniBoss = Boolean(cfg.isMiniBoss);
    this.baseTint = cfg.variantTint || null;

    this.setOrigin(0.5, 1);
    this.body.setSize(arch.bodySize[0], arch.bodySize[1]);
    this.body.setOffset(arch.bodyOffset[0], arch.bodyOffset[1]);
    if (!arch.gravity) {
      this.body.setAllowGravity(false);
    }
    this.setDepth(16);
    if (this.baseTint) this.setTint(this.baseTint);

    this.hpMult = cfg.hpMult || 1.0;
    this.dmgMult = cfg.dmgMult || 1.0;
    this.speedMult = cfg.speedMult || 1.0;
    this.detectMult = cfg.detectMult || 1.0;

    this.maxHp = Math.round(arch.maxHp * this.hpMult);
    this.hp = this.maxHp;
    this.scaledDamage = Math.round(arch.damage * this.dmgMult);
    this.scaledSpeed = Math.round(arch.speed * this.speedMult);
    this.scaledChaseSpeed = Math.round(arch.chaseSpeed * this.speedMult);
    this.patrolMin = cfg.patrolMin ?? cfg.x - 120;
    this.patrolMax = cfg.patrolMax ?? cfg.x + 120;
    this.baseY = cfg.y;
    this.patrolDir = 1;
    this.facing = 1;

    this.aiState = 'PATROL'; // IDLE | PATROL | CHASE | WINDUP | ATTACK | HURT | DEFEAT
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.hurtTimer = 0;
    this.hasStruckThisAttack = false;
    this.floatPhase = Math.random() * Math.PI * 2;

    // Overhead HP bar + Telegraph indicator
    this.hpBg = scene.add.rectangle(this.x, this.y - this.height - 10, 44, 5, 0x0f172a, 0.85).setDepth(25);
    this.hpFill = scene.add.rectangle(this.x - 22, this.y - this.height - 10, 44, 5, 0xef4444, 1)
      .setOrigin(0, 0.5)
      .setDepth(26);
    this.hpBg.setVisible(this.isMiniBoss);
    this.hpFill.setVisible(this.isMiniBoss);

    this.telegraphText = scene.add
      .text(this.x, this.y - this.height - 24, '!', {
        fontFamily: 'Cinzel, serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fde047',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(28)
      .setVisible(false);

    this.play(arch.idleAnim);
  }

  update(dt, player, detectionMultiplier = 1.0) {
    if (this.aiState === 'DEFEAT') {
      this.updateOverlays();
      return;
    }

    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.hurtTimer > 0) {
      this.hurtTimer = Math.max(0, this.hurtTimer - dt);
      if (this.hurtTimer === 0 && this.aiState === 'HURT') {
        this.aiState = 'CHASE';
      }
      this.updateOverlays();
      return;
    }

    // Night Vision enemy highlight pulse
    if (player.nightVisionActive) {
      this.setTint(0x5eead4);
    } else if (this.baseTint) {
      this.setTint(this.baseTint);
    } else {
      this.clearTint();
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    // Day/Night cycle shifts detection radius!
    const effectiveDetectRange = this.arch.detectRange * this.detectMult * detectionMultiplier;

    if (this.aiState === 'WINDUP') {
      this.stateTimer -= dt;
      this.body.setVelocityX(0);
      this.telegraphText.setVisible(true);
      this.setTint(0xfde047);
      if (this.stateTimer <= 0) {
        this.telegraphText.setVisible(false);
        this.enterAttackState(player);
      }
      this.updateOverlays();
      return;
    }

    if (this.aiState === 'ATTACK') {
      this.stateTimer -= dt;
      if (!this.hasStruckThisAttack && this.stateTimer <= 0.18) {
        this.hasStruckThisAttack = true;
        this.executeAttackStrike(player);
      }
      if (this.stateTimer <= 0) {
        this.aiState = 'CHASE';
        this.attackCooldown = this.arch.policy === 'ranged_kiter' ? 1.8 : 1.15;
      }
      this.updateOverlays();
      return;
    }

    // Floating sine motion for Spore Wisp
    if (!this.arch.gravity) {
      this.floatPhase += dt * 3;
      this.body.setVelocityY(Math.sin(this.floatPhase) * 32);
    }

    // Evaluate detection
    const canSeePlayer = !player.isDead && dist <= effectiveDetectRange && Math.abs(dy) < 210;

    if (canSeePlayer) {
      this.aiState = 'CHASE';
      this.facing = dx >= 0 ? 1 : -1;
      this.setFlipX(this.facing < 0);

      if (this.arch.policy === 'ranged_kiter') {
        // Kiter keeps optimal range (140..270px)
        if (dist < 130) {
          this.body.setVelocityX(-this.facing * this.scaledChaseSpeed);
        } else if (dist > this.arch.attackRange) {
          this.body.setVelocityX(this.facing * this.scaledChaseSpeed);
        } else {
          this.body.setVelocityX(0);
          if (this.attackCooldown <= 0) {
            this.enterWindupState();
          }
        }
      } else {
        // Melee Chaser / Shielded Charger / Mini-Boss
        if (dist <= this.arch.attackRange && this.attackCooldown <= 0) {
          this.enterWindupState();
        } else {
          this.body.setVelocityX(this.facing * this.scaledChaseSpeed);
          if (this.anims.currentAnim?.key !== this.arch.moveAnim) {
            this.play(this.arch.moveAnim, true);
          }
        }
      }
    } else {
      // Patrol back and forth cleanly
      this.aiState = 'PATROL';
      if (this.x <= this.patrolMin) this.patrolDir = 1;
      if (this.x >= this.patrolMax) this.patrolDir = -1;
      this.facing = this.patrolDir;
      this.setFlipX(this.facing < 0);
      this.body.setVelocityX(this.patrolDir * this.scaledSpeed);
      if (this.anims.currentAnim?.key !== this.arch.moveAnim) {
        this.play(this.arch.moveAnim, true);
      }
    }

    this.updateOverlays();
  }

  enterWindupState() {
    this.aiState = 'WINDUP';
    this.stateTimer = this.arch.policy === 'charger_shielded' || this.isMiniBoss ? 0.55 : 0.42;
    this.body.setVelocityX(0);
    this.play(this.arch.windupAnim, true);
  }

  enterAttackState(player) {
    this.aiState = 'ATTACK';
    this.hasStruckThisAttack = false;
    this.stateTimer = 0.34;
    this.facing = player.x >= this.x ? 1 : -1;
    this.setFlipX(this.facing < 0);
    this.play(this.arch.attackAnim, true);

    if (this.arch.policy === 'chaser' || this.arch.policy === 'charger_shielded') {
      this.body.setVelocityX(this.facing * (this.arch.policy === 'charger_shielded' ? 280 : 230));
    }
  }

  executeAttackStrike(player) {
    if (player.isDead) return;
    if (this.arch.policy === 'ranged_kiter') {
      this.scene.combat?.spawnEnemyProjectile(
        this.x + this.facing * 16,
        this.y - 24,
        player.x - this.x,
        player.y - 24 - (this.y - 24),
        220,
        this.scaledDamage
      );
      return;
    }

    const dx = Math.abs(player.x - this.x);
    const dy = Math.abs(player.y - this.y);
    if (dx <= this.arch.attackRange + 18 && dy <= 64) {
      player.takeDamage(this.scaledDamage, player.x >= this.x ? 1 : -1);
    }
  }

  takeDamage(amount, knockbackDir = 1, isCrit = false) {
    if (this.aiState === 'DEFEAT') return false;
    // Shielded Sentinel takes slightly reduced damage from front unless crit
    let finalDmg = amount;
    if (this.arch.policy === 'charger_shielded' && knockbackDir !== this.facing && !isCrit) {
      finalDmg = Math.max(4, Math.round(amount * 0.72));
    }

    this.hp = Math.max(0, this.hp - finalDmg);
    this.hpBg.setVisible(true);
    this.hpFill.setVisible(true);
    this.hpFill.width = Math.max(0, (this.hp / this.maxHp) * 44);
    this.telegraphText.setVisible(false);

    this.scene.combat?.spawnDamageNumber(this.x, this.y - this.height, finalDmg, isCrit);

    if (this.hp <= 0) {
      this.die(knockbackDir);
      return true;
    }

    this.aiState = 'HURT';
    this.hurtTimer = 0.22;
    this.setTint(0xffffff);
    this.body.setVelocity(knockbackDir * 175, this.arch.gravity ? -140 : 0);
    audioSystem.playHit(isCrit);
    return true;
  }

  die(knockbackDir = 1) {
    this.aiState = 'DEFEAT';
    this.body.setEnable(false);
    this.telegraphText.setVisible(false);
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    audioSystem.playHit(true);
    this.scene.combat?.spawnBurst(this.x, this.y - 26, 0x2dd4bf, 16, 190);
    this.scene.onEnemyDefeated(this);

    this.scene.tweens.add({
      targets: this,
      x: this.x + knockbackDir * 28,
      y: this.y + 12,
      alpha: 0,
      angle: knockbackDir * 35,
      duration: 360,
      onComplete: () => {
        this.hpBg.destroy();
        this.hpFill.destroy();
        this.telegraphText.destroy();
        this.destroy();
      },
    });
  }

  updateOverlays() {
    const topY = this.y - this.height - 10;
    this.hpBg.setPosition(this.x, topY);
    this.hpFill.setPosition(this.x - 22, topY);
    this.telegraphText.setPosition(this.x, topY - 16);
  }
}

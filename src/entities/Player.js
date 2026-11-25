import Phaser from 'phaser';
import { ABILITIES, PHYSICS_CONFIG, PLAYER_BASE_STATS } from '../config.js';
import { canActivateAbility, computeMeleeDamage, computeSoulStrikeDamage, selectKaelAnimation } from '../systems/CombatLogic.js';
import { audioSystem } from '../systems/AudioSystem.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, statsConfig = null, biomeMechanic = 'canopy') {
    super(scene, x, y, 'kael', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    // Decoupled collision body centered at Kael's boots inside 112x96 sprite frame
    this.body.setSize(28, 56);
    this.body.setOffset(42, 40);
    this.body.setMaxVelocity(760, PHYSICS_CONFIG.MAX_FALL_SPEED);
    this.setCollideWorldBounds(true);
    this.setDepth(20);

    // Core attributes (scaled by ProgressionManager upgrades & level-ups)
    this.maxHealth = statsConfig?.maxHealth || PLAYER_BASE_STATS.maxHealth;
    this.health = this.maxHealth;
    this.maxEnergy = statsConfig?.maxEnergy || PLAYER_BASE_STATS.maxEnergy;
    this.energy = this.maxEnergy;
    this.energyRegenPerSec = statsConfig?.energyRegenPerSec || PLAYER_BASE_STATS.energyRegenPerSec;
    this.baseDamage = statsConfig?.baseDamage || PLAYER_BASE_STATS.baseDamage;
    this.critBonus = statsConfig?.critBonus || 0;
    this.biomeMechanic = biomeMechanic;
    this.facing = 1; // 1 right, -1 left

    // Movement & platforming timers
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.airJumpsLeft = 1;
    this.wasGrounded = false;
    this.landTimer = 0;
    this.prevVelY = 0;
    this.onLadder = false;
    this.onIce = false;
    this.standingPlatform = null;

    // Combat & ability timers
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackHasHit = false;
    this.comboStep = 0;
    this.comboResetTimer = 0;

    this.isDashing = false;
    this.dashTimer = 0;
    this.afterimageTimer = 0;

    this.invulnTimer = 0;
    this.hurtTimer = 0;
    this.isDead = false;
    this.isVictory = false;

    this.cooldowns = {};
    ABILITIES.forEach((a) => {
      this.cooldowns[a.id] = 0;
    });

    this.activeBuffs = {
      night_vision: 0,
      eclipse_mode: 0,
    };

    // Squash & stretch scale
    this.squashX = 1;
    this.squashY = 1;

    this.play('kael_idle');
  }

  get eclipseActive() {
    return this.activeBuffs.eclipse_mode > 0;
  }

  get nightVisionActive() {
    return this.activeBuffs.night_vision > 0;
  }

  getHurtbox() {
    if (this.body) {
      return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
    }
    return this.getBounds();
  }

  heal(amount) {
    if (this.isDead) return 0;
    const prev = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - prev;
  }

  addEnergy(amount) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  update(dt, input, nightwalkerEnergyBonus = 0) {
    // Passive energy regen (+ Nightwalker night bonus + Lunar Core upgrades)
    this.energy = Math.min(
      this.maxEnergy,
      this.energy + (this.energyRegenPerSec + nightwalkerEnergyBonus) * dt
    );

    // Tick cooldowns & buffs
    for (const id of Object.keys(this.cooldowns)) {
      if (this.cooldowns[id] > 0) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
    }
    for (const buff of Object.keys(this.activeBuffs)) {
      if (this.activeBuffs[buff] > 0) this.activeBuffs[buff] = Math.max(0, this.activeBuffs[buff] - dt);
    }

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.hurtTimer > 0) this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.landTimer > 0) this.landTimer = Math.max(0, this.landTimer - dt);
    if (this.comboResetTimer > 0) {
      this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
      if (this.comboResetTimer === 0) this.comboStep = 0;
    }

    // Dampen squash-and-stretch back to 1
    this.squashX += (1 - this.squashX) * Math.min(1, dt * 16);
    this.squashY += (1 - this.squashY) * Math.min(1, dt * 16);
    const scaleBoost = this.eclipseActive ? 1.12 : 1.0;
    this.setScale(this.squashX * scaleBoost, this.squashY * scaleBoost);

    // Visual aura tint
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0 && !this.isDashing) {
      this.setTint(0xff9999);
    } else if (this.eclipseActive) {
      this.setTint(0xfde68a);
    } else if (this.nightVisionActive) {
      this.setTint(0xa7f3d0);
    } else {
      this.clearTint();
    }

    if (this.isDead || this.isVictory) {
      this.body.setVelocityX(this.body.velocity.x * 0.85);
      return;
    }

    const grounded = this.body.blocked.down || this.body.touching.down;
    if (grounded && !this.wasGrounded) {
      // Landing squash + Land animation trigger
      this.squashX = 1.16;
      this.squashY = 0.84;
      this.airJumpsLeft = 1;
      if (this.prevVelY > 140) {
        this.landTimer = 0.14;
      }
      this.scene.combat?.spawnBurst(this.x, this.y - 2, 0x94a3b8, 6, 75);
    }
    this.wasGrounded = grounded;
    this.prevVelY = this.body.velocity.y;

    if (grounded) {
      this.coyoteTimer = PHYSICS_CONFIG.COYOTE_TIME;
      this.airJumpsLeft = 1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      this.landTimer = 0;
    }

    if (input.jumpJustPressed) {
      this.jumpBufferTimer = PHYSICS_CONFIG.JUMP_BUFFER_TIME;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Handle active Dash
    if (this.isDashing) {
      this.dashTimer -= dt;
      this.afterimageTimer -= dt;
      this.body.setAllowGravity(false);
      this.body.setVelocityY(0);
      this.body.setVelocityX(this.facing * PHYSICS_CONFIG.DASH_SPEED);

      if (this.afterimageTimer <= 0) {
        this.afterimageTimer = 0.038;
        this.spawnAfterimage(0x38bdf8);
      }

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.body.setAllowGravity(true);
        this.body.setVelocityX(this.facing * PHYSICS_CONFIG.MOVE_SPEED * 0.65);
      }
      this.updateAnimation(grounded);
      return;
    }

    // Ladder climbing when overlapping a ladder and pressing Up/Down
    const ladders = this.scene.levelManager?.ladders || [];
    const overlappingLadder = ladders.find(
      (l) => Math.abs(this.x - l.x) <= l.w * 0.65 && this.y >= l.topY - 8 && this.y <= l.bottomY + 12
    );
    if (overlappingLadder && (input.up || input.down)) {
      this.onLadder = true;
    } else if (!overlappingLadder || input.jumpJustPressed) {
      this.onLadder = false;
    }

    if (this.onLadder) {
      this.body.setAllowGravity(false);
      this.airJumpsLeft = 1;
      const climbDir = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      this.body.setVelocityY(climbDir * 215);
      this.body.setVelocityX(((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 165);
      if (input.jumpJustPressed) {
        this.onLadder = false;
        this.body.setAllowGravity(true);
        this.body.setVelocityY(PHYSICS_CONFIG.JUMP_VELOCITY);
        audioSystem.playJump(false);
      }
      this.updateAnimation(true);
      return;
    } else {
      this.body.setAllowGravity(true);
    }

    // Horizontal Movement (snappy turnaround + Ice traction glide in Frozen/Winter zones)
    const speed = PHYSICS_CONFIG.MOVE_SPEED * (this.eclipseActive ? PHYSICS_CONFIG.ECLIPSE_SPEED_MULT : 1);
    const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    if (this.hurtTimer <= 0) {
      if (moveDir !== 0) {
        this.facing = moveDir;
        this.setFlipX(moveDir < 0);
        const attackPenalty = this.isAttacking && grounded ? 0.48 : 1.0;
        const targetVx = moveDir * speed * attackPenalty;
        let curVx = this.body.velocity.x;
        if (Math.sign(curVx) !== moveDir && !this.onIce) {
          curVx = moveDir * 105;
        } else {
          const accel = this.onIce ? 1200 : grounded ? 2450 : 2800;
          if (Math.abs(targetVx - curVx) <= accel * dt) {
            curVx = targetVx;
          } else {
            curVx += Math.sign(targetVx - curVx) * accel * dt;
          }
        }
        this.body.setVelocityX(curVx);
      } else {
        const friction = this.onIce ? 0.94 : grounded ? 0.65 : 0.9;
        this.body.setVelocityX(this.body.velocity.x * friction);
        if (Math.abs(this.body.velocity.x) < 8) this.body.setVelocityX(0);
      }
    }

    // Jump & Double Jump (buoyant in Water / Low-Gravity Space/Dream realms)
    const gravJumpScale =
      this.biomeMechanic === 'low_gravity' ? 0.88 : this.biomeMechanic === 'water' ? 0.92 : 1.0;
    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0) {
        this.body.setVelocityY(PHYSICS_CONFIG.JUMP_VELOCITY * gravJumpScale);
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.landTimer = 0;
        this.squashX = 0.86;
        this.squashY = 1.15;
        audioSystem.playJump(false);
        this.scene.combat?.spawnBurst(this.x, this.y - 2, 0xcbd5e1, 6, 90);
      } else if (this.airJumpsLeft > 0) {
        this.body.setVelocityY(PHYSICS_CONFIG.DOUBLE_JUMP_VELOCITY * gravJumpScale);
        this.airJumpsLeft -= 1;
        this.jumpBufferTimer = 0;
        this.landTimer = 0;
        this.squashX = 0.88;
        this.squashY = 1.14;
        audioSystem.playJump(true);
        this.play('kael_double_jump', true);
        this.scene.combat?.spawnBurst(this.x, this.y - 8, 0x38bdf8, 9, 130);
      }
    }

    // Variable jump height cut when releasing Space/Up early
    if (input.jumpJustReleased && this.body.velocity.y < -120) {
      this.body.setVelocityY(this.body.velocity.y * 0.48);
    }

    // Attacks (J)
    if (input.attackJustPressed && !this.isAttacking && this.hurtTimer <= 0) {
      this.startSwordAttack();
    }

    if (this.isAttacking) {
      this.attackTimer -= dt;
      // Active hitbox frames in middle of swing
      if (!this.attackHasHit && this.attackTimer <= 0.22) {
        this.attackHasHit = true;
        this.performSwordHitbox();
      }
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
      }
    }

    // Abilities
    if (input.dashJustPressed) {
      this.tryActivateAbility('shadow_dash');
    }
    if (input.abilityJustPressed) {
      // K triggers Eclipse Mode (or Soul Strike if Eclipse is cooling down/low energy)
      if (!this.tryActivateAbility('eclipse_mode')) {
        this.tryActivateAbility('soul_strike');
      }
    }
    if (input.slot2JustPressed) this.tryActivateAbility('echo_clone');
    if (input.slot3JustPressed) this.tryActivateAbility('night_vision');
    if (input.slot4JustPressed) this.tryActivateAbility('soul_strike');
    if (input.slot5JustPressed) this.tryActivateAbility('eclipse_mode');

    this.updateAnimation(grounded);
  }

  startSwordAttack() {
    this.isAttacking = true;
    this.attackHasHit = false;
    this.landTimer = 0;
    this.attackTimer = this.comboStep === 2 ? 0.34 : 0.27;
    this.comboResetTimer = 0.72;

    const animKey =
      this.comboStep === 2 ? 'kael_combo_attack' : this.comboStep === 1 ? 'kael_attack2' : 'kael_attack1';
    this.play(animKey, true);
    audioSystem.playSlash(this.comboStep);
  }

  performSwordHitbox() {
    const reach = this.comboStep === 2 ? 78 : 66;
    const hitX = this.x + this.facing * (reach * 0.55);
    const hitY = this.y - 28;
    const hitW = reach;
    const hitH = 52;

    const nightVisionBonus = (this.scene.dayNightState?.nightVisionCritBonus ?? 0.25) + this.critBonus;
    const result = computeMeleeDamage({
      baseDamage: this.baseDamage,
      comboStep: this.comboStep,
      eclipseActive: this.eclipseActive,
      nightVisionActive: this.nightVisionActive,
      nightVisionCritBonus: nightVisionBonus,
      roll: Math.random(),
    });

    const hitCount = this.scene.combat?.resolvePlayerMeleeHit({
      x: hitX,
      y: hitY,
      w: hitW,
      h: hitH,
      damage: result.damage,
      isCrit: result.isCrit,
      heavy: this.comboStep === 2 || this.eclipseActive,
      facing: this.facing,
    });

    if (hitCount > 0) {
      this.addEnergy(8);
      if (result.lifesteal > 0) {
        this.heal(result.lifesteal);
      }
    }

    this.comboStep = (this.comboStep + 1) % 3;
  }

  tryActivateAbility(abilityId) {
    if (this.isDead || this.isVictory) return false;
    const check = canActivateAbility({
      abilityId,
      energy: this.energy,
      cooldowns: this.cooldowns,
    });
    if (!check.ok) return false;

    const def = check.def;
    this.energy -= def.energyCost;
    this.cooldowns[abilityId] = def.cooldown;
    audioSystem.playAbility(abilityId);

    if (abilityId === 'shadow_dash') {
      this.isDashing = true;
      this.isAttacking = false;
      this.dashTimer = PHYSICS_CONFIG.DASH_DURATION;
      this.invulnTimer = Math.max(this.invulnTimer, PHYSICS_CONFIG.DASH_DURATION + 0.08);
      this.play('kael_dash', true);
      this.scene.combat?.spawnBurst(this.x, this.y - 24, 0x38bdf8, 12, 170);
    } else if (abilityId === 'echo_clone') {
      this.scene.combat?.spawnEchoClone(this.x, this.y, this.facing, def.duration);
    } else if (abilityId === 'night_vision') {
      this.activeBuffs.night_vision = def.duration;
      this.scene.combat?.spawnBurst(this.x, this.y - 26, 0x2dd4bf, 14, 150);
    } else if (abilityId === 'soul_strike') {
      const dmg = computeSoulStrikeDamage({
        baseDamage: this.baseDamage,
        eclipseActive: this.eclipseActive,
      });
      this.play('kael_combo_attack', true);
      this.scene.combat?.spawnSoulWave(this.x + this.facing * 24, this.y - 28, this.facing, dmg);
    } else if (abilityId === 'eclipse_mode') {
      this.activeBuffs.eclipse_mode = def.duration;
      this.scene.cameras.main.shake(180, 0.008);
      this.scene.combat?.spawnBurst(this.x, this.y - 28, 0xf59e0b, 24, 230);
    }

    return true;
  }

  spawnAfterimage(tint = 0x38bdf8) {
    const ghost = this.scene.add
      .sprite(this.x, this.y, 'kael', this.frame.name)
      .setOrigin(0.5, 1)
      .setScale(this.scaleX, this.scaleY)
      .setFlipX(this.flipX)
      .setTint(tint)
      .setAlpha(0.55)
      .setDepth(18);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 240,
      onComplete: () => ghost.destroy(),
    });
  }

  takeDamage(amount, knockbackDir = -1) {
    if (this.isDead || this.isVictory || this.invulnTimer > 0) return false;
    this.health = Math.max(0, this.health - Math.round(amount));
    this.invulnTimer = PLAYER_BASE_STATS.invulnDuration;
    this.hurtTimer = 0.24;
    this.isAttacking = false;
    this.isDashing = false;
    this.body.setAllowGravity(true);

    this.body.setVelocity(knockbackDir * 220, -240);
    audioSystem.playPlayerHurt();
    this.scene.combat?.triggerHitstop(0.055);
    this.scene.cameras.main.shake(190, 0.011);
    this.scene.combat?.spawnBurst(this.x, this.y - 26, 0xf43f5e, 14, 180);

    if (this.health <= 0) {
      this.die();
    } else {
      this.play('kael_hurt', true);
    }
    return true;
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.isDashing = false;
    this.isAttacking = false;
    this.body.setAllowGravity(true);
    this.play('kael_defeat', true);
    audioSystem.playDefeat();
  }

  playVictory() {
    this.isVictory = true;
    this.isDashing = false;
    this.isAttacking = false;
    this.body.setVelocity(0, 0);
    this.play('kael_victory', true);
  }

  respawnAt(x, y, fullHeal = true) {
    this.isDead = false;
    this.isVictory = false;
    this.hurtTimer = 0;
    this.invulnTimer = 1.0;
    if (fullHeal) {
      this.health = this.maxHealth;
      this.energy = this.maxEnergy;
    }
    this.setPosition(x, y);
    this.body.setVelocity(0, 0);
    this.play('kael_idle', true);
  }

  updateAnimation(grounded) {
    const nextAnim = selectKaelAnimation({
      isDead: this.isDead,
      isVictory: this.isVictory,
      hurtTimer: this.hurtTimer,
      isDashing: this.isDashing,
      isAttacking: this.isAttacking,
      comboStep: this.comboStep,
      grounded,
      velocityX: this.body.velocity.x,
      velocityY: this.body.velocity.y,
      landTimer: this.landTimer,
      currentAnimKey: this.anims.currentAnim?.key || 'kael_idle',
    });

    if (this.isAttacking || this.isDead) return;
    if (this.anims.currentAnim?.key !== nextAnim) {
      this.play(nextAnim, true);
    }
  }
}

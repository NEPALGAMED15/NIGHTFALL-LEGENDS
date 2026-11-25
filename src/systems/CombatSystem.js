import Phaser from 'phaser';

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.hitstopTimer = 0;

    // Zero-GC pooled particle ring buffer
    this.poolSize = 150;
    this.particles = [];
    this.poolCursor = 0;
    for (let i = 0; i < this.poolSize; i++) {
      const sprite = scene.add.image(-9999, -9999, 'particle_dot').setDepth(30).setVisible(false);
      this.particles.push({
        sprite,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        gravity: 220,
      });
    }

    this.soulWaves = [];
    this.enemyProjectiles = [];
    this.echoClones = [];
  }

  triggerHitstop(seconds = 0.045) {
    this.hitstopTimer = Math.max(this.hitstopTimer, seconds);
  }

  spawnBurst(x, y, color = 0x38f2d2, count = 10, speed = 150) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.poolCursor];
      this.poolCursor = (this.poolCursor + 1) % this.poolSize;
      const angle = Math.random() * Math.PI * 2;
      const mag = (0.35 + Math.random() * 0.65) * speed;
      p.vx = Math.cos(angle) * mag;
      p.vy = Math.sin(angle) * mag - 45;
      p.maxLife = 0.25 + Math.random() * 0.3;
      p.life = p.maxLife;
      p.sprite.setPosition(x, y);
      p.sprite.setTint(color);
      p.sprite.setScale(0.6 + Math.random() * 0.7);
      p.sprite.setAlpha(1);
      p.sprite.setVisible(true);
    }
  }

  spawnDamageNumber(x, y, amount, isCrit = false) {
    const txt = this.scene.add
      .text(x + (Math.random() * 14 - 7), y - 8, isCrit ? `${amount}!` : `${amount}`, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: isCrit ? '20px' : '15px',
        fontStyle: 'bold',
        color: isCrit ? '#fde047' : '#ffffff',
        stroke: '#07090f',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(35);

    this.scene.tweens.add({
      targets: txt,
      y: txt.y - 34,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  resolvePlayerMeleeHit({ x, y, w, h, damage, isCrit, heavy, facing }) {
    const hitRect = new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h);
    let hits = 0;

    // 1. Enemies
    for (const enemy of this.scene.enemies) {
      if (!enemy.active || enemy.aiState === 'DEFEAT') continue;
      const bounds = enemy.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(hitRect, bounds)) {
        if (enemy.takeDamage(damage, facing, isCrit)) {
          hits++;
          this.spawnBurst(enemy.x, enemy.y - 24, isCrit ? 0xfde047 : 0x38f2d2, heavy ? 12 : 7, 170);
        }
      }
    }

    // 2. Boss
    const boss = this.scene.boss;
    if (boss && boss.active && !boss.isDefeated) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(hitRect, boss.getBounds())) {
        if (boss.takeDamage(damage, isCrit)) {
          hits++;
          this.spawnBurst(boss.x, boss.y - 54, isCrit ? 0xfde047 : 0x38f2d2, heavy ? 16 : 9, 200);
        }
      }
    }

    // 3. Breakable Crates
    for (const crate of this.scene.levelManager.crates) {
      if (crate.broken) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(hitRect, crate.sprite.getBounds())) {
        this.scene.levelManager.damageCrate(crate, damage);
        hits++;
      }
    }

    if (hits > 0) {
      this.triggerHitstop(heavy || isCrit ? 0.055 : 0.032);
      this.scene.cameras.main.shake(heavy ? 120 : 75, heavy ? 0.006 : 0.003);
    }
    return hits;
  }

  spawnSoulWave(x, y, dir, damage) {
    const sprite = this.scene.add.image(x, y, 'soul_wave').setDepth(22).setFlipX(dir < 0);
    this.soulWaves.push({
      sprite,
      vx: dir * 560,
      damage,
      life: 1.1,
      hitIds: new Set(),
    });
  }

  spawnEnemyProjectile(x, y, dx, dy, speed, damage) {
    const len = Math.hypot(dx, dy) || 1;
    const sprite = this.scene.add.image(x, y, 'enemy_orb').setDepth(22);
    this.enemyProjectiles.push({
      sprite,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      damage,
      life: 2.8,
    });
  }

  spawnEchoClone(x, y, facing, duration) {
    const sprite = this.scene.add
      .sprite(x, y, 'kael', 0)
      .setOrigin(0.5, 1)
      .setTint(0x818cf8)
      .setAlpha(0.72)
      .setFlipX(facing < 0)
      .setDepth(19);
    sprite.play('kael_idle');
    this.spawnBurst(x, y - 24, 0x818cf8, 12, 140);
    this.echoClones.push({
      sprite,
      life: duration,
      attackCd: 0.25,
      facing,
    });
  }

  update(dt) {
    // Update particles even during hitstop for crisp visual feedback
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.setVisible(false);
        continue;
      }
      p.vy += p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.setAlpha(Math.max(0, p.life / p.maxLife));
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return true; // Hitstop active: caller skips sim physics step
    }

    // Update Soul Strike Waves
    for (let i = this.soulWaves.length - 1; i >= 0; i--) {
      const w = this.soulWaves[i];
      w.life -= dt;
      w.sprite.x += w.vx * dt;
      const bounds = w.sprite.getBounds();

      for (const enemy of this.scene.enemies) {
        if (!enemy.active || enemy.aiState === 'DEFEAT' || w.hitIds.has(enemy)) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, enemy.getBounds())) {
          w.hitIds.add(enemy);
          enemy.takeDamage(w.damage, Math.sign(w.vx) || 1, true);
          this.spawnBurst(enemy.x, enemy.y - 24, 0xc084fc, 10, 160);
        }
      }

      const boss = this.scene.boss;
      if (boss && boss.active && !boss.isDefeated && !w.hitIds.has(boss)) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, boss.getBounds())) {
          w.hitIds.add(boss);
          boss.takeDamage(w.damage, true);
          this.spawnBurst(boss.x, boss.y - 54, 0xc084fc, 14, 180);
        }
      }

      if (w.life <= 0) {
        w.sprite.destroy();
        this.soulWaves.splice(i, 1);
      }
    }

    // Update Enemy Projectiles
    const player = this.scene.player;
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      proj.life -= dt;
      proj.sprite.x += proj.vx * dt;
      proj.sprite.y += proj.vy * dt;

      if (
        player &&
        !player.isDead &&
        !player.isDashing &&
        Phaser.Geom.Intersects.RectangleToRectangle(
          proj.sprite.getBounds(),
          player.getHurtbox ? player.getHurtbox() : player.getBounds()
        )
      ) {
        player.takeDamage(proj.damage, Math.sign(proj.vx) || -1);
        this.spawnBurst(proj.sprite.x, proj.sprite.y, 0xf43f5e, 8, 120);
        proj.sprite.destroy();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (proj.life <= 0) {
        proj.sprite.destroy();
        this.enemyProjectiles.splice(i, 1);
      }
    }

    // Update Echo Clones (autonomous shadow decoys!)
    for (let i = this.echoClones.length - 1; i >= 0; i--) {
      const clone = this.echoClones[i];
      clone.life -= dt;
      clone.attackCd -= dt;

      // Find nearest living enemy or active boss
      let target = null;
      let bestDist = 340;
      for (const e of this.scene.enemies) {
        if (!e.active || e.aiState === 'DEFEAT') continue;
        const d = Math.hypot(e.x - clone.sprite.x, e.y - clone.sprite.y);
        if (d < bestDist) {
          bestDist = d;
          target = e;
        }
      }
      if (!target && this.scene.boss && this.scene.boss.active && !this.scene.boss.isDefeated) {
        const d = Math.hypot(this.scene.boss.x - clone.sprite.x, this.scene.boss.y - clone.sprite.y);
        if (d < 420) target = this.scene.boss;
      }

      if (target) {
        const dx = target.x - clone.sprite.x;
        clone.facing = dx >= 0 ? 1 : -1;
        clone.sprite.setFlipX(clone.facing < 0);
        if (Math.abs(dx) > 48) {
          clone.sprite.x += clone.facing * 210 * dt;
          if (clone.sprite.anims.currentAnim?.key !== 'kael_run') clone.sprite.play('kael_run', true);
        } else if (clone.attackCd <= 0) {
          clone.attackCd = 0.68;
          clone.sprite.play('kael_attack1', true);
          target.takeDamage(16, clone.facing, false);
          this.spawnBurst(target.x, target.y - 26, 0x818cf8, 7, 130);
        }
      }

      if (clone.life <= 0) {
        this.spawnBurst(clone.sprite.x, clone.sprite.y - 24, 0x818cf8, 10, 120);
        clone.sprite.destroy();
        this.echoClones.splice(i, 1);
      }
    }

    return false;
  }
}

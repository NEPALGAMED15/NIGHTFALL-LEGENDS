import Phaser from 'phaser';
import { generateAllSpritesAndAnimations } from '../assets/SpriteAtlasGenerator.js';
import { buildParallaxAndForegroundAssets } from '../assets/ParallaxExtractor.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { adManager } from '../systems/AdManager.js';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
    this.hasTransitioned = false;
  }

  preload() {
    adManager.setGameplayActive(true);
    this.hasTransitioned = false;
    if (typeof window !== 'undefined') {
      window.__NIGHTFALL_BOOT_READY__ = true;
    }
    document.getElementById('boot-loader')?.classList.add('hidden');

    const w = this.scale.width || 1280;
    const h = this.scale.height || 720;
    const barW = Math.min(320, Math.max(180, w - 64));
    const barH = 12;

    const frame = this.add
      .rectangle(w / 2, h / 2, barW + 6, barH + 6, 0x111827)
      .setStrokeStyle(1, 0xc4a25e, 0.6);
    const fill = this.add.rectangle(w / 2 - barW / 2, h / 2, 8, barH, 0xc4a25e).setOrigin(0, 0.5);
    const titleTxt = this.add
      .text(w / 2, h / 2 - 34, 'NIGHTFALL LEGENDS', {
        fontFamily: 'Cinzel, serif',
        fontSize: `${Math.min(22, Math.max(16, Math.round(w / 24)))}px`,
        color: '#e6cb8b',
      })
      .setOrigin(0.5);
    const statusTxt = this.add
      .text(w / 2, h / 2 + 26, 'Loading Realm Assets...', {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    const onResize = (gameSize) => {
      const nw = gameSize.width;
      const nh = gameSize.height;
      frame.setPosition(nw / 2, nh / 2);
      fill.setPosition(nw / 2 - barW / 2, nh / 2);
      titleTxt.setPosition(nw / 2, nh / 2 - 34);
      statusTxt.setPosition(nw / 2, nh / 2 + 26);
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
    });

    this.load.on('progress', (val) => {
      fill.width = Math.max(8, barW * val);
    });

    this.load.image('forest_day', '/assets/backgrounds/forest_day.png');
    this.load.image('forest_night', '/assets/backgrounds/forest_night.png');
    this.load.on('loaderror', (fileObj) => {
      console.warn('Optional background asset failed to load, using procedural fallback:', fileObj?.key);
    });

    // Mobile slow-network timeout guard so preload never stalls indefinitely
    this.loadTimeoutId = setTimeout(() => {
      if (!this.hasTransitioned && this.scene.isActive('PreloadScene')) {
        console.warn('Preload timeout reached — proceeding with procedural textures.');
        this.finalizeAndLaunch(statusTxt);
      }
    }, 6500);
  }

  create() {
    if (this.loadTimeoutId) {
      clearTimeout(this.loadTimeoutId);
      this.loadTimeoutId = null;
    }
    this.finalizeAndLaunch(null);
  }

  finalizeAndLaunch(statusTxt) {
    if (this.hasTransitioned) return;
    this.hasTransitioned = true;
    if (statusTxt) statusTxt.setText('Forging Sprites & World...');

    try {
      generateAllSpritesAndAnimations(this);
    } catch (err) {
      console.error('Critical sprite generation failure:', err);
      const errOverlay = document.getElementById('fatal-error-overlay');
      const errMsg = document.getElementById('fatal-error-msg');
      if (errMsg) errMsg.textContent = 'Failed to build game sprites on this device. Tap Reload Game.';
      errOverlay?.classList.remove('hidden');
      return;
    }

    try {
      buildParallaxAndForegroundAssets(this);
    } catch (err) {
      // Non-fatal on constrained Android GPUs/RAM: procedural 6-layer renderer handles all levels cleanly
      console.warn('Parallax extraction fallback active:', err);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const save = saveSystem.load();
      const bonusParam = params.get('bonus');
      const levelParam = params.get('level');
      this.scene.start('GameScene', {
        bonusWorldId: bonusParam || null,
        levelNumber: levelParam ? Math.max(1, Math.min(1000, Number(levelParam) || 1)) : (save.currentLevel || 1),
        fromSave: false,
      });
      return;
    }

    this.scene.start('MenuScene');
  }
}

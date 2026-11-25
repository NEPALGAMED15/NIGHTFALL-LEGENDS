import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { generateAllSpritesAndAnimations } from '../assets/SpriteAtlasGenerator.js';
import { buildParallaxAndForegroundAssets } from '../assets/ParallaxExtractor.js';
import { saveSystem } from '../systems/SaveSystem.js';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const barW = 320;
    const barH = 12;
    const x = GAME_WIDTH / 2 - barW / 2;
    const y = GAME_HEIGHT / 2;

    this.add.rectangle(GAME_WIDTH / 2, y, barW + 6, barH + 6, 0x111827).setStrokeStyle(1, 0xc4a25e, 0.6);
    const fill = this.add.rectangle(x, y, 4, barH, 0xc4a25e).setOrigin(0, 0.5);
    this.add
      .text(GAME_WIDTH / 2, y - 30, 'NIGHTFALL LEGENDS', {
        fontFamily: 'Cinzel, serif',
        fontSize: '20px',
        color: '#e6cb8b',
      })
      .setOrigin(0.5);

    this.load.on('progress', (val) => {
      fill.width = Math.max(8, barW * val);
    });

    this.load.image('forest_day', '/assets/backgrounds/forest_day.png');
    this.load.image('forest_night', '/assets/backgrounds/forest_night.png');
    this.load.on('loaderror', () => {
      // Non-fatal: procedural parallax fallback stays intact if external images fail
    });
  }

  create() {
    generateAllSpritesAndAnimations(this);
    buildParallaxAndForegroundAssets(this);

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

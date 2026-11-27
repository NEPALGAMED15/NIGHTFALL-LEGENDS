import Phaser from 'phaser';
import { saveSystem } from '../systems/SaveSystem.js';
import { audioSystem } from '../systems/AudioSystem.js';
import { adManager } from '../systems/AdManager.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    adManager.setGameplayActive(true);
    if (typeof window !== 'undefined') {
      window.__NIGHTFALL_BOOT_READY__ = true;
    }
    try {
      const save = saveSystem.load();
      audioSystem.setMuted(Boolean(save?.settings?.muted));
      audioSystem.setVolume(typeof save?.settings?.volume === 'number' ? save.settings.volume : 0.65);
    } catch (err) {
      console.warn('Boot settings warning:', err);
    }
    this.scene.start('PreloadScene');
  }
}

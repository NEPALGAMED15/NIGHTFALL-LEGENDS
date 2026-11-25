import Phaser from 'phaser';
import { saveSystem } from '../systems/SaveSystem.js';
import { audioSystem } from '../systems/AudioSystem.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    const save = saveSystem.load();
    audioSystem.setMuted(save.settings.muted);
    audioSystem.setVolume(save.settings.volume);
    this.scene.start('PreloadScene');
  }
}

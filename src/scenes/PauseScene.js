import Phaser from 'phaser';
import { audioSystem } from '../systems/AudioSystem.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { adManager } from '../systems/AdManager.js';
import { androidBridge } from '../systems/AndroidBridge.js';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
    this.overlay = null;
  }

  init(data) {
    this.kingdomId = data?.kingdomId || 'whispering-forest';
    this.levelNumber = data?.levelNumber || 1;
    this.bonusWorldId = data?.bonusWorldId || null;
  }

  create() {
    adManager.setGameplayActive(true);
    document.body.dataset.state = 'paused';
    this.mountModal();

    this.keyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.resumeGame();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    androidBridge.setBackHandler(() => {
      this.resumeGame();
      return true;
    });

    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.keyHandler);
      androidBridge.setBackHandler(null);
      this.unmountModal();
    });
  }

  resumeGame() {
    document.body.dataset.state = 'playing';
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  mountModal() {
    this.unmountModal();
    const root = document.getElementById('ui-overlay');
    const div = document.createElement('div');
    div.id = 'pause-modal';
    div.className = 'absolute inset-0 bg-black/75 pointer-events-auto flex items-center justify-center p-4 overflow-y-auto z-40';

    const save = saveSystem.load();
    div.innerHTML = `
      <div class="nf-panel rounded-xl p-6 max-w-sm w-full text-center">
        <h2 class="font-display text-2xl text-[#e6cb8b] font-bold mb-1">Paused</h2>
        <p class="text-xs text-slate-400 mb-5">${
          this.bonusWorldId ? 'Bonus Realm' : `Campaign Level ${this.levelNumber}`
        }</p>
        <div class="flex flex-col gap-2.5">
          <button data-action="resume" class="nf-btn-primary py-2.5 px-4 rounded-md text-sm font-bold">
            Resume Game
          </button>
          <button data-action="toggle-daynight" class="nf-btn-secondary py-2.5 px-4 rounded-md text-sm font-semibold">
            Shift Day / Night
          </button>
          <button data-action="toggle-mute" class="nf-btn-secondary py-2.5 px-4 rounded-md text-sm font-semibold">
            Audio: ${save.settings.muted ? 'Muted' : 'On'}
          </button>
          <button data-action="restart" class="nf-btn-secondary py-2.5 px-4 rounded-md text-sm font-semibold">
            Restart Level
          </button>
          <button data-action="menu" class="nf-btn-secondary py-2.5 px-4 rounded-md text-sm font-semibold">
            Main Menu
          </button>
        </div>
      </div>
    `;

    root.appendChild(div);
    this.overlay = div;

    div.querySelector('[data-action="resume"]')?.addEventListener('click', () => this.resumeGame());
    div.querySelector('[data-action="toggle-daynight"]')?.addEventListener('click', () => {
      const gameScene = this.scene.get('GameScene');
      gameScene?.toggleDayNightMode();
    });
    div.querySelector('[data-action="toggle-mute"]')?.addEventListener('click', (e) => {
      const next = !audioSystem.muted;
      audioSystem.setMuted(next);
      saveSystem.updateSettings({ muted: next });
      e.currentTarget.textContent = `Audio: ${next ? 'Muted' : 'On'}`;
    });
    div.querySelector('[data-action="restart"]')?.addEventListener('click', () => {
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('GameScene', {
        levelNumber: this.levelNumber,
        bonusWorldId: this.bonusWorldId,
        fromSave: false,
      });
    });
    div.querySelector('[data-action="menu"]')?.addEventListener('click', () => {
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('MenuScene');
    });
  }

  unmountModal() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

import Phaser from 'phaser';
import { adManager } from '../systems/AdManager.js';
import { androidBridge } from '../systems/AndroidBridge.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
    this.overlay = null;
  }

  init(data) {
    this.summary = data || {
      kingdomId: 'whispering-forest',
      kingdomName: 'Whispering Forest',
      levelNumber: 1,
      bonusWorldId: null,
      score: 0,
      shards: 0,
      enemiesSlain: 0,
      hasCheckpoint: false,
    };
  }

  create() {
    adManager.setGameplayActive(true);
    document.body.dataset.state = 'gameover';
    this.mountModal();

    androidBridge.setBackHandler(() => {
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('MenuScene');
      return true;
    });

    this.events.once('shutdown', () => {
      androidBridge.setBackHandler(null);
      this.unmountModal();
    });
  }

  mountModal() {
    this.unmountModal();
    const root = document.getElementById('ui-overlay');
    const div = document.createElement('div');
    div.id = 'gameover-modal';
    div.className = 'absolute inset-0 bg-black/75 pointer-events-auto flex items-center justify-center p-4 overflow-y-auto z-40';

    div.innerHTML = `
      <div class="nf-panel rounded-xl p-6 max-w-md w-full text-center border-rose-500/40">
        <h2 class="font-display text-3xl text-rose-400 font-bold mb-1">Fallen in Darkness</h2>
        <p class="text-xs text-slate-400 mb-5">${this.summary.kingdomName}</p>

        <div class="grid grid-cols-3 gap-2.5 mb-6 text-left">
          <div class="bg-black/50 border border-white/10 rounded-lg p-3">
            <div class="text-[11px] text-slate-400">Score</div>
            <div class="font-mono-num text-lg font-bold text-[#e6cb8b]">${Math.round(this.summary.score)}</div>
          </div>
          <div class="bg-black/50 border border-white/10 rounded-lg p-3">
            <div class="text-[11px] text-slate-400">Shards</div>
            <div class="font-mono-num text-lg font-bold text-sky-300">${this.summary.shards}</div>
          </div>
          <div class="bg-black/50 border border-white/10 rounded-lg p-3">
            <div class="text-[11px] text-slate-400">Foes Slain</div>
            <div class="font-mono-num text-lg font-bold text-white">${this.summary.enemiesSlain}</div>
          </div>
        </div>

        <div class="flex flex-col gap-2.5">
          ${
            this.summary.hasCheckpoint
              ? `<button data-start="true" data-action="retry-checkpoint" class="nf-btn-primary py-2.5 px-4 rounded-md text-sm font-bold">
                  Respawn at Shrine
                 </button>`
              : ''
          }
          <button ${this.summary.hasCheckpoint ? '' : 'data-start="true"'} data-action="restart"
            class="${this.summary.hasCheckpoint ? 'nf-btn-secondary' : 'nf-btn-primary'} py-2.5 px-4 rounded-md text-sm font-bold">
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

    div.querySelector('[data-action="retry-checkpoint"]')?.addEventListener('click', () => {
      const gs = this.scene.get('GameScene');
      this.scene.stop();
      if (gs && gs.scene.isPaused()) {
        gs.respawnAtCheckpoint();
        this.scene.resume('GameScene');
      } else {
        this.scene.start('GameScene', {
          levelNumber: this.summary.levelNumber,
          bonusWorldId: this.summary.bonusWorldId,
          fromSave: true,
        });
      }
    });

    div.querySelector('[data-action="restart"]')?.addEventListener('click', () => {
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('GameScene', {
        levelNumber: this.summary.levelNumber,
        bonusWorldId: this.summary.bonusWorldId,
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

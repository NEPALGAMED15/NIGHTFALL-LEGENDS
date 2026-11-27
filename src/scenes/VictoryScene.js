import Phaser from 'phaser';
import { adManager } from '../systems/AdManager.js';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
    this.overlay = null;
  }

  init(data) {
    this.summary = data || {
      isBonusWorld: false,
      bonusWorldId: null,
      levelNumber: 1,
      nextLevelNumber: 2,
      kingdomId: 'whispering-forest',
      kingdomName: 'Whispering Forest · Lv. 1',
      bossName: 'Root Warden',
      stars: 3,
      coinsEarned: 50,
      xpEarned: 100,
      levelsGained: 0,
      playerLevel: 1,
      finalScore: 0,
      clearTimeSec: 0,
      shards: 0,
      gems: 0,
      enemiesSlain: 0,
    };
  }

  create() {
    adManager.setGameplayActive(true);
    document.body.dataset.state = 'gameover';
    this.mountModal();

    this.events.once('shutdown', () => {
      this.unmountModal();
    });
  }

  mountModal() {
    this.unmountModal();
    const root = document.getElementById('ui-overlay');
    const div = document.createElement('div');
    div.id = 'victory-modal';
    div.className = 'absolute inset-0 bg-black/75 pointer-events-auto flex items-center justify-center p-4 overflow-y-auto z-40';

    const mins = Math.floor(this.summary.clearTimeSec / 60);
    const secs = Math.floor(this.summary.clearTimeSec % 60)
      .toString()
      .padStart(2, '0');
    const stars = this.summary.stars || 1;
    const starRow = [1, 2, 3]
      .map(
        (i) =>
          `<span class="text-2xl ${i <= stars ? 'text-amber-300' : 'text-slate-600'}">${i <= stars ? '★' : '☆'}</span>`
      )
      .join('');

    const hasNext = Boolean(!this.summary.isBonusWorld && this.summary.nextLevelNumber);

    div.innerHTML = `
      <div class="nf-panel rounded-xl p-6 max-w-md w-full text-center border-[#c4a25e]/60">
        <div class="text-xs font-semibold tracking-widest text-teal-300 mb-1">
          ${this.summary.isBonusWorld ? 'BONUS WORLD CLEARED' : `LEVEL ${this.summary.levelNumber} CONQUERED`}
        </div>
        <h2 class="font-display text-2xl sm:text-3xl text-[#e6cb8b] font-bold mb-1">${this.summary.kingdomName}</h2>
        ${
          this.summary.bossName
            ? `<p class="text-xs text-slate-300 mb-2">${this.summary.bossName} Defeated</p>`
            : ''
        }
        <div class="flex items-center justify-center gap-2 mb-4">${starRow}</div>

        <div class="grid grid-cols-2 gap-2.5 mb-4 text-left">
          <div class="bg-black/50 border border-white/10 rounded-lg p-3">
            <div class="text-[11px] text-slate-400">Final Score</div>
            <div class="font-mono-num text-xl font-bold text-[#e6cb8b]">${Math.round(this.summary.finalScore)}</div>
          </div>
          <div class="bg-black/50 border border-white/10 rounded-lg p-3">
            <div class="text-[11px] text-slate-400">Clear Time</div>
            <div class="font-mono-num text-xl font-bold text-white">${mins}:${secs}</div>
          </div>
          <div class="bg-black/50 border border-white/10 rounded-lg p-3">
            <div class="text-[11px] text-slate-400">Coins · Gems</div>
            <div class="font-mono-num text-base font-bold text-amber-300">+${this.summary.coinsEarned || 0} · +${this.summary.gems || 0}</div>
          </div>
          <div class="bg-black/50 border border-white/10 rounded-lg p-3">
            <div class="text-[11px] text-slate-400">XP · Foes</div>
            <div class="font-mono-num text-base font-bold text-teal-300">+${this.summary.xpEarned || 0} XP · ${this.summary.enemiesSlain}</div>
          </div>
        </div>

        ${
          this.summary.levelsGained > 0
            ? `<div class="text-xs text-amber-300 mb-3 font-semibold">Kael Reached Level ${this.summary.playerLevel}!</div>`
            : ''
        }

        <div class="flex flex-col gap-2.5">
          ${
            hasNext
              ? `<button data-start="true" data-action="next" class="nf-btn-primary py-2.5 px-4 rounded-md text-sm font-bold">
                  Play Level ${this.summary.nextLevelNumber}
                 </button>`
              : `<div class="text-xs text-amber-300 mb-1">Legend of Nightfall — Realm Mastered!</div>`
          }
          <button ${hasNext ? '' : 'data-start="true"'} data-action="replay"
            class="${hasNext ? 'nf-btn-secondary' : 'nf-btn-primary'} py-2.5 px-4 rounded-md text-sm font-bold">
            Play Again
          </button>
          <button data-action="menu" class="nf-btn-secondary py-2.5 px-4 rounded-md text-sm font-semibold">
            Main Menu & Upgrades
          </button>
        </div>
      </div>
    `;

    root.appendChild(div);
    this.overlay = div;

    div.querySelector('[data-action="next"]')?.addEventListener('click', () => {
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('GameScene', { levelNumber: this.summary.nextLevelNumber, fromSave: false });
    });
    div.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
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

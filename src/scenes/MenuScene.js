import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { BONUS_WORLDS, getBonusWorldById, isBonusWorldUnlocked } from '../systems/BonusWorldManager.js';
import { getDifficultyTierForLevel } from '../systems/DifficultyManager.js';
import { KINGDOM_DEFINITIONS, getKingdomForLevel } from '../systems/KingdomManager.js';
import {
  ACHIEVEMENTS,
  UPGRADE_CATALOG,
  getPlayerUpgradedStats,
  getUpgradeCost,
  purchaseUpgrade,
  xpRequiredForPlayerLevel,
} from '../systems/ProgressionManager.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { audioSystem } from '../systems/AudioSystem.js';
import { DayNightManager } from '../systems/DayNightManager.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.overlay = null;
    this.activeSubModal = null; // null | 'levels' | 'bonus' | 'armory' | 'settings' | 'credits' | 'confirmReset'
    this.selectedKingdomIdx = 0;
    this.selectedLevelPage = 0;
    this.modalNotice = '';
    this.dayNightCycle = null;
  }

  create() {
    document.body.dataset.state = 'title';
    const save = saveSystem.load();
    const curInfo = getKingdomForLevel(save.currentLevel || 1);
    this.selectedKingdomIdx = Math.max(0, curInfo.kingdom.order - 1);
    this.selectedLevelPage = Math.floor((curInfo.localIndex - 1) / 50);
    this.modalNotice = '';

    this.dayNightCycle = new DayNightManager({
      initialMode: save.settings.dayNightMode || 'night',
      cycleDurationSec: 48,
      autoCycle: true,
    });

    this.buildLiveBackdrop();
    this.mountMenuOverlay();

    this.keyHandler = (e) => {
      if (this.activeSubModal) {
        if (e.key === 'Escape') {
          this.activeSubModal = null;
          this.modalNotice = '';
          this.renderMenu();
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.startPrimaryAction();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.keyHandler);
      this.unmountMenuOverlay();
    });
  }

  buildLiveBackdrop() {
    this.skyGfx = this.add.graphics().setDepth(0);

    const hasArt =
      this.textures.exists('layer_sky_day') || this.textures.exists('layer_sky_night');

    this.dayMenuLayers = [];
    this.nightMenuLayers = [];
    this.dayMenuForest = null;
    this.nightMenuForest = null;

    if (hasArt) {
      if (this.textures.exists('layer_sky_day')) {
        this.dayMenuLayers.push(this.add.image(720, 280, 'layer_sky_day').setDepth(1));
      }
      if (this.textures.exists('layer_sky_night')) {
        this.nightMenuLayers.push(this.add.image(720, 280, 'layer_sky_night').setDepth(1));
      }
      if (this.textures.exists('layer_mountains_day')) {
        this.dayMenuLayers.push(this.add.image(810, 280, 'layer_mountains_day').setDepth(2));
      }
      if (this.textures.exists('layer_mountains_night')) {
        this.nightMenuLayers.push(this.add.image(810, 280, 'layer_mountains_night').setDepth(2));
      }
      if (this.textures.exists('layer_forest_day')) {
        this.dayMenuForest = this.add
          .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 180, GAME_WIDTH, 360, 'layer_forest_day')
          .setDepth(3);
        this.dayMenuLayers.push(this.dayMenuForest);
      }
      if (this.textures.exists('layer_forest_night')) {
        this.nightMenuForest = this.add
          .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 180, GAME_WIDTH, 360, 'layer_forest_night')
          .setDepth(3);
        this.nightMenuLayers.push(this.nightMenuForest);
      }

      if (this.textures.exists('prop_ruin_day')) {
        this.dayMenuLayers.push(
          this.add.image(615, GAME_HEIGHT - 86, 'prop_ruin_day').setOrigin(0.5, 1).setDepth(4).setAlpha(0.92)
        );
      }
      if (this.textures.exists('prop_ruin_night')) {
        this.nightMenuLayers.push(
          this.add.image(615, GAME_HEIGHT - 86, 'prop_ruin_night').setOrigin(0.5, 1).setDepth(4).setAlpha(0.92)
        );
      }
      if (this.textures.exists('prop_tree_day')) {
        this.dayMenuLayers.push(
          this.add.image(95, GAME_HEIGHT - 80, 'prop_tree_day').setOrigin(0.5, 1).setDepth(4)
        );
      }
      if (this.textures.exists('prop_tree_night')) {
        this.nightMenuLayers.push(
          this.add.image(95, GAME_HEIGHT - 80, 'prop_tree_night').setOrigin(0.5, 1).setDepth(4)
        );
      }
      if (this.textures.exists('prop_banner_day')) {
        this.dayMenuLayers.push(
          this.add.image(1185, GAME_HEIGHT - 84, 'prop_banner_day').setOrigin(0.5, 1).setDepth(6)
        );
      }
      if (this.textures.exists('prop_banner_night')) {
        this.nightMenuLayers.push(
          this.add.image(1185, GAME_HEIGHT - 84, 'prop_banner_night').setOrigin(0.5, 1).setDepth(6)
        );
      }
      if (this.textures.exists('prop_crystal_amethyst')) {
        this.nightMenuLayers.push(
          this.add.image(1110, GAME_HEIGHT - 82, 'prop_crystal_amethyst').setOrigin(0.5, 1).setScale(0.75).setDepth(7)
        );
      }
      if (this.textures.exists('art_ground_day')) {
        this.dayMenuLayers.push(
          this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 42, GAME_WIDTH, 128, 'art_ground_day').setDepth(5)
        );
      }
      if (this.textures.exists('art_ground_night')) {
        this.nightMenuLayers.push(
          this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 42, GAME_WIDTH, 128, 'art_ground_night').setDepth(5)
        );
      }
      if (!this.textures.exists('art_ground_day') && !this.textures.exists('art_ground_night')) {
        this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 44, GAME_WIDTH, 88, 'tile_ground').setDepth(5);
      }
    } else {
      this.celestial = this.add.circle(960, 145, 34, 0xdce8ff, 0.92).setDepth(1);
      this.celestialGlow = this.add.circle(960, 145, 72, 0x5eead4, 0.14).setDepth(1);
      this.farBand = this.add
        .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 88 - 256, GAME_WIDTH, 512, 'tree_far_band')
        .setDepth(3)
        .setTint(0x1a223f);
      this.midBand = this.add
        .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 88 - 256, GAME_WIDTH, 512, 'tree_mid_band')
        .setDepth(4)
        .setTint(0x11182c);
      this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 44, GAME_WIDTH, 88, 'tile_ground').setDepth(5);
      this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 84, GAME_WIDTH, 14, 'tile_platform').setTint(0x1f5c4e).setDepth(6);
    }

    const shrine = this.add.sprite(980, GAME_HEIGHT - 88, 'checkpoint_sheet', 1).setOrigin(0.5, 1).setScale(1.3).setDepth(7);
    this.add.circle(shrine.x, shrine.y - 72, 68, 0x2dd4bf, 0.12).setDepth(6);

    const kael = this.add.sprite(885, GAME_HEIGHT - 84, 'kael', 0).setOrigin(0.5, 1).setScale(1.6).setDepth(8);
    kael.play('kael_idle');

    // Left readability scrim behind title & buttons
    this.add
      .rectangle(260, GAME_HEIGHT / 2, 560, GAME_HEIGHT, 0x050814, 0.44)
      .setDepth(6);

    this.fireflies = [];
    for (let i = 0; i < 24; i++) {
      this.fireflies.push({
        dot: this.add.circle(Math.random() * GAME_WIDTH, 140 + Math.random() * 440, 2.5, 0x38f2d2, 0.7).setDepth(9),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(_, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.dayNightCycle.update(dt);
    const st = this.dayNightCycle.getState(KINGDOM_DEFINITIONS[0].palette, false);

    this.skyGfx.clear();
    this.skyGfx.fillGradientStyle(st.skyTop, st.skyTop, st.skyBottom, st.skyBottom, 1);
    this.skyGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (this.dayMenuLayers?.length > 0 || this.nightMenuLayers?.length > 0) {
      const nightAlpha = Phaser.Math.Clamp(st.nightFactor, 0, 1);
      const dayAlpha = 1 - nightAlpha;
      this.dayMenuLayers.forEach((obj) => obj.setAlpha(dayAlpha));
      this.nightMenuLayers.forEach((obj) => obj.setAlpha(nightAlpha));
      if (this.dayMenuForest) this.dayMenuForest.tilePositionX += 16 * dt;
      if (this.nightMenuForest) this.nightMenuForest.tilePositionX += 16 * dt;
    } else {
      this.celestial?.setFillStyle(st.celestialColor, 0.95);
      this.celestialGlow?.setFillStyle(st.celestialColor, st.isNightDominant ? 0.16 : 0.25);
      if (this.farBand) {
        this.farBand.tilePositionX += 10 * dt;
        this.farBand.setTint(st.farTint);
      }
      if (this.midBand) {
        this.midBand.tilePositionX += 22 * dt;
        this.midBand.setTint(st.midTint);
      }
    }

    const now = this.time.now * 0.002;
    this.fireflies.forEach((f) => {
      f.dot.y += Math.sin(now + f.phase) * 0.25;
      f.dot.setAlpha(st.fireflyAlpha * (0.45 + 0.55 * Math.sin(now * 2 + f.phase)));
    });
  }

  mountMenuOverlay() {
    this.unmountMenuOverlay();
    const root = document.getElementById('ui-overlay');
    const div = document.createElement('div');
    div.id = 'menu-overlay';
    div.className = 'fixed inset-0 pointer-events-auto flex flex-col justify-between p-5 md:p-11 z-30';
    root.appendChild(div);
    this.overlay = div;
    this.renderMenu();
  }

  unmountMenuOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  startPrimaryAction() {
    const save = saveSystem.load();
    this.launchCampaignLevel(save.currentLevel || 1, false);
  }

  launchCampaignLevel(levelNumber = 1, fromSave = false) {
    audioSystem.ensureContext();
    const lv = Math.max(1, Math.min(1000, Math.round(levelNumber || 1)));
    const info = getKingdomForLevel(lv);
    saveSystem.saveProgress({
      kingdomId: info.kingdom.id,
      levelNumber: lv,
      checkpointId: fromSave ? saveSystem.load().lastCheckpoint : null,
      score: 0,
    });
    this.scene.start('GameScene', { levelNumber: lv, fromSave });
  }

  launchBonusWorld(bonusWorldId) {
    audioSystem.ensureContext();
    this.scene.start('GameScene', { bonusWorldId, fromSave: false });
  }

  continueGame() {
    audioSystem.ensureContext();
    const save = saveSystem.load();
    this.launchCampaignLevel(save.currentLevel || 1, true);
  }

  renderLevelsModal(save) {
    const kingdom = KINGDOM_DEFINITIONS[this.selectedKingdomIdx] || KINGDOM_DEFINITIONS[0];
    const span = kingdom.endLevel - kingdom.startLevel + 1;
    const totalPages = Math.ceil(span / 50);
    const pageIdx = Math.max(0, Math.min(totalPages - 1, this.selectedLevelPage));
    const pageStart = kingdom.startLevel + pageIdx * 50;
    const pageEnd = Math.min(kingdom.endLevel, pageStart + 49);

    const pagesHtml = Array.from({ length: totalPages }, (_, idx) => {
      const pStart = kingdom.startLevel + idx * 50;
      const pEnd = Math.min(kingdom.endLevel, pStart + 49);
      const active = idx === pageIdx;
      return `
        <button data-level-page="${idx}"
          class="${active ? 'nf-btn-primary' : 'nf-btn-secondary'} px-3 py-1.5 rounded text-xs font-semibold font-mono-num">
          ${pStart}–${pEnd}
        </button>
      `;
    }).join('');

    const gridButtons = [];
    for (let lv = pageStart; lv <= pageEnd; lv++) {
      const unlocked = lv <= (save.highestUnlockedLevel || 1);
      const stars = save.levelStars?.[lv] || 0;
      const isBoss = lv % 25 === 0 || lv === kingdom.endLevel;
      const isMiniBoss = !isBoss && lv % 10 === 0;
      const isCurrent = lv === (save.currentLevel || 1);

      const starStr = stars > 0 ? '★'.repeat(stars) : '';
      const roleIcon = isBoss ? '♛' : isMiniBoss ? '⚔' : '';
      gridButtons.push(`
        <button data-launch-level="${lv}" ${unlocked ? '' : 'disabled'}
          title="Level ${lv} · ${kingdom.name}${isBoss ? ` · Boss: ${kingdom.bossName}` : ''}"
          class="${
            isCurrent
              ? 'bg-[#c4a25e]/25 border-[#e6cb8b] text-white'
              : unlocked
                ? 'bg-slate-900/90 border-white/15 hover:border-[#c4a25e]/70 text-slate-100'
                : 'bg-slate-950/70 border-white/5 text-slate-600 cursor-not-allowed'
          } border rounded-lg px-2 py-2 flex flex-col items-center justify-center min-h-[54px] transition-colors">
          <div class="flex items-center gap-1 font-mono-num text-xs font-bold">
            <span>${lv}</span>
            ${roleIcon ? `<span class="text-[10px] ${isBoss ? 'text-amber-300' : 'text-teal-300'}">${roleIcon}</span>` : ''}
          </div>
          <div class="text-[10px] leading-tight mt-0.5 ${stars > 0 ? 'text-amber-300' : 'text-slate-500'}">
            ${unlocked ? (starStr || 'Ready') : 'Locked'}
          </div>
        </button>
      `);
    }

    const diffTier = getDifficultyTierForLevel(pageStart);

    return `
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-5 z-40">
        <div class="nf-panel rounded-xl p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] flex flex-col gap-3.5 overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="font-display text-lg sm:text-xl text-[#e6cb8b] font-bold">Main Campaign — 1000 Levels</h2>
              <p class="text-xs text-slate-400">Unlocked: ${save.highestUnlockedLevel || 1} / 1000 · Boss stages marked ♛ · Mini-boss ⚔</p>
            </div>
            <div class="flex items-center gap-2">
              <form id="jump-level-form" class="flex items-center gap-1.5">
                <input id="jump-level-input" type="number" min="1" max="1000" value="${save.currentLevel || 1}"
                  aria-label="Jump to level number"
                  class="w-20 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono-num text-white focus:outline-none focus:border-[#c4a25e]" />
                <button type="submit" class="nf-btn-secondary px-2.5 py-1 rounded text-xs font-semibold">Go</button>
              </form>
              <button data-close-modal class="nf-btn-secondary px-3 py-1.5 rounded text-xs font-semibold">Close</button>
            </div>
          </div>

          ${
            this.modalNotice
              ? `<div class="text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded px-3 py-1.5">${this.modalNotice}</div>`
              : ''
          }

          <!-- 7 Kingdom Filter Tabs -->
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            ${KINGDOM_DEFINITIONS.map((k, idx) => {
              const active = idx === this.selectedKingdomIdx;
              const kUnlocked = (save.highestUnlockedLevel || 1) >= k.startLevel;
              return `
                <button data-kingdom-tab="${idx}"
                  class="${
                    active
                      ? 'bg-[#c4a25e] text-[#0b0d14] border-[#e6cb8b]'
                      : 'bg-slate-900/80 text-slate-200 border-white/10 hover:border-[#c4a25e]/50'
                  } border rounded-md px-2 py-1.5 text-left transition-colors">
                  <div class="text-[11px] font-bold truncate">${k.order}. ${k.name}</div>
                  <div class="text-[10px] font-mono-num opacity-80">${k.startLevel}–${k.endLevel}${kUnlocked ? '' : ' 🔒'}</div>
                </button>
              `;
            }).join('')}
          </div>

          <!-- Active Kingdom Info + Page Tabs -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-y border-white/10 py-2">
            <div class="text-xs">
              <span class="font-display font-bold text-white">${kingdom.name}</span>
              <span class="text-slate-400"> · ${kingdom.subtitle} · Boss: ${kingdom.bossName} · ${diffTier.label}</span>
            </div>
            <div class="flex items-center gap-1.5">${pagesHtml}</div>
          </div>

          <!-- 50-level Grid -->
          <div class="overflow-y-auto pr-1 grid grid-cols-5 sm:grid-cols-10 gap-2">
            ${gridButtons.join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderBonusWorldsModal(save) {
    return `
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-5 z-40">
        <div class="nf-panel rounded-xl p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] flex flex-col gap-3.5 overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="font-display text-lg sm:text-xl text-[#e6cb8b] font-bold">15 Bonus Worlds</h2>
              <p class="text-xs text-slate-400">Separate themed realms outside the 1000-level campaign · Your Gems: <span class="font-mono-num text-amber-300 font-bold">${save.totalGems || 0}</span></p>
            </div>
            <button data-close-modal class="nf-btn-secondary px-3 py-1.5 rounded text-xs font-semibold">Close</button>
          </div>

          ${
            this.modalNotice
              ? `<div class="text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded px-3 py-1.5">${this.modalNotice}</div>`
              : ''
          }

          <div class="overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${BONUS_WORLDS.map((bw) => {
              const unlocked = isBonusWorldUnlocked(bw, save);
              const cleared = (save.completedBonusWorlds || []).includes(bw.id);
              const canAffordGems = (save.totalGems || 0) >= bw.requiredGems;
              return `
                <div class="bg-slate-950/85 border ${
                  unlocked ? 'border-[#c4a25e]/40' : 'border-white/10'
                } rounded-lg p-3.5 flex flex-col justify-between gap-2.5">
                  <div>
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <span class="font-display text-sm font-bold text-white">${bw.order}. ${bw.name}</span>
                      <span class="text-[11px] font-semibold ${
                        cleared ? 'text-teal-300' : unlocked ? 'text-[#e6cb8b]' : 'text-slate-500'
                      }">${cleared ? 'Cleared' : unlocked ? 'Unlocked' : 'Locked'}</span>
                    </div>
                    <div class="text-xs font-medium" style="color:${bw.palette.accent}">${bw.subtitle}</div>
                    <div class="text-[11px] text-slate-300 mt-1.5">${bw.missionLabel}</div>
                    ${
                      bw.bossName
                        ? `<div class="text-[11px] text-slate-400 mt-1">Boss: ${bw.bossName}</div>`
                        : `<div class="text-[11px] text-slate-400 mt-1">Peaceful Exploration Stage</div>`
                    }
                  </div>
                  <div class="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <span class="text-[10px] text-slate-400">${bw.unlockRequirementText}</span>
                    ${
                      unlocked
                        ? `<button data-launch-bonus="${bw.id}" class="nf-btn-primary px-3 py-1.5 rounded text-xs font-bold shrink-0">Enter World</button>`
                        : `<button data-unlock-bonus="${bw.id}" ${canAffordGems ? '' : 'disabled'}
                            class="nf-btn-secondary px-2.5 py-1.5 rounded text-xs font-semibold shrink-0">
                            Unlock (${bw.requiredGems} Gem${bw.requiredGems === 1 ? '' : 's'})
                           </button>`
                    }
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderArmoryModal(save) {
    const stats = getPlayerUpgradedStats(save);
    const nextXp = xpRequiredForPlayerLevel(stats.playerLevel);
    const xpPct = Math.min(100, Math.round(((save.xp || 0) / nextXp) * 100));

    return `
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-5 z-40">
        <div class="nf-panel rounded-xl p-4 sm:p-6 max-w-3xl w-full max-h-[90vh] flex flex-col gap-4 overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="font-display text-lg sm:text-xl text-[#e6cb8b] font-bold">Nightwalker Armory & Chronicle</h2>
              <p class="text-xs text-slate-300 font-mono-num">
                Kael Lv.${stats.playerLevel} (${save.xp || 0}/${nextXp} XP) · Coins: <span class="text-amber-300">${save.coins || 0}</span> · Gems: <span class="text-sky-300">${save.totalGems || 0}</span>
              </p>
            </div>
            <button data-close-modal class="nf-btn-secondary px-3 py-1.5 rounded text-xs font-semibold">Close</button>
          </div>

          <div class="w-full h-2 bg-black/60 rounded overflow-hidden border border-white/10">
            <div class="h-full bg-[#c4a25e]" style="width:${xpPct}%"></div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-black/40 border border-white/10 rounded-lg p-3">
            <div><span class="text-slate-400">Max HP:</span> <strong class="font-mono-num text-white">${stats.maxHealth}</strong></div>
            <div><span class="text-slate-400">Shadow Energy:</span> <strong class="font-mono-num text-white">${stats.maxEnergy}</strong></div>
            <div><span class="text-slate-400">Nightfang ATK:</span> <strong class="font-mono-num text-white">${stats.baseDamage}</strong></div>
            <div><span class="text-slate-400">Vision Crit:</span> <strong class="font-mono-num text-teal-300">+${Math.round(stats.critBonus * 100)}%</strong></div>
          </div>

          ${
            this.modalNotice
              ? `<div class="text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded px-3 py-1.5">${this.modalNotice}</div>`
              : ''
          }

          <div class="overflow-y-auto pr-1 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${UPGRADE_CATALOG.map((u) => {
                const tier = save.upgrades?.[u.id] || 1;
                const cost = getUpgradeCost(u.id, tier);
                const canBuy =
                  cost && (save.coins || 0) >= cost.coins && (save.totalGems || 0) >= cost.gems;
                return `
                  <div class="bg-slate-950/85 border border-white/15 rounded-lg p-3.5 flex flex-col justify-between gap-2">
                    <div>
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-display text-sm font-bold text-white">${u.name}</span>
                        <span class="font-mono-num text-xs text-[#e6cb8b]">Tier ${tier}/${u.maxLevel}</span>
                      </div>
                      <p class="text-xs text-slate-400 mt-1">${u.description}</p>
                    </div>
                    <div class="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      ${
                        cost
                          ? `<span class="text-[11px] font-mono-num text-slate-300">${cost.coins} Coins${cost.gems ? ` + ${cost.gems} Gem` : ''}</span>
                             <button data-buy-upgrade="${u.id}" ${canBuy ? '' : 'disabled'}
                               class="nf-btn-primary px-3 py-1 rounded text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                               Upgrade
                             </button>`
                          : `<span class="text-xs text-teal-300 font-semibold">Maxed Out</span>`
                      }
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div>
              <h3 class="font-display text-sm font-bold text-[#e6cb8b] mb-2">Achievements (${(save.achievements || []).length}/${ACHIEVEMENTS.length})</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${ACHIEVEMENTS.map((a) => {
                  const unlocked = (save.achievements || []).includes(a.id);
                  return `
                    <div class="border ${
                      unlocked ? 'border-teal-400/40 bg-teal-950/20' : 'border-white/10 bg-black/30 opacity-60'
                    } rounded-md px-3 py-2 flex items-center justify-between gap-2">
                      <div>
                        <div class="text-xs font-bold ${unlocked ? 'text-teal-300' : 'text-slate-300'}">${a.name}</div>
                        <div class="text-[11px] text-slate-400">${a.description}</div>
                      </div>
                      <span class="text-[11px] font-semibold ${unlocked ? 'text-teal-300' : 'text-slate-500'}">
                        ${unlocked ? 'Earned' : 'Locked'}
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderMenu() {
    if (!this.overlay) return;
    const save = saveSystem.load();
    const hasContinue = saveSystem.hasContinueData();
    const isNight = save.settings.dayNightMode !== 'day';
    const currentLv = save.currentLevel || 1;

    let modalHtml = '';
    if (this.activeSubModal === 'levels') {
      modalHtml = this.renderLevelsModal(save);
    } else if (this.activeSubModal === 'bonus') {
      modalHtml = this.renderBonusWorldsModal(save);
    } else if (this.activeSubModal === 'armory') {
      modalHtml = this.renderArmoryModal(save);
    } else if (this.activeSubModal === 'settings') {
      modalHtml = `
        <div class="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-40">
          <div class="nf-panel rounded-xl p-6 max-w-md w-full">
            <div class="flex items-center justify-between mb-5">
              <h2 class="font-display text-xl text-[#e6cb8b] font-bold">Settings</h2>
              <button data-close-modal class="nf-btn-secondary px-3 py-1.5 rounded text-xs font-semibold">Close</button>
            </div>
            <div class="space-y-4 text-sm">
              <div class="flex items-center justify-between">
                <span>Starting Time of Day</span>
                <button data-toggle-time class="nf-btn-secondary px-3 py-1.5 rounded text-xs font-semibold">
                  ${isNight ? 'Night Mode' : 'Day Mode'}
                </button>
              </div>
              <div class="flex items-center justify-between">
                <span>Sound Effects & Ambience</span>
                <button data-toggle-mute class="nf-btn-secondary px-3 py-1.5 rounded text-xs font-semibold">
                  ${save.settings.muted ? 'Muted' : 'Enabled'}
                </button>
              </div>
              <div class="flex items-center justify-between gap-4">
                <label for="vol-slider">Master Volume</label>
                <input id="vol-slider" type="range" min="0" max="100" value="${Math.round(save.settings.volume * 100)}"
                  class="w-36 accent-[#c4a25e]" />
              </div>
              <div class="flex items-center justify-between">
                <span>Touch Controls</span>
                <button data-cycle-touch class="nf-btn-secondary px-3 py-1.5 rounded text-xs font-semibold">
                  ${save.settings.touchControls === 'always' ? 'Always On' : save.settings.touchControls === 'off' ? 'Off' : 'Auto (Mobile)'}
                </button>
              </div>
              <div class="pt-3 border-t border-white/10 flex items-center justify-between">
                <span class="text-slate-400 text-xs">Shards: ${save.totalShards} · Gems: ${save.totalGems} · Best: ${save.bestScore}</span>
                <button data-ask-reset class="px-3 py-1.5 rounded text-xs font-semibold bg-rose-900/60 border border-rose-500/40 text-rose-200 hover:bg-rose-800/70">
                  Reset Save
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (this.activeSubModal === 'confirmReset') {
      modalHtml = `
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div class="nf-panel rounded-xl p-6 max-w-sm w-full">
            <h2 class="font-display text-lg text-rose-300 font-bold mb-2">Confirm Reset Save</h2>
            <p class="text-sm text-slate-300 mb-5">This will erase all 1000-level campaign progress, bonus world unlocks, upgrades, and best score. This cannot be undone.</p>
            <div class="flex items-center justify-end gap-2.5">
              <button data-cancel-reset class="nf-btn-secondary px-4 py-2 rounded text-xs font-semibold">Cancel</button>
              <button data-confirm-reset class="px-4 py-2 rounded text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500">Reset Progress</button>
            </div>
          </div>
        </div>
      `;
    } else if (this.activeSubModal === 'credits') {
      modalHtml = `
        <div class="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-40">
          <div class="nf-panel rounded-xl p-6 max-w-md w-full">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-display text-xl text-[#e6cb8b] font-bold">Credits</h2>
              <button data-close-modal class="nf-btn-secondary px-3 py-1.5 rounded text-xs font-semibold">Close</button>
            </div>
            <div class="space-y-3 text-sm text-slate-300">
              <p><strong class="text-white">NIGHTFALL LEGENDS</strong> — 2D Dark Fantasy Action Adventure</p>
              <p>Protagonist: Kael, The Last Nightwalker · Blade: Nightfang</p>
              <p>1000 Campaign Levels across 7 Kingdoms + 15 Separate Bonus Worlds</p>
              <p>Engine: Phaser 3 · HTML5 Canvas · Procedural Web Audio Synth</p>
              <p class="text-xs text-slate-400">Built for PC Keyboard and Android Touch Controls.</p>
            </div>
          </div>
        </div>
      `;
    }

    this.overlay.innerHTML = `
      <!-- Top Row: Flat stats & Day/Night toggle -->
      <div class="flex items-center justify-between gap-4">
        <div class="text-xs text-slate-300 font-mono-num tracking-wide hidden sm:block">
          Kael Lv.${save.playerLevel || 1} · Progress ${save.highestUnlockedLevel || 1}/1000 · Coins ${save.coins || 0} · Gems ${save.totalGems || 0}
        </div>
        <button data-quick-daynight class="nf-btn-secondary px-3.5 py-2 rounded-md text-xs font-semibold ml-auto">
          Cycle: ${isNight ? 'Night Start' : 'Day Start'}
        </button>
      </div>

      <!-- Left Third Complementary Region: Bespoke SVG Lockup & Menu Actions -->
      <div class="max-w-lg my-auto">
        <svg viewBox="0 0 460 118" class="w-full max-w-[430px] mb-2" role="img" aria-label="NIGHTFALL LEGENDS">
          <defs>
            <linearGradient id="nfGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f5e3b3"/>
              <stop offset="55%" stop-color="#c4a25e"/>
              <stop offset="100%" stop-color="#8b6b32"/>
            </linearGradient>
          </defs>
          <path d="M38 14 A22 22 0 1 0 56 48 A16 16 0 1 1 38 14 Z" fill="#38f2d2" opacity="0.9"/>
          <path d="M44 10 L48 56 L44 64 L40 56 Z" fill="#e2e8f0"/>
          <rect x="35" y="50" width="18" height="3.5" rx="1" fill="#c4a25e"/>
          <text x="78" y="48" font-family="Cinzel, Georgia, serif" font-size="38" font-weight="800" letter-spacing="3" fill="url(#nfGold)">NIGHTFALL</text>
          <text x="80" y="84" font-family="Cinzel, Georgia, serif" font-size="28" font-weight="700" letter-spacing="6" fill="#eae6dc">LEGENDS</text>
          <line x1="80" y1="96" x2="355" y2="96" stroke="#c4a25e" stroke-opacity="0.45" stroke-width="1.5"/>
        </svg>

        <p class="text-sm text-slate-300 mb-6 tracking-wide">When the Sun Falls, Legends Awaken. · 7 Kingdoms · 1000 Levels · 15 Bonus Worlds</p>

        <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2.5 max-w-md">
          <button data-start="true" data-action="new-game"
            class="nf-btn-primary px-6 py-3 rounded-md text-sm font-bold tracking-wide col-span-2 sm:col-span-1">
            ${hasContinue ? `Play Lv. ${currentLv}` : 'New Game'}
          </button>
          <button data-action="continue" ${hasContinue ? '' : 'disabled'}
            class="nf-btn-secondary px-4 py-3 rounded-md text-sm font-semibold">
            Continue
          </button>
          <button data-action="levels"
            class="nf-btn-secondary px-4 py-3 rounded-md text-sm font-semibold">
            1000 Levels
          </button>
          <button data-action="bonus"
            class="nf-btn-secondary px-4 py-3 rounded-md text-sm font-semibold">
            15 Bonus Worlds
          </button>
          <button data-action="armory"
            class="nf-btn-secondary px-4 py-3 rounded-md text-sm font-semibold">
            Armory
          </button>
          <button data-action="settings"
            class="nf-btn-secondary px-4 py-3 rounded-md text-sm font-semibold">
            Settings
          </button>
          <button data-action="credits"
            class="nf-btn-secondary px-4 py-3 rounded-md text-sm font-semibold">
            Credits
          </button>
        </div>
      </div>

      <!-- Bottom Safe Margin: Single Flat Control Hint Line -->
      <div class="text-xs text-slate-400 tracking-wide">
        A/D Move · W/S Climb · Space Jump · J Attack · Shift Dash · K/2–5 Abilities · E Interact · T Day/Night · Esc Pause
      </div>

      ${modalHtml}
    `;

    // Main Menu action bindings
    this.overlay.querySelector('[data-action="new-game"]')?.addEventListener('click', () => {
      if (hasContinue) this.launchCampaignLevel(currentLv, false);
      else this.launchCampaignLevel(1, false);
    });
    this.overlay.querySelector('[data-action="continue"]')?.addEventListener('click', () => this.continueGame());
    this.overlay.querySelector('[data-action="levels"]')?.addEventListener('click', () => {
      this.activeSubModal = 'levels';
      this.modalNotice = '';
      this.renderMenu();
    });
    this.overlay.querySelector('[data-action="bonus"]')?.addEventListener('click', () => {
      this.activeSubModal = 'bonus';
      this.modalNotice = '';
      this.renderMenu();
    });
    this.overlay.querySelector('[data-action="armory"]')?.addEventListener('click', () => {
      this.activeSubModal = 'armory';
      this.modalNotice = '';
      this.renderMenu();
    });
    this.overlay.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
      this.activeSubModal = 'settings';
      this.modalNotice = '';
      this.renderMenu();
    });
    this.overlay.querySelector('[data-action="credits"]')?.addEventListener('click', () => {
      this.activeSubModal = 'credits';
      this.modalNotice = '';
      this.renderMenu();
    });
    this.overlay.querySelector('[data-quick-daynight]')?.addEventListener('click', () => {
      const next = isNight ? 'day' : 'night';
      saveSystem.updateSettings({ dayNightMode: next });
      this.dayNightCycle.setTargetMode(next);
      this.renderMenu();
    });

    // Modal shared close
    this.overlay.querySelector('[data-close-modal]')?.addEventListener('click', () => {
      this.activeSubModal = null;
      this.modalNotice = '';
      this.renderMenu();
    });

    // 1000 Levels modal bindings
    this.overlay.querySelectorAll('[data-kingdom-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedKingdomIdx = Number(btn.dataset.kingdomTab) || 0;
        this.selectedLevelPage = 0;
        this.modalNotice = '';
        this.renderMenu();
      });
    });
    this.overlay.querySelectorAll('[data-level-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedLevelPage = Number(btn.dataset.levelPage) || 0;
        this.renderMenu();
      });
    });
    this.overlay.querySelectorAll('[data-launch-level]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lv = Number(btn.dataset.launchLevel);
        this.launchCampaignLevel(lv, false);
      });
    });
    this.overlay.querySelector('#jump-level-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = this.overlay.querySelector('#jump-level-input');
      const requested = Math.max(1, Math.min(1000, Math.round(Number(input?.value) || 1)));
      const info = getKingdomForLevel(requested);
      this.selectedKingdomIdx = Math.max(0, info.kingdom.order - 1);
      this.selectedLevelPage = Math.floor((info.localIndex - 1) / 50);
      if (requested <= (save.highestUnlockedLevel || 1)) {
        this.launchCampaignLevel(requested, false);
      } else {
        this.modalNotice = `Level ${requested} is locked (${info.kingdom.name}). Highest unlocked: Level ${save.highestUnlockedLevel || 1}.`;
        this.renderMenu();
      }
    });

    // 15 Bonus Worlds bindings
    this.overlay.querySelectorAll('[data-launch-bonus]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.launchBonusWorld(btn.dataset.launchBonus);
      });
    });
    this.overlay.querySelectorAll('[data-unlock-bonus]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bw = getBonusWorldById(btn.dataset.unlockBonus);
        const res = saveSystem.unlockBonusWorldWithGems(bw.id, bw.requiredGems);
        if (res.ok) {
          audioSystem.playPickup('gem');
          this.modalNotice = `${bw.name} unlocked!`;
        } else {
          this.modalNotice = `Need ${bw.requiredGems} Gems to unlock ${bw.name}.`;
        }
        this.renderMenu();
      });
    });

    // Armory Upgrade bindings
    this.overlay.querySelectorAll('[data-buy-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const currentSave = saveSystem.load();
        const res = purchaseUpgrade(currentSave, btn.dataset.buyUpgrade);
        if (res.ok) {
          saveSystem.save(res.saveData);
          audioSystem.playPickup('gem');
          this.modalNotice = 'Upgrade forged successfully!';
        } else {
          this.modalNotice =
            res.reason === 'gems' ? 'Not enough Shadow Gems for this tier.' : 'Not enough Coins for this upgrade.';
        }
        this.renderMenu();
      });
    });

    // Settings & Reset bindings
    this.overlay.querySelector('[data-toggle-time]')?.addEventListener('click', () => {
      const next = isNight ? 'day' : 'night';
      saveSystem.updateSettings({ dayNightMode: next });
      this.dayNightCycle.setTargetMode(next);
      this.renderMenu();
    });
    this.overlay.querySelector('[data-toggle-mute]')?.addEventListener('click', () => {
      const nextMuted = !save.settings.muted;
      audioSystem.setMuted(nextMuted);
      saveSystem.updateSettings({ muted: nextMuted });
      this.renderMenu();
    });
    this.overlay.querySelector('#vol-slider')?.addEventListener('input', (e) => {
      const vol = Number(e.target.value) / 100;
      audioSystem.setVolume(vol);
      saveSystem.updateSettings({ volume: vol });
    });
    this.overlay.querySelector('[data-cycle-touch]')?.addEventListener('click', () => {
      const order = ['auto', 'always', 'off'];
      const next = order[(order.indexOf(save.settings.touchControls) + 1) % order.length];
      saveSystem.updateSettings({ touchControls: next });
      this.renderMenu();
    });
    this.overlay.querySelector('[data-ask-reset]')?.addEventListener('click', () => {
      this.activeSubModal = 'confirmReset';
      this.renderMenu();
    });
    this.overlay.querySelector('[data-cancel-reset]')?.addEventListener('click', () => {
      this.activeSubModal = 'settings';
      this.renderMenu();
    });
    this.overlay.querySelector('[data-confirm-reset]')?.addEventListener('click', () => {
      saveSystem.reset();
      this.selectedKingdomIdx = 0;
      this.selectedLevelPage = 0;
      this.activeSubModal = null;
      this.modalNotice = '';
      this.renderMenu();
    });
  }
}

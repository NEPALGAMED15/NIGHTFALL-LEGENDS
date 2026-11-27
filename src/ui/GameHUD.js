import { ABILITIES } from '../config.js';

export class GameHUD {
  constructor(rootEl, callbacks) {
    this.rootEl = rootEl;
    this.callbacks = callbacks;
    this.container = null;
    this.ghostHp = 100;
    this.refs = {};
  }

  mount({
    kingdomName,
    levelLabel = 'Level 1',
    difficultyLabel = 'EASY',
    difficultyColor = '#2dd4bf',
    playerLevel = 1,
    objectiveText = '',
  }) {
    this.unmount();
    const wrap = document.createElement('div');
    wrap.id = 'game-hud';
    wrap.className = 'absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-3 md:p-4 z-20';

    wrap.innerHTML = `
      <!-- Top Bar (3 compact perimeter clusters) -->
      <div class="flex items-start justify-between gap-1.5 sm:gap-3 w-full">
        <!-- Top-Left: Kael Vitality & Energy -->
        <div class="nf-panel px-2 py-1.5 sm:px-3.5 sm:py-2.5 rounded-lg w-[168px] sm:w-auto sm:min-w-[240px] sm:max-w-[290px] shrink-0">
          <div class="flex items-center justify-between gap-1 mb-1">
            <div class="flex items-center gap-1 shrink-0">
              <span class="font-display text-[11px] sm:text-xs tracking-wider text-[#e6cb8b] font-bold">KAEL</span>
              <span class="font-mono-num text-[10px] text-teal-300 font-bold">Lv.${playerLevel}</span>
            </div>
            <span data-ref="kingdomLabel" class="text-[10px] sm:text-[11px] text-slate-300 truncate">${levelLabel} · ${kingdomName}</span>
          </div>
          <!-- HP Bar with Ghost Trail -->
          <div class="mb-1">
            <div class="flex items-center justify-between text-[10px] sm:text-[11px] mb-0.5">
              <span class="text-slate-400 font-semibold tracking-wider">HP</span>
              <span data-ref="hpText" class="font-mono-num text-[10px] sm:text-xs text-white font-bold">100 / 100</span>
            </div>
            <div class="relative h-2 sm:h-2.5 bg-black/70 rounded overflow-hidden border border-white/10">
              <div data-ref="hpGhost" class="absolute inset-y-0 left-0 bg-rose-300/60 transition-[width] duration-300" style="width: 100%"></div>
              <div data-ref="hpFill" class="absolute inset-y-0 left-0 bg-rose-600" style="width: 100%"></div>
            </div>
          </div>
          <!-- Energy Bar -->
          <div>
            <div class="flex items-center justify-between text-[10px] sm:text-[11px] mb-0.5">
              <span class="text-slate-400 font-semibold tracking-wider">EN</span>
              <span data-ref="energyText" class="font-mono-num text-[10px] sm:text-[11px] text-sky-300 font-bold">100 / 100</span>
            </div>
            <div class="relative h-1.5 sm:h-2 bg-black/70 rounded overflow-hidden border border-white/10">
              <div data-ref="energyFill" class="absolute inset-y-0 left-0 bg-sky-400" style="width: 100%"></div>
            </div>
          </div>
          <!-- Cycle & Difficulty Status -->
          <div class="mt-1 pt-1 border-t border-white/10 flex items-center justify-between gap-1 text-[9px] sm:text-[11px] text-slate-300">
            <span data-ref="cyclePeriod" class="font-medium text-teal-300 truncate">Night Mode</span>
            <span class="font-mono-num font-bold shrink-0" style="color:${difficultyColor}">${difficultyLabel}</span>
            <span data-ref="detectHint" class="font-mono-num text-slate-400 shrink-0">70% Sight</span>
          </div>
        </div>

        <!-- Top-Center (Desktop/Tablet): Objective Banner & Boss Bar -->
        <div class="hidden md:flex flex-col items-center gap-1.5 flex-1 mx-auto max-w-[440px] min-w-0">
          ${
            objectiveText
              ? `<div data-ref="objectiveBar" class="nf-panel px-3 py-1 rounded text-[11px] text-slate-200 tracking-wide truncate max-w-full">
                  <span class="text-[#e6cb8b] font-semibold mr-1">Goal:</span><span data-ref="objectiveText">${objectiveText}</span>
                 </div>`
              : ''
          }
        </div>

        <!-- Top-Right: Collectibles, Score & Utility Controls -->
        <div class="flex flex-col items-end gap-1 sm:gap-1.5 shrink-0 max-w-[186px] sm:max-w-none">
          <div class="nf-panel px-2 sm:px-3 py-1 sm:py-2 rounded-lg flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs">
            <div class="flex items-center gap-1" title="Moon Shards">
              <span class="inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rotate-45 bg-sky-400"></span>
              <span data-ref="shardsText" class="font-mono-num font-bold text-white">0</span>
            </div>
            <span class="text-slate-600">·</span>
            <div class="flex items-center gap-1" title="Soul Gems">
              <span class="inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-xs bg-purple-400"></span>
              <span data-ref="gemsText" class="font-mono-num font-bold text-white">0</span>
            </div>
            <span class="text-slate-600">·</span>
            <div class="flex items-center gap-1">
              <span class="hidden sm:inline text-slate-400">SCORE</span>
              <span data-ref="scoreText" class="font-mono-num font-bold text-[#e6cb8b]">0</span>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:flex sm:flex-wrap justify-end items-center gap-1 sm:gap-1.5 pointer-events-auto">
            <button data-action="toggle-daynight" tabindex="-1" aria-label="Toggle Day or Night Mode"
              class="nf-btn-secondary px-2 sm:px-2.5 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-medium flex items-center justify-center gap-1">
              <span data-ref="dayNightBtnLabel">Night</span>
              <span class="hidden sm:inline text-[10px] text-slate-400">[T]</span>
            </button>
            <button data-action="toggle-mute" tabindex="-1" aria-label="Toggle Audio Mute"
              class="nf-btn-secondary px-2 sm:px-2.5 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-medium text-center">
              <span data-ref="muteLabel">Sound</span>
            </button>
            <button data-action="toggle-fullscreen" tabindex="-1" aria-label="Toggle Fullscreen Landscape"
              class="nf-btn-secondary px-2 sm:px-2.5 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-medium text-center">
              Full
            </button>
            <button data-action="pause" tabindex="-1" aria-label="Pause Game"
              class="nf-btn-secondary px-2 sm:px-2.5 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-medium text-center">
              Pause
            </button>
          </div>
        </div>
      </div>

      <!-- Secondary Top Center Row: Portrait Tip & Boss Health Bar (never crowds top corners) -->
      <div class="flex flex-col items-center gap-1.5 w-full mt-1">
        <div data-ref="portraitHint" class="hidden nf-panel px-2.5 py-1 rounded text-[10px] text-amber-200 border border-[#c4a25e]/40 text-center">
          Rotate to Landscape or tap Full
        </div>
        <div data-ref="bossWrap" class="hidden nf-panel px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg min-w-[200px] sm:min-w-[320px] max-w-[420px] w-full">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span data-ref="bossName" class="font-display text-xs sm:text-sm text-[#e6cb8b] font-bold tracking-wide">Root Warden</span>
            <span data-ref="bossPhase" class="text-[11px] font-semibold text-rose-300">Phase I</span>
          </div>
          <div class="relative h-2 sm:h-2.5 bg-black/75 rounded overflow-hidden border border-rose-400/30">
            <div data-ref="bossFill" class="absolute inset-y-0 left-0 bg-rose-600 transition-[width] duration-150" style="width: 100%"></div>
          </div>
          <div class="text-right mt-0.5">
            <span data-ref="bossHpText" class="font-mono-num text-[10px] sm:text-[11px] text-slate-300">420 / 420</span>
          </div>
        </div>
      </div>

      <!-- Bottom Area: Interaction Prompt & 5 Ability Slots -->
      <div class="flex flex-col items-center gap-2 mb-1">
        <div data-ref="interactPrompt" class="hidden nf-panel px-4 py-1.5 rounded text-xs font-medium text-[#e6cb8b] border border-[#c4a25e]/50">
          Press E to Interact
        </div>

        <div data-ref="desktopAbilities" class="hidden items-center gap-2 pointer-events-auto">
          ${ABILITIES.map(
            (ab) => `
            <button data-ability="${ab.id}" tabindex="-1" aria-label="${ab.name}: ${ab.role}"
              title="${ab.name} (${ab.energyCost} EN) — ${ab.role}"
              class="nf-panel px-2.5 py-1.5 rounded-md flex flex-col items-center min-w-[82px] border border-white/15 hover:border-[#e6cb8b] transition-colors relative overflow-hidden">
              <div data-cd-overlay="${ab.id}" class="absolute inset-0 bg-black/70 origin-bottom hidden"></div>
              <div class="relative z-10 flex items-center justify-between w-full text-[10px] text-slate-400 mb-0.5">
                <span class="font-mono-num font-bold text-[#e6cb8b]">[${ab.key}]</span>
                <span class="font-mono-num">${ab.energyCost} EN</span>
              </div>
              <div class="relative z-10 text-[11px] font-semibold text-white whitespace-nowrap">${ab.shortLabel}</div>
              <div data-cd-text="${ab.id}" class="relative z-10 font-mono-num text-[10px] text-teal-300 h-3">Ready</div>
            </button>
          `
          ).join('')}
        </div>
      </div>
    `;

    this.rootEl.appendChild(wrap);
    this.container = wrap;

    wrap.querySelectorAll('[data-ref]').forEach((el) => {
      this.refs[el.dataset.ref] = el;
    });

    wrap.querySelector('[data-action="toggle-daynight"]')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.callbacks.onToggleDayNight?.();
    });
    wrap.querySelector('[data-action="toggle-mute"]')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.callbacks.onToggleMute?.();
    });
    wrap.querySelector('[data-action="toggle-fullscreen"]')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.callbacks.onToggleFullscreen?.();
    });
    wrap.querySelector('[data-action="pause"]')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.callbacks.onPause?.();
    });
    wrap.querySelectorAll('[data-ability]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.currentTarget.blur();
        this.callbacks.onTriggerAbility?.(btn.dataset.ability);
      });
    });
  }

  setOrientationHint(isPortrait, showTouch = false) {
    if (this.refs?.portraitHint) {
      const isNarrowTouch = typeof window !== 'undefined' && window.innerWidth <= 640;
      if (isPortrait && isNarrowTouch) {
        this.refs.portraitHint.classList.remove('hidden');
      } else {
        this.refs.portraitHint.classList.add('hidden');
      }
    }
    if (this.refs?.desktopAbilities) {
      const shortLandscape = typeof window !== 'undefined' && window.innerHeight <= 540;
      if (showTouch || shortLandscape) {
        this.refs.desktopAbilities.classList.add('hidden');
        this.refs.desktopAbilities.classList.remove('md:flex');
      } else {
        this.refs.desktopAbilities.classList.remove('hidden');
        this.refs.desktopAbilities.classList.add('md:flex');
      }
    }
  }

  update({ player, boss, stats, cycleState, muted, interactLabel }) {
    if (!this.container || !player) return;

    const hp = Math.max(0, Math.round(player.health));
    const maxHp = Math.round(player.maxHealth);
    const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    this.ghostHp += (hpPct - this.ghostHp) * 0.08;

    this.refs.hpText.textContent = `${hp} / ${maxHp}`;
    this.refs.hpFill.style.width = `${hpPct}%`;
    this.refs.hpGhost.style.width = `${Math.max(hpPct, this.ghostHp)}%`;

    const en = Math.max(0, Math.round(player.energy));
    const maxEn = Math.round(player.maxEnergy);
    this.refs.energyText.textContent = `${en} / ${maxEn}`;
    this.refs.energyFill.style.width = `${(en / maxEn) * 100}%`;

    this.refs.shardsText.textContent = `${stats.shards}`;
    this.refs.gemsText.textContent = `${stats.gems}`;
    this.refs.scoreText.textContent = `${Math.round(stats.score)}`;

    if (cycleState) {
      const stealth = Math.round(cycleState.enemyDetectionMultiplier * 100);
      this.refs.cyclePeriod.textContent = player.nightVisionActive
        ? `${cycleState.period} · Vision Active`
        : `${cycleState.period} Mode`;
      this.refs.detectHint.textContent = `${stealth}% Sight`;
      this.refs.dayNightBtnLabel.textContent = cycleState.isNightDominant ? 'Night' : 'Day';
    }

    this.refs.muteLabel.textContent = muted ? 'Muted' : 'Sound';

    if (interactLabel) {
      this.refs.interactPrompt.textContent = interactLabel;
      this.refs.interactPrompt.classList.remove('hidden');
    } else {
      this.refs.interactPrompt.classList.add('hidden');
    }

    if (boss && boss.active && !boss.isDefeated) {
      this.refs.bossWrap.classList.remove('hidden');
      this.refs.bossName.textContent = boss.cfg?.name || boss.kingdom.bossName;
      this.refs.bossPhase.textContent = boss.phase === 2 ? 'Phase II · Enraged' : 'Phase I';
      const bPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      this.refs.bossFill.style.width = `${bPct}%`;
      this.refs.bossHpText.textContent = `${Math.max(0, Math.round(boss.hp))} / ${boss.maxHp}`;
    } else {
      this.refs.bossWrap.classList.add('hidden');
    }

    ABILITIES.forEach((ab) => {
      const cd = player.cooldowns[ab.id] || 0;
      const buff = player.activeBuffs[ab.id] || 0;
      const cdTextEl = this.container.querySelector(`[data-cd-text="${ab.id}"]`);
      const cdOverlay = this.container.querySelector(`[data-cd-overlay="${ab.id}"]`);
      if (!cdTextEl || !cdOverlay) return;

      if (buff > 0.05) {
        cdOverlay.classList.add('hidden');
        cdTextEl.textContent = `${buff.toFixed(1)}s On`;
        cdTextEl.className = 'relative z-10 font-mono-num text-[10px] text-amber-300 h-3';
      } else if (cd > 0.05) {
        cdOverlay.classList.remove('hidden');
        cdTextEl.textContent = `${cd.toFixed(1)}s`;
        cdTextEl.className = 'relative z-10 font-mono-num text-[10px] text-slate-400 h-3';
      } else if (player.energy < ab.energyCost) {
        cdOverlay.classList.remove('hidden');
        cdTextEl.textContent = 'Low EN';
        cdTextEl.className = 'relative z-10 font-mono-num text-[10px] text-rose-300 h-3';
      } else {
        cdOverlay.classList.add('hidden');
        cdTextEl.textContent = 'Ready';
        cdTextEl.className = 'relative z-10 font-mono-num text-[10px] text-teal-300 h-3';
      }
    });
  }

  unmount() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.refs = {};
    }
  }
}

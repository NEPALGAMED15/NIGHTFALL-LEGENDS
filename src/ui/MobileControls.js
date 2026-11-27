export class MobileControls {
  constructor(rootEl, callbacks) {
    this.rootEl = rootEl;
    this.callbacks = callbacks;
    this.container = null;
    this.state = {
      left: false,
      right: false,
      up: false,
      jumpJustPressed: false,
      jumpJustReleased: false,
      attackJustPressed: false,
      dashJustPressed: false,
      abilityJustPressed: false,
      interactJustPressed: false,
    };
  }

  shouldShow(mode = 'auto') {
    if (mode === 'always') return true;
    if (mode === 'off') return false;
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const narrow = window.innerWidth <= 900;
    return Boolean(coarse || touchCapable || narrow);
  }

  mount(mode = 'auto') {
    this.unmount();
    if (!this.shouldShow(mode)) return;

    const wrap = document.createElement('div');
    wrap.id = 'mobile-controls';
    wrap.className = 'absolute inset-x-0 bottom-0 pb-2 px-2.5 sm:px-4 flex items-end justify-between pointer-events-none z-30';

    wrap.innerHTML = `
      <!-- Left D-Pad Cluster -->
      <div class="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
        <button data-touch="left" aria-label="Move Left"
          class="nf-touch-btn w-11 h-11 sm:w-13 sm:h-13 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold">
          ◀
        </button>
        <button data-touch="right" aria-label="Move Right"
          class="nf-touch-btn w-11 h-11 sm:w-13 sm:h-13 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold">
          ▶
        </button>
      </div>

      <!-- Center Climb & Interact Controls -->
      <div class="flex items-center gap-1.5 pointer-events-auto mb-0.5">
        <button data-touch="up" aria-label="Climb Ladder"
          class="nf-touch-btn px-2.5 h-10 sm:h-11 rounded-lg text-xs font-semibold text-amber-200">
          ▲
        </button>
        <button data-touch="interact" aria-label="Interact"
          class="nf-touch-btn px-2.5 sm:px-3 h-10 sm:h-11 rounded-lg text-[11px] sm:text-xs font-semibold">
          Interact
        </button>
      </div>

      <!-- Right Action Cluster -->
      <div class="grid grid-cols-2 gap-1.5 pointer-events-auto">
        <button data-touch="ability" aria-label="Special Ability"
          class="nf-touch-btn w-11 h-10 sm:w-12 sm:h-11 rounded-xl text-[11px] sm:text-xs font-semibold text-amber-300">
          Skill
        </button>
        <button data-touch="dash" aria-label="Shadow Dash"
          class="nf-touch-btn w-11 h-10 sm:w-12 sm:h-11 rounded-xl text-[11px] sm:text-xs font-semibold text-sky-300">
          Dash
        </button>
        <button data-touch="attack" aria-label="Sword Attack"
          class="nf-touch-btn w-11 h-11 sm:w-12 sm:h-12 rounded-xl text-[11px] sm:text-xs font-bold text-[#e6cb8b]">
          Slash
        </button>
        <button data-touch="jump" aria-label="Jump"
          class="nf-touch-btn w-11 h-11 sm:w-12 sm:h-12 rounded-xl text-[11px] sm:text-xs font-bold text-teal-300">
          Jump
        </button>
      </div>
    `;

    this.rootEl.appendChild(wrap);
    this.container = wrap;

    const bindHold = (action, key) => {
      const btn = wrap.querySelector(`[data-touch="${action}"]`);
      if (!btn) return;
      const down = (e) => {
        e.preventDefault();
        btn.classList.add('is-pressed');
        this.state[key] = true;
      };
      const up = (e) => {
        e.preventDefault();
        btn.classList.remove('is-pressed');
        this.state[key] = false;
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    };

    const bindTap = (action, edgeKey, releaseKey = null, cb = null) => {
      const btn = wrap.querySelector(`[data-touch="${action}"]`);
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('is-pressed');
        if (edgeKey) this.state[edgeKey] = true;
        cb?.();
      });
      const up = (e) => {
        e.preventDefault();
        btn.classList.remove('is-pressed');
        if (releaseKey) this.state[releaseKey] = true;
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    };

    bindHold('left', 'left');
    bindHold('right', 'right');
    bindHold('up', 'up');
    bindTap('jump', 'jumpJustPressed', 'jumpJustReleased');
    bindTap('attack', 'attackJustPressed');
    bindTap('dash', 'dashJustPressed');
    bindTap('ability', 'abilityJustPressed');
    bindTap('interact', 'interactJustPressed');
    bindTap('pause', null, null, () => this.callbacks.onPause?.());
  }

  consumeSnapshot() {
    const snap = { ...this.state };
    this.state.jumpJustPressed = false;
    this.state.jumpJustReleased = false;
    this.state.attackJustPressed = false;
    this.state.dashJustPressed = false;
    this.state.abilityJustPressed = false;
    this.state.interactJustPressed = false;
    return snap;
  }

  reset() {
    this.state.left = false;
    this.state.right = false;
    this.state.up = false;
    this.consumeSnapshot();
  }

  unmount() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

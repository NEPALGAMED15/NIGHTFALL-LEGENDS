import { buildAtOptionsPayload, resolveAdPlacement } from './AdPlacementPolicy.js';

const SCRIPT_TIMEOUT_MS = 6500;

export class AdManager {
  constructor() {
    this.gameplayActive = false;
    this.adsEnabled = true;
    this.familySafeAllowed = true;
    this.activeKey = null;
    this.activeSlot = 'none';
    this.activeContainerId = null;
    this.failedKeys = new Set();
    this.reservedBottomPx = 0;
    this._queue = Promise.resolve();
    this._mountToken = 0;
    this._observer = null;
    this._onLayoutChange = null;
  }

  setLayoutChangeHandler(fn) {
    this._onLayoutChange = typeof fn === 'function' ? fn : null;
  }

  setAdsEnabled(enabled) {
    this.adsEnabled = Boolean(enabled);
    if (!this.adsEnabled) {
      this.clearAll();
    }
  }

  /**
   * Immediately blocks and tears down all ads whenever gameplay, loading, pause,
   * boss fight, victory, or game-over states are entered.
   */
  setGameplayActive(active) {
    this.gameplayActive = Boolean(active);
    if (this.gameplayActive) {
      this.clearAll();
    }
  }

  getReservedBottomPx() {
    return this.reservedBottomPx;
  }

  getEnvironmentSnapshot(overrides = {}) {
    if (typeof window === 'undefined') {
      return { width: 1280, height: 720, hasTouch: false, userAgent: '', ...overrides };
    }
    const vv = window.visualViewport;
    const width = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1280);
    const height = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 720);
    const hasTouch =
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window ||
      (window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false);
    return {
      width,
      height,
      hasTouch,
      userAgent: navigator.userAgent || '',
      ...overrides,
    };
  }

  /**
   * Evaluates and mounts at most ONE verified ad placement for MenuScene.
   * Returns current layout reservation synchronously so MenuScene never overlaps buttons.
   */
  syncMenuPlacement({ activeSubModal = null, width, height } = {}) {
    if (this.gameplayActive || typeof document === 'undefined') {
      this.clearAll();
      return { slot: 'none', placement: null, reservedBottomPx: 0 };
    }

    const env = this.getEnvironmentSnapshot({
      ...(typeof width === 'number' ? { width } : {}),
      ...(typeof height === 'number' ? { height } : {}),
    });

    const decision = resolveAdPlacement({
      sceneState: document.body?.dataset?.state || 'title',
      activeSubModal,
      width: env.width,
      height: env.height,
      hasTouch: env.hasTouch,
      userAgent: env.userAgent,
      adsEnabled: this.adsEnabled,
      familySafeAllowed: this.familySafeAllowed,
    });

    if (decision.slot === 'none' || !decision.placement || this.failedKeys.has(decision.placement.key)) {
      this.clearAll();
      return { slot: 'none', placement: null, reservedBottomPx: 0 };
    }

    const containerId = decision.slot === 'info' ? 'info-ad-slot' : 'home-ad-dock';
    const container = document.getElementById(containerId);
    if (!container) {
      this.clearAll();
      return { slot: 'none', placement: null, reservedBottomPx: 0 };
    }

    // Prevent duplicate script loading if exact placement is already mounted in the same slot
    if (
      this.activeKey === decision.placement.key &&
      this.activeSlot === decision.slot &&
      this.activeContainerId === containerId &&
      container.querySelector(`script[data-ad-key="${decision.placement.key}"]`)
    ) {
      this.reservedBottomPx = decision.reservedBottomPx;
      this.showDockIfNeeded(decision.slot, decision.placement);
      return decision;
    }

    // Tear down any previous slot before queuing the new placement
    this.teardownContainersExcept(containerId);
    this.activeKey = decision.placement.key;
    this.activeSlot = decision.slot;
    this.activeContainerId = containerId;
    this.reservedBottomPx = decision.reservedBottomPx;

    this.showDockIfNeeded(decision.slot, decision.placement);
    const token = ++this._mountToken;

    // Serialize script loading so window.atOptions is never overwritten concurrently
    this._queue = this._queue
      .catch(() => {})
      .then(() => this._mountPlacementScript(container, decision.placement, token));

    return decision;
  }

  showDockIfNeeded(slot, placement) {
    const homeDock = document.getElementById('home-ad-dock');
    if (!homeDock) return;
    if (slot === 'home' && placement) {
      homeDock.classList.remove('hidden');
      homeDock.style.minHeight = `${placement.height + 12}px`;
      homeDock.dataset.adPlacement = placement.id;
    } else {
      homeDock.classList.add('hidden');
      homeDock.style.minHeight = '';
      delete homeDock.dataset.adPlacement;
    }
  }

  teardownContainersExcept(keepId = null) {
    if (typeof document === 'undefined') return;
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    ['home-ad-dock', 'info-ad-slot'].forEach((id) => {
      if (id === keepId) return;
      const el = document.getElementById(id);
      if (el) {
        el.replaceChildren();
        if (id === 'home-ad-dock') {
          el.classList.add('hidden');
          el.style.minHeight = '';
          delete el.dataset.adPlacement;
        }
      }
    });
  }

  _mountPlacementScript(container, placement, token) {
    return new Promise((resolve) => {
      if (this.gameplayActive || token !== this._mountToken || !container?.isConnected) {
        resolve(false);
        return;
      }

      try {
        container.replaceChildren();

        const frameBox = document.createElement('div');
        frameBox.className = 'nf-ad-frame flex items-center justify-center overflow-hidden mx-auto';
        frameBox.style.width = `${placement.width}px`;
        frameBox.style.maxWidth = '100%';
        frameBox.style.height = `${placement.height}px`;
        frameBox.dataset.adBox = placement.id;

        // Guard against automatic top-window redirects inside injected iframes
        this._observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node.nodeName === 'IFRAME') {
                node.style.maxWidth = '100%';
                node.style.border = '0';
                node.setAttribute('loading', 'lazy');
                node.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                const existingSandbox = node.getAttribute('sandbox');
                if (existingSandbox && existingSandbox.includes('allow-top-navigation')) {
                  node.setAttribute(
                    'sandbox',
                    existingSandbox
                      .replace(/\ballow-top-navigation-by-user-activation\b/g, '')
                      .replace(/\ballow-top-navigation\b/g, '')
                      .trim()
                  );
                }
              }
            }
          }
        });
        this._observer.observe(frameBox, { childList: true, subtree: true });

        container.appendChild(frameBox);

        // Set global window.atOptions immediately before loading this external script
        window.atOptions = buildAtOptionsPayload(placement);

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.dataset.cfasync = 'false';
        script.dataset.adKey = placement.key;
        script.src = placement.src;

        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (!ok && token === this._mountToken) {
            this.handlePlacementFailure(placement.key);
          }
          resolve(ok);
        };

        const timer = setTimeout(() => {
          // If slow network has not inserted any iframe or content, clean up gracefully without blocking
          const hasFrame = Boolean(frameBox.querySelector('iframe'));
          if (!hasFrame) {
            finish(false);
          } else {
            finish(true);
          }
        }, SCRIPT_TIMEOUT_MS);

        script.onload = () => finish(true);
        script.onerror = () => finish(false);

        frameBox.appendChild(script);
      } catch {
        this.handlePlacementFailure(placement.key);
        resolve(false);
      }
    });
  }

  handlePlacementFailure(key) {
    if (key) this.failedKeys.add(key);
    this.clearAll();
    this._onLayoutChange?.(0);
  }

  clearAll() {
    this._mountToken++;
    this.activeKey = null;
    this.activeSlot = 'none';
    this.activeContainerId = null;
    this.reservedBottomPx = 0;

    if (typeof window !== 'undefined' && 'atOptions' in window) {
      try {
        delete window.atOptions;
      } catch {
        window.atOptions = undefined;
      }
    }

    this.teardownContainersExcept(null);
  }
}

export const adManager = new AdManager();

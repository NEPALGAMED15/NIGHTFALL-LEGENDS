import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Network } from '@capacitor/network';

class AndroidBridge {
  constructor() {
    this.initialized = false;
    this.splashHidden = false;
    this.online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    this.backHandler = null;
    this.lifecycleHandler = null;
    this.lastBackAt = 0;
    this.toastTimer = null;
  }

  isNative() {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }

  isAndroid() {
    try {
      return Capacitor.getPlatform() === 'android';
    } catch {
      return false;
    }
  }

  isOnline() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }
    return this.online;
  }

  setBackHandler(handler) {
    this.backHandler = typeof handler === 'function' ? handler : null;
  }

  setLifecycleHandler(handler) {
    this.lifecycleHandler = typeof handler === 'function' ? handler : null;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.online = true;
      });
      window.addEventListener('offline', () => {
        this.online = false;
      });
    }

    if (!this.isNative()) return;

    try {
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.hide();
    } catch {
      // Non-fatal on older OS / webview versions
    }

    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch {
      // Manifest already enforces sensorLandscape
    }

    try {
      const net = await Network.getStatus();
      this.online = Boolean(net?.connected);
      Network.addListener('networkStatusChange', (status) => {
        this.online = Boolean(status?.connected);
      });
    } catch {
      // Fallback to navigator.onLine
    }

    try {
      App.addListener('appStateChange', ({ isActive }) => {
        this.lifecycleHandler?.(Boolean(isActive));
        if (isActive) {
          StatusBar.hide().catch(() => {});
        }
      });

      App.addListener('backButton', () => {
        const handled = this.backHandler ? this.backHandler() : false;
        if (handled) return;

        const now = Date.now();
        if (now - this.lastBackAt < 2100) {
          App.exitApp().catch(() => {});
        } else {
          this.lastBackAt = now;
          this.showToast('Press Back again to exit NIGHTFALL LEGENDS');
        }
      });
    } catch {
      // Non-fatal outside Capacitor native shell
    }
  }

  async hideSplash() {
    if (this.splashHidden) return;
    this.splashHidden = true;
    if (!this.isNative()) return;
    try {
      await SplashScreen.hide({ fadeOutDuration: 350 });
    } catch {
      // Ignore if already dismissed
    }
  }

  showToast(message) {
    if (typeof document === 'undefined' || !message) return;
    let el = document.getElementById('nf-android-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nf-android-toast';
      el.className =
        'fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-lg bg-[#0c0f18]/95 border border-[#c4a25e]/50 text-xs text-[#f5e3b3] font-medium shadow-xl pointer-events-none transition-opacity duration-200';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = '1';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (el) el.style.opacity = '0';
    }, 1900);
  }
}

export const androidBridge = new AndroidBridge();

import './index.css';
import Phaser from 'phaser';
import { PHYSICS_CONFIG } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { VictoryScene } from './scenes/VictoryScene.js';
import { androidBridge } from './systems/AndroidBridge.js';

export function getLiveViewportSize() {
  if (typeof window === 'undefined') return { width: 1280, height: 720 };
  const vv = window.visualViewport;
  const width = Math.max(240, Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1280));
  const height = Math.max(240, Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 720));
  return { width, height };
}

export function syncViewportHeightVar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { width: 1280, height: 720 };
  const size = getLiveViewportSize();
  document.documentElement.style.setProperty('--app-height', `${size.height}px`);
  return size;
}

export function hideBootLoader() {
  const loader = document.getElementById('boot-loader');
  if (loader) {
    loader.classList.add('hidden');
  }
}

export function showFatalError(message) {
  hideBootLoader();
  const overlay = document.getElementById('fatal-error-overlay');
  const msgEl = document.getElementById('fatal-error-msg');
  if (msgEl && message) {
    msgEl.textContent = message;
  }
  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

const initialSize = syncViewportHeightVar();

export function createPhaserConfig(rendererType = Phaser.AUTO) {
  const size = getLiveViewportSize();
  return {
    type: rendererType,
    parent: 'game-container',
    width: size.width,
    height: size.height,
    backgroundColor: '#07090f',
    pixelArt: true,
    render: {
      pixelArt: true,
      antialias: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'high-performance',
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: size.width,
      height: size.height,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: PHYSICS_CONFIG.GRAVITY_Y },
        debug: false,
      },
    },
    scene: [BootScene, PreloadScene, MenuScene, GameScene, PauseScene, GameOverScene, VictoryScene],
  };
}

export const phaserConfig = createPhaserConfig(Phaser.AUTO);

function bootGame() {
  let gameInstance = null;
  try {
    gameInstance = new Phaser.Game(createPhaserConfig(Phaser.AUTO));
  } catch (err) {
    console.warn('WebGL Phaser boot failed, falling back to Canvas renderer:', err);
    try {
      gameInstance = new Phaser.Game(createPhaserConfig(Phaser.CANVAS));
    } catch (canvasErr) {
      console.error('Fatal Phaser initialization error:', canvasErr);
      showFatalError('Unable to start graphics engine on this browser. Please reload.');
      return null;
    }
  }

  // Handle WebGL context loss gracefully on Android Chrome
  gameInstance.events?.once('ready', () => {
    const canvas = gameInstance.canvas;
    if (canvas) {
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.warn('WebGL context lost — waiting for restore or user reload.');
      });
    }
    const { width, height } = syncViewportHeightVar();
    if (gameInstance.scale && (gameInstance.scale.width !== width || gameInstance.scale.height !== height)) {
      gameInstance.scale.resize(width, height);
    }
  });

  // Sync Phaser canvas with Android Chrome URL-bar / orientation / visualViewport changes
  let resizeRaf = 0;
  const handleViewportResize = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      const { width, height } = syncViewportHeightVar();
      if (gameInstance?.scale) {
        gameInstance.scale.resize(width, height);
      }
    });
  };

  window.addEventListener('resize', handleViewportResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleViewportResize, 120);
    setTimeout(handleViewportResize, 360);
  });
  window.visualViewport?.addEventListener('resize', handleViewportResize);

  // If boot hangs before any scene starts (e.g. broken asset/driver), surface reload option cleanly
  window.__NIGHTFALL_BOOT_READY__ = false;
  setTimeout(() => {
    if (!window.__NIGHTFALL_BOOT_READY__ && initialSize.width > 0) {
      const loader = document.getElementById('boot-loader');
      if (loader && !loader.classList.contains('hidden')) {
        showFatalError('Loading took longer than expected on this connection. Tap Reload Game to retry.');
      }
    }
  }, 14000);

  return gameInstance;
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => {
    if (!window.__NIGHTFALL_BOOT_READY__) {
      console.error('Startup error:', ev.error || ev.message);
      showFatalError('Startup error detected. Tap Reload Game to continue.');
    }
  });
  window.addEventListener('unhandledrejection', (ev) => {
    if (!window.__NIGHTFALL_BOOT_READY__) {
      console.error('Startup promise rejection:', ev.reason);
      showFatalError('Asset loading interrupted. Tap Reload Game to continue.');
    }
  });
}

const game = bootGame();

if (typeof window !== 'undefined' && game) {
  window.__NIGHTFALL_GAME__ = game;
  androidBridge.init();
  androidBridge.setLifecycleHandler((isActive) => {
    if (!isActive) {
      const gs = game.scene?.getScene?.('GameScene');
      if (gs && gs.scene?.isActive?.() && !gs.scene?.isPaused?.()) {
        gs.pauseGame?.();
      }
      if (game.sound?.context?.state === 'running') {
        game.sound.context.suspend().catch(() => {});
      }
    } else {
      const { width, height } = syncViewportHeightVar();
      if (game.scale && (game.scale.width !== width || game.scale.height !== height)) {
        game.scale.resize(width, height);
      }
      if (game.sound?.context?.state === 'suspended') {
        game.sound.context.resume().catch(() => {});
      }
    }
  });
}

export default game;

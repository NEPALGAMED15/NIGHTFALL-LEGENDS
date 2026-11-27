import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';

/**
 * Computes responsive camera zoom, visible world dimensions, and follow offset
 * so gameplay fills 100% of any desktop, mobile landscape, or mobile portrait viewport
 * without black bars or bottom cut-off.
 */
export function computeCameraFraming(viewWidth, viewHeight, worldHeight = GAME_HEIGHT) {
  const w = Math.max(240, Math.round(viewWidth || GAME_WIDTH));
  const h = Math.max(240, Math.round(viewHeight || GAME_HEIGHT));
  const isPortrait = h > w;
  const isMobileLandscape = !isPortrait && h <= 540;

  // Never zoom out farther than worldHeight so zero black bars appear above/below world
  const minZoomForWorld = h / worldHeight;

  let zoom;
  if (isMobileLandscape) {
    // Frame ~480px vertically on mobile landscape so Kael, enemies, and platforms look large & crisp
    zoom = Math.max(minZoomForWorld, Math.min(1.4, h / 480));
  } else if (isPortrait) {
    // Fill 100% of portrait height while keeping player & approaching threats readable
    zoom = Math.max(minZoomForWorld, 1.0);
  } else {
    // Desktop / tablet: fill full viewport while showing rich horizontal combat window
    zoom = Math.max(minZoomForWorld, w / 1440);
  }

  zoom = Math.ceil(zoom * 10000) / 10000;
  const visibleW = w / zoom;
  const visibleH = h / zoom;

  // Keep Kael slightly left-of-center for forward sightline, and frame ground cleanly above touch controls
  const followOffsetX = -Math.min(85, Math.round(visibleW * 0.12));
  const followOffsetY = isMobileLandscape ? -42 : isPortrait ? 18 : 25;

  return {
    viewWidth: w,
    viewHeight: h,
    isPortrait,
    isMobileLandscape,
    zoom,
    visibleW,
    visibleH,
    followOffsetX,
    followOffsetY,
  };
}

/**
 * Computes cover zoom for MenuScene backdrop so 1280x720 art fills 100% of any screen.
 */
export function computeMenuCoverFraming(viewWidth, viewHeight) {
  const w = Math.max(240, Math.round(viewWidth || GAME_WIDTH));
  const h = Math.max(240, Math.round(viewHeight || GAME_HEIGHT));
  const zoom = Math.ceil(Math.max(w / GAME_WIDTH, h / GAME_HEIGHT) * 10000) / 10000;
  return {
    viewWidth: w,
    viewHeight: h,
    zoom,
    visibleW: w / zoom,
    visibleH: h / zoom,
  };
}

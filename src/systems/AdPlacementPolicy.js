/**
 * Pure, framework-agnostic advertising placement & safety policy for NIGHTFALL LEGENDS.
 * Strictly enforces:
 *  - ZERO ads during gameplay, loading, boss fights, combat, pause, game-over, or victory.
 *  - Correct ad unit selection per device & screen geometry (Android 320x50, Desktop 728x90, Info 300x250).
 *  - Never crops banners or causes horizontal scrolling on narrow viewports.
 */

export const AD_PLACEMENTS = Object.freeze({
  MOBILE_HOME: Object.freeze({
    id: 'mobile_home',
    key: '0cb0d0f4d44421ddb24517f41a35be4e',
    format: 'iframe',
    width: 320,
    height: 50,
    src: 'https://bauval.org/22/0cb0d0f4d44421ddb24517f41a35be4e',
  }),
  DESKTOP_HOME: Object.freeze({
    id: 'desktop_home',
    key: 'a32c43a25b9d73e4ad935b0209fcf578',
    format: 'iframe',
    width: 728,
    height: 90,
    src: 'https://bauval.org/22/a32c43a25b9d73e4ad935b0209fcf578',
  }),
  INFO_RECTANGLE: Object.freeze({
    id: 'info_rectangle',
    key: 'a786455bd69467d37869bd69ed423bb0',
    format: 'iframe',
    width: 300,
    height: 250,
    src: 'https://bauval.org/22/a786455bd69467d37869bd69ed423bb0',
  }),
});

export const DISALLOWED_AD_STATES = new Set([
  'boot',
  'preload',
  'loading',
  'playing',
  'combat',
  'boss',
  'cutscene',
  'transition',
  'paused',
  'gameover',
  'victory',
]);

export function isMobileDeviceContext({ width = 1280, height = 720, hasTouch = false, userAgent = '' } = {}) {
  const ua = String(userAgent || '');
  const isAndroidOrMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (isAndroidOrMobileUA) return true;
  if (width < 760) return true;
  if (hasTouch && (width <= 960 || height <= 540)) return true;
  return false;
}

export function buildAtOptionsPayload(placement) {
  if (!placement) return null;
  return {
    key: placement.key,
    format: placement.format,
    height: placement.height,
    width: placement.width,
    params: {},
  };
}

/**
 * Resolves which single ad unit (if any) may be displayed right now.
 * Guarantees at most ONE placement can ever be active at a time.
 * @param {{
 *   sceneState?: string,
 *   activeSubModal?: string | null,
 *   width?: number,
 *   height?: number,
 *   hasTouch?: boolean,
 *   userAgent?: string,
 *   adsEnabled?: boolean,
 *   familySafeAllowed?: boolean,
 * }} [options]
 */
export function resolveAdPlacement({
  sceneState = 'title',
  activeSubModal = null,
  width = 1280,
  height = 720,
  hasTouch = false,
  userAgent = '',
  adsEnabled = true,
  familySafeAllowed = true,
} = {}) {
  const noAd = { slot: 'none', placement: null, reservedBottomPx: 0 };

  if (!adsEnabled || !familySafeAllowed) return noAd;
  if (sceneState !== 'title' && sceneState !== 'menu') return noAd;
  if (DISALLOWED_AD_STATES.has(sceneState)) return noAd;

  const vw = Math.max(0, Math.round(Number(width) || 0));
  const vh = Math.max(0, Math.round(Number(height) || 0));

  // Optional 300x250 ONLY inside dedicated Game Information / Credits sections when viewport comfortably fits it
  if (activeSubModal === 'info') {
    if (vw >= 360 && vh >= 560) {
      return {
        slot: 'info',
        placement: AD_PLACEMENTS.INFO_RECTANGLE,
        reservedBottomPx: 0,
      };
    }
    return noAd;
  }

  if (activeSubModal === 'credits') {
    if (vw >= 900 && vh >= 660) {
      return {
        slot: 'info',
        placement: AD_PLACEMENTS.INFO_RECTANGLE,
        reservedBottomPx: 0,
      };
    }
    return noAd;
  }

  // Hide ads while other modal dialogs (1000 Levels, Bonus Worlds, Armory, Settings, Confirm Reset) are open
  if (activeSubModal) {
    return noAd;
  }

  const isMobile = isMobileDeviceContext({ width: vw, height: vh, hasTouch, userAgent });

  // Android / Mobile or narrow viewports: 320x50 banner at bottom of Home Menu
  if (isMobile) {
    if (vw >= 320 && vh >= 360) {
      return {
        slot: 'home',
        placement: AD_PLACEMENTS.MOBILE_HOME,
        reservedBottomPx: 62, // 50px banner + 12px safe spacing
      };
    }
    return noAd;
  }

  // Windows PC / Desktop: 728x90 centered below Home Menu without cropping
  if (vw >= 748 && vh >= 520) {
    return {
      slot: 'home',
      placement: AD_PLACEMENTS.DESKTOP_HOME,
      reservedBottomPx: 106, // 90px banner + 16px safe spacing
    };
  }

  // Compact / narrow desktop window fallback so full banner fits cleanly with zero horizontal scroll
  if (vw >= 340 && vh >= 420) {
    return {
      slot: 'home',
      placement: AD_PLACEMENTS.MOBILE_HOME,
      reservedBottomPx: 62,
    };
  }

  return noAd;
}

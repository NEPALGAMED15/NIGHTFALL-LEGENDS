import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AD_PLACEMENTS,
  DISALLOWED_AD_STATES,
  buildAtOptionsPayload,
  resolveAdPlacement,
} from './AdPlacementPolicy.js';

test('AdPlacementPolicy forbids all ads during gameplay, loading, boss fights, pause, victory, and gameover', () => {
  for (const state of DISALLOWED_AD_STATES) {
    const mobile = resolveAdPlacement({
      sceneState: state,
      activeSubModal: null,
      width: 390,
      height: 844,
      hasTouch: true,
      userAgent: 'Android',
    });
    assert.equal(mobile.slot, 'none', `Expected no ad during state ${state} on mobile`);
    assert.equal(mobile.placement, null);

    const desktop = resolveAdPlacement({
      sceneState: state,
      activeSubModal: null,
      width: 1440,
      height: 900,
      hasTouch: false,
      userAgent: 'Windows',
    });
    assert.equal(desktop.slot, 'none', `Expected no ad during state ${state} on desktop`);
    assert.equal(desktop.placement, null);
  }
});

test('AdPlacementPolicy selects 320x50 on Android / mobile Home Menu with reserved safe spacing', () => {
  const portrait = resolveAdPlacement({
    sceneState: 'title',
    activeSubModal: null,
    width: 390,
    height: 844,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  });
  assert.equal(portrait.slot, 'home');
  assert.ok(portrait.placement);
  assert.equal(portrait.placement!.key, AD_PLACEMENTS.MOBILE_HOME.key);
  assert.equal(portrait.placement!.width, 320);
  assert.equal(portrait.placement!.height, 50);
  assert.ok(portrait.reservedBottomPx >= 60);

  const androidLandscape = resolveAdPlacement({
    sceneState: 'title',
    activeSubModal: null,
    width: 844,
    height: 390,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  });
  assert.equal(androidLandscape.slot, 'home');
  assert.ok(androidLandscape.placement);
  assert.equal(androidLandscape.placement!.key, AD_PLACEMENTS.MOBILE_HOME.key);
});

test('AdPlacementPolicy selects 728x90 centered on Windows PC Home Menu without cropping', () => {
  const desktop = resolveAdPlacement({
    sceneState: 'title',
    activeSubModal: null,
    width: 1440,
    height: 900,
    hasTouch: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  });
  assert.equal(desktop.slot, 'home');
  assert.ok(desktop.placement);
  assert.equal(desktop.placement!.key, AD_PLACEMENTS.DESKTOP_HOME.key);
  assert.equal(desktop.placement!.width, 728);
  assert.equal(desktop.placement!.height, 90);
  assert.ok(desktop.reservedBottomPx >= 100);

  // Narrow desktop window avoids cropping 728x90
  const narrowDesktop = resolveAdPlacement({
    sceneState: 'title',
    activeSubModal: null,
    width: 640,
    height: 700,
    hasTouch: false,
    userAgent: 'Windows',
  });
  assert.ok(narrowDesktop.placement);
  assert.equal(narrowDesktop.placement!.key, AD_PLACEMENTS.MOBILE_HOME.key);
});

test('AdPlacementPolicy places optional 300x250 only in Credits/Info modal when viewport fits and hides on cramped screens', () => {
  const desktopCredits = resolveAdPlacement({
    sceneState: 'title',
    activeSubModal: 'credits',
    width: 1440,
    height: 900,
    hasTouch: false,
  });
  assert.equal(desktopCredits.slot, 'info');
  assert.ok(desktopCredits.placement);
  assert.equal(desktopCredits.placement!.key, AD_PLACEMENTS.INFO_RECTANGLE.key);
  assert.equal(desktopCredits.placement!.width, 300);
  assert.equal(desktopCredits.placement!.height, 250);

  // Short mobile landscape hides 300x250
  const mobileLandscapeCredits = resolveAdPlacement({
    sceneState: 'title',
    activeSubModal: 'credits',
    width: 844,
    height: 390,
    hasTouch: true,
  });
  assert.equal(mobileLandscapeCredits.slot, 'none');

  // Other modals (levels, bonus, armory, settings) hide ads
  const levelsModal = resolveAdPlacement({
    sceneState: 'title',
    activeSubModal: 'levels',
    width: 1440,
    height: 900,
  });
  assert.equal(levelsModal.slot, 'none');
});

test('buildAtOptionsPayload returns isolated exact atOptions format matching verified ad codes', () => {
  const p1 = buildAtOptionsPayload(AD_PLACEMENTS.MOBILE_HOME);
  const p2 = buildAtOptionsPayload(AD_PLACEMENTS.DESKTOP_HOME);
  const p3 = buildAtOptionsPayload(AD_PLACEMENTS.INFO_RECTANGLE);
  assert.deepEqual(p1, {
    key: '0cb0d0f4d44421ddb24517f41a35be4e',
    format: 'iframe',
    height: 50,
    width: 320,
    params: {},
  });
  assert.deepEqual(p2, {
    key: 'a32c43a25b9d73e4ad935b0209fcf578',
    format: 'iframe',
    height: 90,
    width: 728,
    params: {},
  });
  assert.deepEqual(p3, {
    key: 'a786455bd69467d37869bd69ed423bb0',
    format: 'iframe',
    height: 250,
    width: 300,
    params: {},
  });
});

import { GAME_CREDITS_ENTRIES, GAME_INFO_DETAILS } from './GameInfoContent.js';

test('GameInfoContent and AdPlacementPolicy info modal match exact specification', () => {
  assert.equal(GAME_INFO_DETAILS.title, 'NIGHTFALL LEGENDS');
  assert.equal(GAME_INFO_DETAILS.tagline, 'When the Sun Falls, Legends Awaken.');
  assert.equal(GAME_INFO_DETAILS.developer, 'NEPALCMD');
  assert.equal(GAME_INFO_DETAILS.creatorName, 'RAJ KUMAR MAHATO');
  assert.equal(GAME_INFO_DETAILS.genre, '2D / 2.5D Dark Fantasy Action Adventure Platformer');
  assert.equal(GAME_INFO_DETAILS.platforms, 'Android and Windows PC');
  assert.equal(GAME_INFO_DETAILS.modes, 'Story Mode, Boss Battles, Exploration');
  assert.equal(GAME_INFO_DETAILS.campaign, '1,000 Levels');
  assert.equal(GAME_INFO_DETAILS.world, 'Seven Kingdoms of Aetheria');
  assert.equal(GAME_INFO_DETAILS.mainCharacter, 'KAEL – The Last Nightwalker');

  assert.equal(GAME_CREDITS_ENTRIES[0].role, 'GAME CREATED BY');
  assert.equal(GAME_CREDITS_ENTRIES[0].name, 'NEPALCMD');
  assert.equal(GAME_CREDITS_ENTRIES[1].role, 'FOUNDER & CREATOR');
  assert.equal(GAME_CREDITS_ENTRIES[1].name, 'RAJ KUMAR MAHATO');
  assert.equal(GAME_CREDITS_ENTRIES[2].role, 'GAME TITLE');
  assert.equal(GAME_CREDITS_ENTRIES[2].name, 'NIGHTFALL LEGENDS');

  const infoDesktop = resolveAdPlacement({
    sceneState: 'title',
    activeSubModal: 'info',
    width: 1440,
    height: 900,
  });
  assert.equal(infoDesktop.slot, 'info');
  assert.equal(infoDesktop.placement?.key, AD_PLACEMENTS.INFO_RECTANGLE.key);

  const infoShortLandscape = resolveAdPlacement({
    sceneState: 'title',
    activeSubModal: 'info',
    width: 844,
    height: 390,
  });
  assert.equal(infoShortLandscape.slot, 'none');
});


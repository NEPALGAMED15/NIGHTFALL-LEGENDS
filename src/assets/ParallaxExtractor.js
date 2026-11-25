function createOffscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  return { canvas: c, ctx };
}

function registerCanvasTexture(scene, key, canvas) {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}

function makeSeamlessTileBand(srcCanvas) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const { canvas, ctx } = createOffscreen(w * 2, h);
  ctx.drawImage(srcCanvas, 0, 0);
  ctx.save();
  ctx.translate(w * 2, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(srcCanvas, 0, 0);
  ctx.restore();
  return canvas;
}

/**
 * LAYER 1: Pure Day Sky (Blue sky + white clouds + golden sun) or Pure Night Sky (Starry sky + full moon)
 * Smooth full-width gradient sky + soft elliptically feathered pure Sun/Moon center (zero temple/tree/castle fragments).
 */
function buildSkyLayer(srcImg, targetW = 1440, targetH = 560, isNight = false) {
  const sw = srcImg.width;
  const sh = srcImg.height;
  const { canvas, ctx } = createOffscreen(targetW, targetH);

  const sampleH = Math.round(sh * 0.24);
  const { ctx: sctx } = createOffscreen(sw, sampleH);
  sctx.drawImage(srcImg, 0, 0, sw, sampleH, 0, 0, sw, sampleH);
  const sData = sctx.getImageData(0, 0, sw, sampleH).data;

  const sampleColorAt = (xNorm, yNorm) => {
    const sx = Math.max(0, Math.min(sw - 1, Math.round(sw * xNorm)));
    const sy = Math.max(0, Math.min(sampleH - 1, Math.round(sampleH * yNorm)));
    const i = (sy * sw + sx) * 4;
    return [sData[i], sData[i + 1], sData[i + 2]];
  };

  const topSampleX = isNight ? 0.56 : 0.62;
  const midSampleX = isNight ? 0.26 : 0.64;
  const [tr, tg, tb] = sampleColorAt(topSampleX, 0.08);
  const [mr, mg, mb] = sampleColorAt(midSampleX, 0.55);
  const [br, bg, bb] = sampleColorAt(topSampleX, 0.92);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, targetH);
  skyGrad.addColorStop(0, `rgb(${tr}, ${tg}, ${tb})`);
  skyGrad.addColorStop(0.55, `rgb(${mr}, ${mg}, ${mb})`);
  skyGrad.addColorStop(1, `rgba(${br}, ${bg}, ${bb}, 0)`);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, targetW, targetH);

  // Strictly crop y = 0 .. 0.27 * sh around Sun / Moon so zero temple tips enter
  const celSrcH = Math.round(sh * 0.27);
  const celW = Math.round(targetW * 0.44);
  const celH = Math.round(targetH * 0.54);
  const { canvas: celCanvas, ctx: cctx } = createOffscreen(celW, celH);

  const srcStartX = isNight ? 0.24 : 0.34;
  const srcSpanX = isNight ? 0.33 : 0.34;
  cctx.drawImage(
    srcImg,
    Math.round(sw * srcStartX),
    0,
    Math.round(sw * srcSpanX),
    celSrcH,
    0,
    0,
    celW,
    celH
  );

  const cImg = cctx.getImageData(0, 0, celW, celH);
  const cd = cImg.data;
  for (let y = 0; y < celH; y++) {
    const yNorm = y / celH;
    for (let x = 0; x < celW; x++) {
      const xNorm = x / celW;
      const dx = (xNorm - 0.5) / 0.48;
      const dy = (yNorm - 0.40) / 0.56;
      const dist = Math.hypot(dx, dy);
      let mask = 1;
      if (dist > 0.52) {
        const u = Math.min(1, (dist - 0.52) / 0.45);
        mask = 0.5 + 0.5 * Math.cos(Math.PI * u);
      }
      if (yNorm > 0.72) {
        const v = Math.min(1, (yNorm - 0.72) / 0.28);
        mask *= 0.5 + 0.5 * Math.cos(Math.PI * v);
      }
      const idx = (y * celW + x) * 4;
      cd[idx + 3] = Math.round(cd[idx + 3] * mask);
    }
  }
  cctx.putImageData(cImg, 0, 0);

  const celDestX = isNight ? Math.round(targetW * 0.28) : Math.round(targetW * 0.32);
  ctx.drawImage(celCanvas, celDestX, 0);

  // Clean fluffy clouds gently feathered on left & right sky
  const cloudW = Math.round(targetW * 0.24);
  const cloudH = Math.round(targetH * 0.36);
  const { canvas: cloudCanvas, ctx: clctx } = createOffscreen(cloudW, cloudH);
  clctx.drawImage(
    srcImg,
    Math.round(sw * (isNight ? 0.60 : 0.61)),
    0,
    Math.round(sw * 0.12),
    Math.round(sh * 0.19),
    0,
    0,
    cloudW,
    cloudH
  );
  const clImg = clctx.getImageData(0, 0, cloudW, cloudH);
  const cld = clImg.data;
  for (let y = 0; y < cloudH; y++) {
    const yn = y / cloudH;
    for (let x = 0; x < cloudW; x++) {
      const xn = x / cloudW;
      const dEdge = Math.hypot((xn - 0.5) / 0.48, (yn - 0.46) / 0.48);
      const alpha = dEdge >= 1 ? 0 : dEdge < 0.42 ? 0.80 : 0.80 * (0.5 + 0.5 * Math.cos(Math.PI * ((dEdge - 0.42) / 0.58)));
      const idx = (y * cloudW + x) * 4;
      cld[idx + 3] = Math.round(cld[idx + 3] * alpha);
    }
  }
  clctx.putImageData(clImg, 0, 0);
  ctx.drawImage(cloudCanvas, Math.round(targetW * 0.04), Math.round(targetH * 0.06));
  ctx.drawImage(cloudCanvas, Math.round(targetW * 0.72), Math.round(targetH * 0.04));

  return canvas;
}

/**
 * LAYER 2: Mountains & Castle (Daytime Castle + Bright Mountains OR Gothic Castle + Moonlit Mountains)
 * Sized 1680 x 420 so the Castle sits visibly in the upper-right of the 1280/1440 screen!
 * Crops STRICTLY x = 0.58..1.00 (completely past the Sun 0.43..0.57 and Moon 0.36..0.48 -> ZERO double sun/moon!),
 * mirrors x = 0.58..0.72 smoothly onto the left side, and fades the upper-left sky smoothly into alpha=0
 * so the Moon & Sun NEVER suffer a horizontal edge bar.
 */
function buildMountainsAndCastleLayer(srcImg, targetW = 1680, targetH = 400, isNight = false) {
  const sw = srcImg.width;
  const sh = srcImg.height;
  const { canvas: core, ctx: cctx } = createOffscreen(targetW, targetH);

  const cropX = Math.round(sw * 0.58);
  const cropW = sw - cropX;
  const cropY = Math.round(sh * 0.01);
  const cropH = Math.round(sh * 0.44);

  // Mirror clean mountains + viaduct (x = 0.58..0.72, completely clear of Sun & Moon) across left side
  const mtnSrcW = Math.round(sw * 0.14);
  const { canvas: leftMtn, ctx: lmctx } = createOffscreen(640, targetH);
  lmctx.save();
  lmctx.translate(640, 0);
  lmctx.scale(-1, 1);
  lmctx.drawImage(srcImg, Math.round(sw * 0.58), cropY, mtnSrcW, cropH, 0, 0, 640, targetH);
  lmctx.restore();

  cctx.drawImage(srcImg, cropX, cropY, cropW, cropH, 540, 0, targetW - 540, targetH);

  const mainImg = cctx.getImageData(0, 0, targetW, targetH);
  const leftImg = lmctx.getImageData(0, 0, 640, targetH);
  const md = mainImg.data;
  const ld = leftImg.data;
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < 640; x++) {
      const mIdx = (y * targetW + x) * 4;
      const lIdx = (y * 640 + x) * 4;
      let wLeft = 1;
      if (x >= 520) {
        const u = (x - 520) / 120;
        wLeft = 0.5 + 0.5 * Math.cos(Math.PI * u);
      }
      md[mIdx] = Math.round(md[mIdx] * (1 - wLeft) + ld[lIdx] * wLeft);
      md[mIdx + 1] = Math.round(md[mIdx + 1] * (1 - wLeft) + ld[lIdx + 1] * wLeft);
      md[mIdx + 2] = Math.round(md[mIdx + 2] * (1 - wLeft) + ld[lIdx + 2] * wLeft);
      md[mIdx + 3] = 255;
    }
  }
  cctx.putImageData(mainImg, 0, 0);

  // Top-down sky carving that strictly clears ONLY upper sky above Castle & mountains
  const w = targetW;
  const h = targetH;
  const img = cctx.getImageData(0, 0, w, h);
  const d = img.data;
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qHead = 0;
  let qTail = 0;

  for (let x = 0; x < w; x++) {
    visited[x] = 1;
    d[x * 4 + 3] = 0;
    queue[qTail++] = x;
  }

  while (qHead < qTail) {
    const p = queue[qHead++];
    const x = p % w;
    const y = (p - x) / w;

    const dirs = [
      [x - 1, y],
      [x + 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (let k = 0; k < 4; k++) {
      const nx = dirs[k][0];
      const ny = dirs[k][1];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h * 0.72) continue;
      const np = ny * w + nx;
      if (visited[np]) continue;
      const nIdx = np * 4;
      const nr = d[nIdx], ng = d[nIdx + 1], nb = d[nIdx + 2];

      const xNorm = nx / w;
      const yNorm = ny / h;
      const luma = 0.299 * nr + 0.587 * ng + 0.114 * nb;

      if (!isNight) {
        // Protect Castle gold masonry, snow-lit rock ridges, viaduct stone, and green trees
        const isWarmMasonry = nr > nb + 10 && nr > 65;
        const isGreen = ng > nr + 6 && ng > nb + 4;
        const isDarkStone = xNorm > 0.58 && luma < 120 && Math.abs(nr - nb) < 35;
        if (isWarmMasonry || isGreen || isDarkStone) continue;

        const isBlueDaySky = nb > nr + 22 && nb > 125;
        const isHighCloud = luma > 202 && Math.abs(nr - nb) < 36 && yNorm < 0.44 && xNorm < 0.72;
        if (isBlueDaySky || isHighCloud) {
          visited[np] = 1;
          d[nIdx + 3] = 0;
          queue[qTail++] = np;
        }
      } else {
        // Protect Gothic Castle silhouette, glowing castle windows, viaduct, and mountain peaks
        const isGlowingWindow = xNorm > 0.60 && nr > 120 && nb < 130;
        const isDarkStructure = luma < 58 || (xNorm > 0.58 && luma < 86 && nr > nb - 26);
        if (isGlowingWindow || isDarkStructure) continue;

        const isDeepNightSky = nb > nr + 14 && luma < 90 && nr < 65;
        if (isDeepNightSky) {
          visited[np] = 1;
          d[nIdx + 3] = 0;
          queue[qTail++] = np;
        }
      }
    }
  }

  // Smooth upper-left sky cloud fade so NO horizontal top border ever cuts across Moon or Sun
  const castleStartX = Math.round(w * 0.58);
  const topFeatherH = Math.round(h * 0.34);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (d[idx + 3] === 0) continue;
      if (y < topFeatherH && x < castleStartX) {
        const horizProtect = Math.max(0, Math.min(1, (castleStartX - x) / (w * 0.14)));
        const t = y / topFeatherH;
        const fadeY = 0.5 - 0.5 * Math.cos(Math.PI * t);
        const mult = 1 - horizProtect * (1 - fadeY);
        d[idx + 3] = Math.round(d[idx + 3] * mult);
      }
    }
  }
  cctx.putImageData(img, 0, 0);

  // Soft lateral left fade + lower mist fade into Layer 3 Forest
  cctx.globalCompositeOperation = 'destination-out';
  const leftFade = cctx.createLinearGradient(0, 0, w * 0.06, 0);
  leftFade.addColorStop(0, 'rgba(0,0,0,1)');
  leftFade.addColorStop(1, 'rgba(0,0,0,0)');
  cctx.fillStyle = leftFade;
  cctx.fillRect(0, 0, w * 0.06, h);

  const botFade = cctx.createLinearGradient(0, h * 0.72, 0, h);
  botFade.addColorStop(0, 'rgba(0,0,0,0)');
  botFade.addColorStop(0.6, 'rgba(0,0,0,0.5)');
  botFade.addColorStop(1, 'rgba(0,0,0,1)');
  cctx.fillStyle = botFade;
  cctx.fillRect(0, h * 0.72, w, h * 0.28);
  cctx.globalCompositeOperation = 'source-over';

  return core;
}

/**
 * LAYER 3: Distant Forest & Waterfall (1024 x 360 -> 2048 x 360 seamless TileSprite)
 * Uses ONLY pure pine tree crowns (x = 0.615..0.675, y = 0.62..0.76) + Waterfall gorge (x = 0.845..0.935, y = 0.35..0.56).
 * Carves BOTH blue sky AND bright cream sunlit mist (`luma > 148`) so ZERO cream rectangles appear!
 */
function buildForestWaterfallLayer(srcImg, isNight = false) {
  const tileW = 1024;
  const tileH = 360;
  const { canvas, ctx } = createOffscreen(tileW, tileH);
  const sw = srcImg.width;
  const sh = srcImg.height;

  const buildCarvedPineOrCliff = (sxNorm, syNorm, swNorm, shNorm, dw, dh, keepRock = false) => {
    const { canvas: slice, ctx: sctx } = createOffscreen(dw, dh);
    sctx.drawImage(srcImg, sw * sxNorm, sh * syNorm, sw * swNorm, sh * shNorm, 0, 0, dw, dh);
    const img = sctx.getImageData(0, 0, dw, dh);
    const d = img.data;
    const visited = new Uint8Array(dw * dh);
    const queue = new Int32Array(dw * dh);
    let qH = 0;
    let qT = 0;

    for (let x = 0; x < dw; x++) {
      visited[x] = 1;
      d[x * 4 + 3] = 0;
      queue[qT++] = x;
    }

    while (qH < qT) {
      const p = queue[qH++];
      const x = p % dw;
      const y = (p - x) / dw;
      const dirs = [
        [x - 1, y],
        [x + 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (let i = 0; i < 4; i++) {
        const nx = dirs[i][0];
        const ny = dirs[i][1];
        if (nx < 0 || nx >= dw || ny < 0 || ny >= dh * 0.86) continue;
        const np = ny * dw + nx;
        if (visited[np]) continue;
        const nIdx = np * 4;
        const nr = d[nIdx], ng = d[nIdx + 1], nb = d[nIdx + 2];
        const luma = 0.299 * nr + 0.587 * ng + 0.114 * nb;

        const isDarkPine = !isNight
          ? (ng > nr + 5 && ng > nb + 3 && luma < 138)
          : (luma < 60 && nb < 92);
        const isWaterfallCliff = keepRock && (
          (!isNight && ((nr > nb + 12 && luma < 165) || (nb > 155 && luma > 155))) ||
          (isNight && (luma < 72 || (nb > 140 && luma > 125)))
        );
        if (isDarkPine || isWaterfallCliff) continue;

        // Carve BOTH blue sky haze AND warm cream sunlit mist cleanly down to evergreen tips
        const isMist = !isNight
          ? (luma > 136 || (nb >= nr - 14 && luma > 110))
          : (nb > nr + 8 && luma > 50);
        if (isMist || ny < dh * 0.08) {
          visited[np] = 1;
          d[nIdx + 3] = 0;
          queue[qT++] = np;
        }
      }
    }

    const edgeX = Math.round(dw * 0.16);
    const topFadeH = Math.round(dh * 0.18);
    for (let y = 0; y < dh; y++) {
      const topW = y < topFadeH ? y / topFadeH : 1;
      const botW = y > dh * 0.72 ? Math.max(0, (dh - y) / (dh * 0.28)) : 1;
      for (let x = 0; x < dw; x++) {
        const sideW = x < edgeX ? x / edgeX : x > dw - edgeX ? (dw - x) / edgeX : 1;
        const aIdx = (y * dw + x) * 4 + 3;
        d[aIdx] = Math.round(d[aIdx] * topW * sideW * botW);
      }
    }
    sctx.putImageData(img, 0, 0);
    return slice;
  };

  // Continuous deep forest mist base across lower region (safely behind pits)
  const forestBase = ctx.createLinearGradient(0, tileH * 0.34, 0, tileH);
  if (!isNight) {
    forestBase.addColorStop(0, 'rgba(26, 68, 48, 0)');
    forestBase.addColorStop(0.36, 'rgba(18, 52, 38, 0.85)');
    forestBase.addColorStop(1, 'rgba(9, 25, 20, 1)');
  } else {
    forestBase.addColorStop(0, 'rgba(14, 24, 58, 0)');
    forestBase.addColorStop(0.36, 'rgba(10, 18, 44, 0.88)');
    forestBase.addColorStop(1, 'rgba(5, 9, 24, 1)');
  }
  ctx.fillStyle = forestBase;
  ctx.fillRect(0, tileH * 0.34, tileW, tileH * 0.66);

  // Clean evergreen silhouettes (strictly zero floating boulder platforms!)
  const valleyPines = buildCarvedPineOrCliff(0.615, 0.62, 0.06, 0.15, 165, 205, false);
  for (let dx = -10; dx < tileW - 30; dx += 125) {
    ctx.drawImage(valleyPines, dx, 55 + ((dx / 125) % 2) * 14);
  }

  // Clean Waterfall Gorge (x = 0.845..0.935, y = 0.35..0.56 — completely above floating platform!)
  const waterfallSlice = buildCarvedPineOrCliff(0.845, 0.35, 0.09, 0.21, 185, 215, true);
  ctx.drawImage(waterfallSlice, 650, 32);

  return makeSeamlessTileBand(canvas);
}

/**
 * Clean exterior prop extractor (Tree + Lantern, Ruins, Glowing Crystals, Banner)
 */
function extractProp(
  srcImg,
  {
    rx,
    ry,
    rw,
    rh,
    outW,
    outH,
    isNight = false,
    seedInteriorArch = false,
    protectLeftEdge = false,
    treeCanopyTrim = false,
    bottomFadeRatio = 0.10,
  }
) {
  const sw = srcImg.width;
  const sh = srcImg.height;
  const { canvas, ctx } = createOffscreen(outW, outH);
  ctx.drawImage(srcImg, sw * rx, sh * ry, sw * rw, sh * rh, 0, 0, outW, outH);

  const img = ctx.getImageData(0, 0, outW, outH);
  const d = img.data;

  // Smooth diagonal/elliptical trim on right side of foreground Tree+Lantern so zero ruin corner appears
  if (treeCanopyTrim) {
    for (let y = 0; y < outH; y++) {
      const yn = y / outH;
      const limitX = yn < 0.30 ? 0.96 : yn < 0.42 ? 0.96 - ((yn - 0.30) / 0.12) * 0.32 : 0.64;
      const cutPx = Math.round(outW * limitX);
      for (let x = cutPx; x < outW; x++) {
        d[(y * outW + x) * 4 + 3] = 0;
      }
    }
  }

  const visited = new Uint8Array(outW * outH);
  const queue = new Int32Array(outW * outH);
  let qHead = 0;
  let qTail = 0;

  const isSkyOrDistantMist = (r, g, b) => {
    if (!isNight) {
      if (b > r + 14 && b > 105) return true;
      if (r > 180 && g > 180 && b > 180) return true;
    } else {
      if (b > r + 12 && b > g + 2 && r < 118) return true;
    }
    return false;
  };

  const sampleAt = (x, y) => {
    const idx = (y * outW + x) * 4;
    return [d[idx], d[idx + 1], d[idx + 2]];
  };
  const [trR, trG, trB] = sampleAt(outW - 2, 2);

  const isForegroundMaterial = (r, g, b, x, y) => {
    const isGreenLeaf = g > r + 12 && g > b + 8 && g > 48;
    const isPurpleLeaf = isNight && (b - g > 14 || r > g + 12) && y < outH * 0.56;
    const isWarmWoodOrStone = r > b + 16 && g > b + 6 && r > 48;
    const isBrightLantern = r > 185 && g > 105 && b < 110;
    return isGreenLeaf || isPurpleLeaf || isWarmWoodOrStone || isBrightLantern;
  };

  const seed = (x, y, force = false) => {
    const px = Math.max(0, Math.min(outW - 1, Math.round(x)));
    const py = Math.max(0, Math.min(outH - 1, Math.round(y)));
    const p = py * outW + px;
    if (visited[p]) return;
    const idx = p * 4;
    if (d[idx + 3] === 0) {
      visited[p] = 1;
      queue[qTail++] = p;
      return;
    }
    const r = d[idx], g = d[idx + 1], b = d[idx + 2];
    const dist = Math.hypot(r - trR, g - trG, b - trB);
    if (force || (!isForegroundMaterial(r, g, b, px, py) && (isSkyOrDistantMist(r, g, b) || dist <= 72))) {
      visited[p] = 1;
      d[idx + 3] = 0;
      queue[qTail++] = p;
    }
  };

  for (let x = 0; x < outW; x++) {
    seed(x, 0);
    seed(x, outH - 1);
  }
  for (let y = 0; y < outH; y++) {
    seed(outW - 1, y);
    if (!protectLeftEdge) seed(0, y);
  }
  if (treeCanopyTrim) {
    for (let y = Math.round(outH * 0.30); y < outH; y++) {
      const yn = y / outH;
      const limitX = yn < 0.42 ? 0.94 - ((yn - 0.30) / 0.12) * 0.32 : 0.62;
      seed(Math.round(outW * limitX), y, true);
    }
  }

  if (seedInteriorArch) {
    [
      [0.24, 0.58],
      [0.39, 0.56],
      [0.50, 0.58],
      [0.77, 0.56],
      [0.88, 0.60],
    ].forEach(([ax, ay]) => seed(outW * ax, outH * ay, true));
  }

  while (qHead < qTail) {
    const p = queue[qHead++];
    const x = p % outW;
    const y = (p - x) / outW;
    const idx = p * 4;
    const r = d[idx], g = d[idx + 1], b = d[idx + 2];
    const dirs = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (let i = 0; i < 4; i++) {
      const nx = dirs[i][0];
      const ny = dirs[i][1];
      if (nx < 0 || nx >= outW || ny < 0 || ny >= outH) continue;
      const np = ny * outW + nx;
      if (visited[np]) continue;
      const nIdx = np * 4;
      const nr = d[nIdx], ng = d[nIdx + 1], nb = d[nIdx + 2];
      if (isForegroundMaterial(nr, ng, nb, nx, ny)) continue;

      const dist = Math.hypot(nr - r, ng - g, nb - b);
      if (dist <= 30 || isSkyOrDistantMist(nr, ng, nb)) {
        visited[np] = 1;
        d[nIdx + 3] = 0;
        queue[qTail++] = np;
      }
    }
  }

  const edgeX = Math.max(12, Math.round(outW * 0.11));
  const edgeY = Math.max(10, Math.round(outH * 0.08));
  const botFadeY = Math.round(outH * (1 - bottomFadeRatio));
  for (let y = 0; y < outH; y++) {
    const topW = y < edgeY ? y / edgeY : 1;
    const botW = y > botFadeY ? Math.max(0, (outH - y) / Math.max(1, outH - botFadeY)) : 1;
    for (let x = 0; x < outW; x++) {
      const leftW = protectLeftEdge ? 1 : (x < edgeX ? x / edgeX : 1);
      const rightW = x > outW - edgeX ? (outW - x) / edgeX : 1;
      const idx = (y * outW + x) * 4 + 3;
      d[idx] = Math.round(d[idx] * Math.min(1, topW * botW * leftW * rightW));
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * LAYER 5A: Floating Grassy Rock Platform (256 x 96)
 */
function extractPlatformArt(srcImg, { rx, ry, rw, rh, outW = 256, outH = 96, isNight = false }) {
  const sw = srcImg.width;
  const sh = srcImg.height;
  const { canvas, ctx } = createOffscreen(outW, outH);
  ctx.drawImage(srcImg, sw * rx, sh * ry, sw * rw, sh * rh, 0, 0, outW, outH);

  const img = ctx.getImageData(0, 0, outW, outH);
  const d = img.data;
  const visited = new Uint8Array(outW * outH);
  const queue = new Int32Array(outW * outH);
  let qHead = 0;
  let qTail = 0;

  const isPlatformBody = (r, g, b) => {
    if (g > r + 10 && g > 50) return true;
    if (!isNight && r > b + 8 && g > b - 6 && r < 175) return true;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC - minC < 20 && maxC < 120) return true;
    return false;
  };

  const trySeed = (x, y) => {
    const p = y * outW + x;
    if (visited[p]) return;
    const idx = p * 4;
    if (!isPlatformBody(d[idx], d[idx + 1], d[idx + 2])) {
      visited[p] = 1;
      d[idx + 3] = 0;
      queue[qTail++] = p;
    }
  };

  for (let x = 0; x < outW; x++) {
    trySeed(x, 0);
    trySeed(x, outH - 1);
  }
  for (let y = 0; y < outH; y++) {
    trySeed(0, y);
    trySeed(outW - 1, y);
  }

  while (qHead < qTail) {
    const p = queue[qHead++];
    const x = p % outW;
    const y = (p - x) / outW;
    const dirs = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (let i = 0; i < 4; i++) {
      const nx = dirs[i][0];
      const ny = dirs[i][1];
      if (nx < 0 || nx >= outW || ny < 0 || ny >= outH) continue;
      const np = ny * outW + nx;
      if (visited[np]) continue;
      const nIdx = np * 4;
      const nr = d[nIdx], ng = d[nIdx + 1], nb = d[nIdx + 2];
      const isBlueMist = nb > nr + 12 && nb > ng + 2;
      const isBrightMist = nr > 175 && ng > 175 && nb > 175;
      if (isBlueMist || isBrightMist || !isPlatformBody(nr, ng, nb)) {
        visited[np] = 1;
        d[nIdx + 3] = 0;
        queue[qTail++] = np;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * LAYER 5B: Lush Grass & Wildflower / Stone Ground Strip (512 x 128 -> 1024 x 128 TileSprite)
 */
function extractGroundStrip(srcImg, { rx, ry, rw, rh, outW = 512, outH = 128 }) {
  const sw = srcImg.width;
  const sh = srcImg.height;
  const { canvas, ctx } = createOffscreen(outW, outH);
  ctx.drawImage(srcImg, sw * rx, sh * ry, sw * rw, sh * rh, 0, 0, outW, outH);

  const img = ctx.getImageData(0, 0, outW, outH);
  const d = img.data;
  const visited = new Uint8Array(outW * outH);
  const queue = new Int32Array(outW * outH);
  let qHead = 0;
  let qTail = 0;
  const maxMaskY = Math.round(outH * 0.42);

  for (let x = 0; x < outW; x++) {
    const p = x;
    visited[p] = 1;
    d[p * 4 + 3] = 0;
    queue[qTail++] = p;
  }

  while (qHead < qTail) {
    const p = queue[qHead++];
    const x = p % outW;
    const y = (p - x) / outW;
    const dirs = [
      [x - 1, y],
      [x + 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (let i = 0; i < 4; i++) {
      const nx = dirs[i][0];
      const ny = dirs[i][1];
      if (nx < 0 || nx >= outW || ny < 0 || ny >= maxMaskY) continue;
      const np = ny * outW + nx;
      if (visited[np]) continue;
      const nIdx = np * 4;
      const nr = d[nIdx], ng = d[nIdx + 1], nb = d[nIdx + 2];
      const isGrass = ng > nr + 10 && ng > 55;
      const isDarkStone = nr < 48 && ng < 48 && nb < 60 && ny > outH * 0.16;
      if (isGrass || isDarkStone) continue;

      visited[np] = 1;
      d[nIdx + 3] = 0;
      queue[qTail++] = np;
    }
  }

  ctx.putImageData(img, 0, 0);
  return makeSeamlessTileBand(canvas);
}

export function buildParallaxAndForegroundAssets(scene) {
  const hasDay = scene.textures.exists('forest_day');
  const hasNight = scene.textures.exists('forest_night');
  if (!hasDay && !hasNight) return false;

  const dayImg = hasDay ? scene.textures.get('forest_day').getSourceImage() : null;
  const nightImg = hasNight ? scene.textures.get('forest_night').getSourceImage() : null;

  if (dayImg) {
    // 1. Day Sky (Sun + Blue Sky + Clouds)
    registerCanvasTexture(scene, 'layer_sky_day', buildSkyLayer(dayImg, 1440, 560, false));
    // 2. Day Mountains & Daytime Castle (cropped cleanly past Sun, Castle framed upper-right)
    registerCanvasTexture(scene, 'layer_mountains_day', buildMountainsAndCastleLayer(dayImg, 1680, 400, false));
    // 3. Day Distant Green Forest & Sunlit Waterfalls (pine-only + cream mist removed)
    registerCanvasTexture(scene, 'layer_forest_day', buildForestWaterfallLayer(dayImg, false));
    // 4. Day Props (Tree, Stone Ruins, Banner)
    registerCanvasTexture(
      scene,
      'prop_tree_day',
      extractProp(dayImg, { rx: 0.0, ry: 0.02, rw: 0.255, rh: 0.80, outW: 270, outH: 440, isNight: false, protectLeftEdge: true, treeCanopyTrim: true, bottomFadeRatio: 0.06 })
    );
    registerCanvasTexture(
      scene,
      'prop_ruin_day',
      extractProp(dayImg, { rx: 0.17, ry: 0.24, rw: 0.26, rh: 0.33, outW: 256, outH: 210, isNight: false, seedInteriorArch: true, bottomFadeRatio: 0.16 })
    );
    registerCanvasTexture(
      scene,
      'prop_banner_day',
      extractProp(dayImg, { rx: 0.89, ry: 0.56, rw: 0.095, rh: 0.27, outW: 112, outH: 192, isNight: false, bottomFadeRatio: 0.08 })
    );
    // 5. Day Floating Platform & Wildflower Grass Ground
    registerCanvasTexture(
      scene,
      'art_platform_day',
      extractPlatformArt(dayImg, { rx: 0.605, ry: 0.435, rw: 0.175, rh: 0.125, outW: 256, outH: 96, isNight: false })
    );
    registerCanvasTexture(
      scene,
      'art_ground_day',
      extractGroundStrip(dayImg, { rx: 0.21, ry: 0.835, rw: 0.24, rh: 0.165, outW: 512, outH: 128 })
    );
  }

  if (nightImg) {
    // 1. Night Sky (Full Moon + Starry Sky)
    registerCanvasTexture(scene, 'layer_sky_night', buildSkyLayer(nightImg, 1440, 560, true));
    // 2. Night Moonlit Mountains & Dark Gothic Castle (cropped cleanly past Moon, Castle framed upper-right)
    registerCanvasTexture(scene, 'layer_mountains_night', buildMountainsAndCastleLayer(nightImg, 1680, 400, true));
    // 3. Night Dark Blue & Purple Forest + Nighttime Waterfalls
    registerCanvasTexture(scene, 'layer_forest_night', buildForestWaterfallLayer(nightImg, true));
    // 4. Night Props (Purple Tree + Glowing Lantern, Ruins, Glowing Crystals)
    registerCanvasTexture(
      scene,
      'prop_tree_night',
      extractProp(nightImg, { rx: 0.0, ry: 0.02, rw: 0.255, rh: 0.80, outW: 270, outH: 440, isNight: true, protectLeftEdge: true, treeCanopyTrim: true, bottomFadeRatio: 0.06 })
    );
    registerCanvasTexture(
      scene,
      'prop_ruin_night',
      extractProp(nightImg, { rx: 0.17, ry: 0.24, rw: 0.26, rh: 0.33, outW: 256, outH: 210, isNight: true, seedInteriorArch: true, bottomFadeRatio: 0.16 })
    );
    registerCanvasTexture(
      scene,
      'prop_banner_night',
      extractProp(nightImg, { rx: 0.905, ry: 0.56, rw: 0.085, rh: 0.27, outW: 112, outH: 192, isNight: true, bottomFadeRatio: 0.08 })
    );
    registerCanvasTexture(
      scene,
      'prop_crystal_cyan',
      extractProp(nightImg, { rx: 0.252, ry: 0.625, rw: 0.072, rh: 0.105, outW: 96, outH: 84, isNight: true, bottomFadeRatio: 0.12 })
    );
    registerCanvasTexture(
      scene,
      'prop_crystal_amethyst',
      extractProp(nightImg, { rx: 0.025, ry: 0.715, rw: 0.08, rh: 0.105, outW: 100, outH: 86, isNight: true, bottomFadeRatio: 0.12 })
    );
    // 5. Night Floating Platform & Night Grass Ground
    registerCanvasTexture(
      scene,
      'art_platform_night',
      extractPlatformArt(nightImg, { rx: 0.635, ry: 0.445, rw: 0.175, rh: 0.125, outW: 256, outH: 96, isNight: true })
    );
    registerCanvasTexture(
      scene,
      'art_ground_night',
      extractGroundStrip(nightImg, { rx: 0.21, ry: 0.835, rw: 0.24, rh: 0.165, outW: 512, outH: 128 })
    );
  }

  return true;
}

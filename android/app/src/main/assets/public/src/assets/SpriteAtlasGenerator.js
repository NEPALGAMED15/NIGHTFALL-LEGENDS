function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

function registerSheet(scene, key, canvas, frameWidth, frameHeight) {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const tex = scene.textures.addCanvas(key, canvas);
  const cols = Math.floor(canvas.width / frameWidth);
  const rows = Math.floor(canvas.height / frameHeight);
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tex.add(idx, 0, c * frameWidth, r * frameHeight, frameWidth, frameHeight);
      idx++;
    }
  }
}

function drawOutlinedPoly(ctx, pts, fillStyle, strokeStyle = '#070910', lineWidth = 1.6) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function drawLimbSegment(ctx, x1, y1, x2, y2, width, fillStyle, outlineColor = '#070910') {
  ctx.lineCap = 'round';
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = width + 2.6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = fillStyle;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawKaelLeg(ctx, hipX, hipY, thighA, shinA, palette, isFront) {
  const thighLen = 11.5;
  const shinLen = 12.5;
  const kx = hipX + Math.sin(thighA) * thighLen;
  const ky = hipY + Math.cos(thighA) * thighLen;
  const fx = kx + Math.sin(shinA) * shinLen;
  const fy = ky + Math.cos(shinA) * shinLen;

  // Thigh
  drawLimbSegment(ctx, hipX, hipY, kx, ky, 5.4, isFront ? palette.pantsFront : palette.pantsBack);
  // Armored greave / shin
  drawLimbSegment(ctx, kx, ky, fx, fy, 4.8, isFront ? palette.armorDark : '#111622');

  // Silver shin trim highlight
  ctx.strokeStyle = isFront ? palette.silverBright : palette.silverMid;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(kx + 1.5, ky + 1);
  ctx.lineTo(fx + 1.5, fy - 2);
  ctx.stroke();

  // Silver knee guard
  drawOutlinedPoly(
    ctx,
    [
      [kx - 2.4, ky - 2.4],
      [kx + 3.4, ky - 1.5],
      [kx + 2.6, ky + 2.6],
      [kx - 2.0, ky + 2.0],
    ],
    isFront ? palette.silverBright : palette.silverMid,
    '#070910',
    1.1
  );

  // Armored boot foot
  const footDir = Math.cos(shinA) >= -0.2 ? 1 : -1;
  drawOutlinedPoly(
    ctx,
    [
      [fx - 2.8, fy - 2.6],
      [fx + 2.5, fy - 2.6],
      [fx + 6.4 * footDir, fy + 1.0],
      [fx + 6.0 * footDir, fy + 3.2],
      [fx - 3.2, fy + 3.2],
    ],
    isFront ? '#1c2434' : '#111622',
    '#070910',
    1.3
  );
  // Silver boot buckle/toe rim
  ctx.fillStyle = isFront ? palette.silverBright : palette.silverMid;
  ctx.fillRect(fx - 1, fy - 1.5, 4, 1.5);
}

function drawNightfangSword(ctx, hx, hy, angle, swordLen, palette) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle);

  // Soft electric-blue aura along Nightfang blade
  ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.beginPath();
  ctx.moveTo(5, -5.5);
  ctx.lineTo(10 + swordLen, -2.5);
  ctx.lineTo(16 + swordLen, 0);
  ctx.lineTo(10 + swordLen, 2.5);
  ctx.lineTo(5, 5.5);
  ctx.closePath();
  ctx.fill();

  // Pommel & leather-wrapped hilt
  ctx.fillStyle = '#070910';
  ctx.fillRect(-7.5, -2.4, 10, 4.8);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-6.5, -1.5, 8, 3);
  ctx.fillStyle = palette.silverBright;
  ctx.fillRect(-8, -2.2, 2.2, 4.4);

  // Ornate winged silver/dark crossguard
  drawOutlinedPoly(
    ctx,
    [
      [1, -6.8],
      [5.5, -4.5],
      [6.8, 0],
      [5.5, 4.5],
      [1, 6.8],
      [2.8, 0],
    ],
    palette.silverMid,
    '#070910',
    1.1
  );
  // Glowing cyan hilt gem
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(2.4, -1.4, 2.8, 2.8);

  // Glowing Nightfang Blade
  drawOutlinedPoly(
    ctx,
    [
      [5.5, -3.1],
      [5.5 + swordLen * 0.85, -2.5],
      [12.5 + swordLen, 0],
      [5.5 + swordLen * 0.85, 2.5],
      [5.5, 3.1],
    ],
    '#0284c7',
    '#071426',
    1.1
  );

  // Inner bright cyan energy bevel
  ctx.beginPath();
  ctx.moveTo(6.5, -1.6);
  ctx.lineTo(5.5 + swordLen * 0.84, -1.2);
  ctx.lineTo(10.5 + swordLen, 0);
  ctx.lineTo(5.5 + swordLen * 0.84, 1.2);
  ctx.lineTo(6.5, 1.6);
  ctx.closePath();
  ctx.fillStyle = '#38bdf8';
  ctx.fill();

  // Razor white-cyan core line
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(7, -0.7, swordLen * 0.84, 1.4);

  ctx.restore();
}

function drawKaelFrame(ctx, ox, oy, pose) {
  // 112x96 transparent frame: horizontal center at +56, boot soles grounded near +93
  const cx = ox + 56;
  const baseY = oy + 93;
  const {
    bob = 0,
    lean = 0,
    crouch = 0,
    thighB = 0.08,
    shinB = 0.05,
    thighF = -0.1,
    shinF = -0.05,
    scarfLift = 0,
    scarfWave = 0,
    scarfReach = 1.0,
    swordAngle = 0.42,
    swordLen = 30,
    handX = 8,
    handY = -27,
    offArmX = -8,
    offArmY = -25,
    slashArc = 0, // 0 none, 1 downward, 2 reverse upward, 3 wide heavy finisher
    slashAlpha = 0.9,
    dashTrail = false,
    landDust = false,
    doubleSpin = 0,
    hurt = false,
    victory = false,
    defeat = 0,
  } = pose;

  const p = hurt
    ? {
        armorDark: '#451a1a',
        armorMid: '#7f1d1d',
        pantsFront: '#2b1215',
        pantsBack: '#1c0a0d',
        silverMid: '#fca5a5',
        silverBright: '#fee2e2',
        scarfMain: '#f87171',
        scarfDark: '#991b1b',
        scarfBright: '#fecaca',
      }
    : {
        armorDark: '#161c28',
        armorMid: '#232c3d',
        pantsFront: '#131823',
        pantsBack: '#0c1018',
        silverMid: '#64748b',
        silverBright: '#cbd5e1',
        scarfMain: '#dc2626',
        scarfDark: '#7f1d1d',
        scarfBright: '#f87171',
      };

  ctx.save();
  ctx.translate(cx, baseY + bob);

  if (defeat > 0) {
    ctx.translate(defeat * 4, defeat * 20);
    ctx.rotate(defeat * 0.85);
  }
  if (doubleSpin !== 0) {
    ctx.translate(0, -30);
    ctx.rotate(doubleSpin);
    ctx.translate(0, 30);
  }

  const hipY = -25 + crouch * 9;
  const hipX = lean * 0.25;
  const shoulderY = hipY - 20 + crouch * 2;
  const shoulderX = lean;

  // Dash speed beams behind Kael
  if (dashTrail) {
    const grad = ctx.createLinearGradient(-48, 0, 12, 0);
    grad.addColorStop(0, 'rgba(2, 132, 199, 0)');
    grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.72)');
    grad.addColorStop(1, 'rgba(224, 242, 254, 0.95)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-48, shoulderY - 8);
    ctx.lineTo(10, shoulderY - 14);
    ctx.lineTo(16, shoulderY + 18);
    ctx.lineTo(-42, shoulderY + 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(-44, shoulderY - 5, 22, 2);
    ctx.fillRect(-38, shoulderY + 6, 18, 2);
    ctx.fillRect(-46, hipY + 4, 24, 1.8);
  }

  // Twin billowing red scarf tails (behind body)
  const w1 = Math.sin(scarfWave) * 3.5;
  const w2 = Math.cos(scarfWave + 1.1) * 4;
  const sReach = 18 * scarfReach + (dashTrail ? 18 : 0);

  // Lower scarf ribbon
  drawOutlinedPoly(
    ctx,
    [
      [shoulderX - 2, shoulderY + 1],
      [shoulderX - 11 - sReach * 0.5, shoulderY + 7 - scarfLift * 0.4 + w2 * 0.5],
      [shoulderX - 18 - sReach, shoulderY + 15 - scarfLift * 0.8 + w2],
      [shoulderX - 11 - sReach * 0.7, shoulderY + 19 - scarfLift * 0.7 + w2],
      [shoulderX - 5 - sReach * 0.4, shoulderY + 14 - scarfLift * 0.3],
      [shoulderX - 1, shoulderY + 7],
    ],
    p.scarfDark,
    '#070910',
    1.3
  );

  // Upper main billowing red scarf tail with split notched tip
  drawOutlinedPoly(
    ctx,
    [
      [shoulderX - 2, shoulderY - 2],
      [shoulderX - 12 - sReach * 0.55, shoulderY - 2 - scarfLift * 0.6 + w1 * 0.5],
      [shoulderX - 22 - sReach, shoulderY + 1 - scarfLift + w1],
      [shoulderX - 17 - sReach * 0.8, shoulderY + 6 - scarfLift * 0.85 + w1],
      [shoulderX - 24 - sReach * 0.92, shoulderY + 10 - scarfLift * 0.9 + w1],
      [shoulderX - 10 - sReach * 0.45, shoulderY + 9 - scarfLift * 0.4 + w1 * 0.4],
      [shoulderX, shoulderY + 5],
    ],
    p.scarfMain,
    '#070910',
    1.4
  );
  // Scarf rim highlight
  ctx.strokeStyle = p.scarfBright;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 5, shoulderY);
  ctx.lineTo(shoulderX - 18 - sReach * 0.75, shoulderY - scarfLift * 0.8 + w1 * 0.8);
  ctx.stroke();

  // Trailing crimson waist sash ribbons
  drawOutlinedPoly(
    ctx,
    [
      [hipX - 4, hipY],
      [hipX - 12 - scarfReach * 3, hipY + 13 + w1 * 0.4],
      [hipX - 7 - scarfReach * 2, hipY + 15 + w1 * 0.4],
      [hipX, hipY + 3],
    ],
    p.scarfMain,
    '#070910',
    1.1
  );

  // Back Arm
  drawLimbSegment(ctx, shoulderX - 5, shoulderY + 2, shoulderX + offArmX, shoulderY + offArmY + 20, 4.4, '#111622');
  ctx.fillStyle = p.silverMid;
  ctx.fillRect(shoulderX + offArmX - 2, shoulderY + offArmY + 17, 4, 4);

  // Back Leg
  drawKaelLeg(ctx, hipX - 3, hipY, thighB, shinB, p, false);

  // Front Leg
  drawKaelLeg(ctx, hipX + 3, hipY, thighF, shinF, p, true);

  // Torso Armor (Black Nightwalker coat + silver trim & cyan chest gem)
  drawOutlinedPoly(
    ctx,
    [
      [shoulderX - 8, shoulderY - 2],
      [shoulderX + 8, shoulderY - 2],
      [hipX + 6.5, hipY + 3],
      [hipX - 6.5, hipY + 3],
    ],
    p.armorDark,
    '#070910',
    1.6
  );

  // Silver V-plate trim on chest
  ctx.strokeStyle = p.silverBright;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 5.5, shoulderY + 1);
  ctx.lineTo(shoulderX + 1, shoulderY + 9);
  ctx.lineTo(shoulderX + 6.5, shoulderY + 1);
  ctx.stroke();

  // Glowing cyan diamond chest core
  drawOutlinedPoly(
    ctx,
    [
      [shoulderX + 2, shoulderY + 5],
      [shoulderX + 4.8, shoulderY + 8.5],
      [shoulderX + 2, shoulderY + 12],
      [shoulderX - 0.8, shoulderY + 8.5],
    ],
    '#38bdf8',
    '#070910',
    0.9
  );
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(shoulderX + 1.2, shoulderY + 7.4, 1.6, 2.2);

  // Crimson waist sash & silver buckle + chain detail
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(hipX - 6.5, hipY - 3, 13, 4);
  ctx.fillStyle = p.scarfMain;
  ctx.fillRect(hipX - 5.5, hipY - 2.5, 11, 2.5);
  ctx.fillStyle = p.silverBright;
  ctx.fillRect(hipX - 1.5, hipY - 3, 4, 4);
  // Subtle silver hip chain
  ctx.strokeStyle = p.silverMid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hipX - 5, hipY + 1);
  ctx.quadraticCurveTo(hipX, hipY + 5, hipX + 5, hipY + 1);
  ctx.stroke();

  // Thick layered red scarf collar around neck
  drawOutlinedPoly(
    ctx,
    [
      [shoulderX - 8.5, shoulderY - 5],
      [shoulderX + 8.5, shoulderY - 4.5],
      [shoulderX + 7, shoulderY + 2.5],
      [shoulderX - 7.5, shoulderY + 2.5],
    ],
    p.scarfMain,
    '#070910',
    1.5
  );
  ctx.strokeStyle = p.scarfDark;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 6, shoulderY - 1);
  ctx.quadraticCurveTo(shoulderX + 1, shoulderY + 1.5, shoulderX + 6, shoulderY - 1.5);
  ctx.stroke();

  // Head: Fair brow, fierce crimson eyes, dark lower-face mask, dark spiky hair
  const headX = shoulderX + 1;
  const headY = shoulderY - 11;

  // Face base + dark tactical mask
  drawOutlinedPoly(
    ctx,
    [
      [headX - 6, headY - 6],
      [headX + 6.5, headY - 6],
      [headX + 6.5, headY + 4],
      [headX + 1, headY + 6],
      [headX - 6, headY + 4],
    ],
    '#eed0be',
    '#070910',
    1.4
  );
  // Dark lower face mask covering nose & jaw
  drawOutlinedPoly(
    ctx,
    [
      [headX - 5.5, headY - 0.5],
      [headX + 6.2, headY - 1.2],
      [headX + 6.2, headY + 4],
      [headX + 1, headY + 5.8],
      [headX - 5.5, headY + 4],
    ],
    '#111827',
    '#070910',
    0.8
  );
  // Mask crease highlight
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headX - 2, headY + 1.5);
  ctx.lineTo(headX + 4.5, headY + 0.5);
  ctx.stroke();

  // Fierce Crimson Red Eye
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(headX + 1.2, headY - 3.2, 4.2, 2.2);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(headX + 2.2, headY - 3.2, 2.6, 2.2);
  ctx.fillStyle = '#fecaca';
  ctx.fillRect(headX + 2.8, headY - 2.9, 1.0, 1.0);
  // Angled dark eyebrow
  ctx.strokeStyle = '#070910';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(headX + 0.5, headY - 4.3);
  ctx.lineTo(headX + 5.8, headY - 3.3);
  ctx.stroke();

  // Spiky Black-Navy Hair
  drawOutlinedPoly(
    ctx,
    [
      [headX - 8, headY - 2],
      [headX - 11, headY - 7],
      [headX - 7, headY - 8],
      [headX - 9, headY - 13],
      [headX - 2, headY - 11.5],
      [headX + 1, headY - 15],
      [headX + 4.5, headY - 11],
      [headX + 9.5, headY - 12],
      [headX + 7.5, headY - 7],
      [headX + 10, headY - 5],
      [headX + 5.5, headY - 3.8],
      [headX + 3, headY - 5.2],
      [headX + 0.5, headY - 3.5],
      [headX - 2.5, headY - 4.8],
      [headX - 4.5, headY - 1.2],
    ],
    '#0b0f19',
    '#05070c',
    1.2
  );
  // Subtle midnight-slate hair lock sheen
  ctx.strokeStyle = '#253147';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(headX - 4, headY - 9.5);
  ctx.lineTo(headX + 1, headY - 12.2);
  ctx.lineTo(headX + 5, headY - 8.5);
  ctx.stroke();

  // Front Sword Hand Coordinates & Nightfang Blade
  const actualHandX = shoulderX + handX;
  const actualHandY = victory ? shoulderY - 14 : handY + crouch * 8;
  const actualSwordAngle = victory ? -Math.PI / 2 + 0.15 : swordAngle;

  // Front Pauldron (Silver & gunmetal spiked shoulder armor)
  drawOutlinedPoly(
    ctx,
    [
      [shoulderX - 7.5, shoulderY - 5.5],
      [shoulderX + 2.5, shoulderY - 6],
      [shoulderX + 4.5, shoulderY + 1],
      [shoulderX - 6.5, shoulderY + 2],
    ],
    '#2a3447',
    '#070910',
    1.4
  );
  ctx.strokeStyle = p.silverBright;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 6.5, shoulderY - 4.5);
  ctx.lineTo(shoulderX + 2, shoulderY - 5);
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(shoulderX - 2.5, shoulderY - 3, 2, 2);

  // Front Sword Arm & Silver Bracer
  drawLimbSegment(ctx, shoulderX - 1, shoulderY + 1, actualHandX, actualHandY, 4.8, p.armorMid);
  ctx.fillStyle = p.silverBright;
  ctx.fillRect(actualHandX - 2.5, actualHandY - 2.5, 5, 5);

  // Nightfang Sword
  drawNightfangSword(ctx, actualHandX, actualHandY, actualSwordAngle, swordLen, p);

  // Landing dust clouds beside boots
  if (landDust) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
    ctx.beginPath();
    ctx.ellipse(-16, -2, 7, 3.2, -0.15, 0, Math.PI * 2);
    ctx.ellipse(-23, -4, 4.5, 2.4, -0.2, 0, Math.PI * 2);
    ctx.ellipse(16, -2, 7, 3.2, 0.15, 0, Math.PI * 2);
    ctx.ellipse(23, -4, 4.5, 2.4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sweeping Electric-Blue Crescent Slash Arcs (Attack 1, Attack 2, Combo 3)
  if (slashArc > 0) {
    ctx.save();
    ctx.globalAlpha = slashAlpha;
    if (slashArc === 1) {
      // Attack 1: crisp forward sweeping downward arc
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(8, -28, 34, -1.25, 0.75);
      ctx.stroke();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(10, -28, 34, -1.1, 0.72);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(12, -28, 33, -0.9, 0.65);
      ctx.stroke();
    } else if (slashArc === 2) {
      // Attack 2: wide reverse crescent slash
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(10, -26, 37, -1.45, 0.92);
      ctx.stroke();
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.arc(12, -26, 36, -1.25, 0.85);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(14, -26, 35, -1.0, 0.75);
      ctx.stroke();
    } else if (slashArc === 3) {
      // Attack 3 / Combo Finisher: huge dual-ring Nightfang moon crescent
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.arc(8, -27, 42, -1.75, 1.05);
      ctx.stroke();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(11, -27, 41, -1.55, 0.98);
      ctx.stroke();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(13, -27, 40, -1.35, 0.9);
      ctx.stroke();
      // Subtle forward shock sparks
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(45, -36, 7, 2);
      ctx.fillRect(48, -20, 8, 2);
    }
    ctx.restore();
  }

  ctx.restore();
}

function generateKaelSheet(scene) {
  const fw = 112;
  const fh = 96;
  const cols = 6;
  const rows = 14;
  const { canvas, ctx } = makeCanvas(fw * cols, fh * rows);

  // Row 0: Idle (0..3)
  [
    { bob: 0, scarfWave: 0.0, swordAngle: 0.48, handX: 7, handY: -29 },
    { bob: 0.8, scarfWave: 1.5, scarfLift: 2, swordAngle: 0.51, handX: 7, handY: -28 },
    { bob: 1.4, scarfWave: 3.1, scarfLift: 3, swordAngle: 0.53, handX: 7, handY: -28 },
    { bob: 0.6, scarfWave: 4.6, scarfLift: 1, swordAngle: 0.49, handX: 7, handY: -29 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 0 * fh, p));

  // Row 1: Walk (6..11) — measured athletic stride
  [
    { bob: 0, lean: 2, thighB: 0.35, shinB: 0.45, thighF: -0.35, shinF: -0.25, scarfWave: 0.2, scarfLift: 3, scarfReach: 1.1, swordAngle: 0.62, handX: 8, handY: -28, offArmX: -9 },
    { bob: -1.5, lean: 2.5, thighB: 0.15, shinB: 0.3, thighF: -0.15, shinF: 0.05, scarfWave: 1.2, scarfLift: 4, scarfReach: 1.15, swordAngle: 0.58, handX: 7, handY: -28, offArmX: -7 },
    { bob: -0.5, lean: 2.5, thighB: -0.3, shinB: -0.15, thighF: 0.32, shinF: 0.4, scarfWave: 2.3, scarfLift: 4, scarfReach: 1.15, swordAngle: 0.54, handX: 6, handY: -29, offArmX: -5 },
    { bob: 0, lean: 2, thighB: -0.36, shinB: -0.25, thighF: 0.36, shinF: 0.44, scarfWave: 3.4, scarfLift: 3, scarfReach: 1.1, swordAngle: 0.56, handX: 6, handY: -28, offArmX: -5 },
    { bob: -1.5, lean: 2.5, thighB: -0.12, shinB: 0.05, thighF: 0.14, shinF: 0.28, scarfWave: 4.5, scarfLift: 4, scarfReach: 1.15, swordAngle: 0.6, handX: 7, handY: -28, offArmX: -7 },
    { bob: -0.5, lean: 2.5, thighB: 0.28, shinB: 0.38, thighF: -0.3, shinF: -0.15, scarfWave: 5.5, scarfLift: 3, scarfReach: 1.1, swordAngle: 0.64, handX: 8, handY: -29, offArmX: -9 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 1 * fh, p));

  // Row 2: Run (12..17) — deep athletic dash-stride, Nightfang swept backward
  [
    { bob: 0, lean: 6, thighB: 0.62, shinB: 0.95, thighF: -0.65, shinF: -0.4, scarfWave: 0.4, scarfLift: 12, scarfReach: 1.5, swordAngle: 2.55, handX: -3, handY: -27, offArmX: 9, offArmY: -29 },
    { bob: -3, lean: 7, thighB: 0.3, shinB: 0.65, thighF: -0.32, shinF: 0.15, scarfWave: 1.4, scarfLift: 14, scarfReach: 1.6, swordAngle: 2.6, handX: -4, handY: -28, offArmX: 10, offArmY: -30 },
    { bob: -1.5, lean: 6.5, thighB: -0.55, shinB: -0.3, thighF: 0.58, shinF: 0.9, scarfWave: 2.5, scarfLift: 13, scarfReach: 1.55, swordAngle: 2.65, handX: -3, handY: -27, offArmX: 7, offArmY: -27 },
    { bob: 0, lean: 6, thighB: -0.65, shinB: -0.4, thighF: 0.62, shinF: 0.92, scarfWave: 3.6, scarfLift: 12, scarfReach: 1.5, swordAngle: 2.58, handX: -2, handY: -27, offArmX: 6, offArmY: -26 },
    { bob: -3, lean: 7, thighB: -0.28, shinB: 0.12, thighF: 0.3, shinF: 0.65, scarfWave: 4.7, scarfLift: 14, scarfReach: 1.6, swordAngle: 2.52, handX: -3, handY: -28, offArmX: 8, offArmY: -29 },
    { bob: -1.5, lean: 6.5, thighB: 0.55, shinB: 0.85, thighF: -0.55, shinF: -0.3, scarfWave: 5.7, scarfLift: 13, scarfReach: 1.55, swordAngle: 2.55, handX: -4, handY: -27, offArmX: 9, offArmY: -29 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 2 * fh, p));

  // Row 3: Jump (18..20)
  [
    { bob: 2, crouch: 0.55, lean: 3, thighB: 0.35, shinB: 0.75, thighF: -0.45, shinF: 0.25, scarfLift: 2, swordAngle: 0.8, handX: 7, handY: -27 },
    { bob: -4, lean: 4, thighB: 0.42, shinB: 0.88, thighF: -0.78, shinF: 0.2, scarfLift: -6, scarfReach: 1.25, swordAngle: 2.2, handX: -2, handY: -31, offArmX: 9, offArmY: -34 },
    { bob: -7, lean: 3, thighB: 0.35, shinB: 0.95, thighF: -0.88, shinF: 0.28, scarfLift: -9, scarfReach: 1.3, swordAngle: 2.35, handX: -3, handY: -32, offArmX: 10, offArmY: -36 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 3 * fh, p));

  // Row 4: Fall (24..26)
  [
    { bob: -3, lean: 1.5, thighB: 0.22, shinB: 0.55, thighF: -0.42, shinF: -0.08, scarfLift: 20, scarfWave: 0.5, scarfReach: 1.35, swordAngle: 0.95, handX: 8, handY: -31, offArmX: -11, offArmY: -36 },
    { bob: -2, lean: 2, thighB: 0.28, shinB: 0.6, thighF: -0.36, shinF: -0.02, scarfLift: 23, scarfWave: 2.1, scarfReach: 1.4, swordAngle: 1.05, handX: 9, handY: -30, offArmX: -12, offArmY: -37 },
    { bob: -2.5, lean: 1.5, thighB: 0.2, shinB: 0.52, thighF: -0.45, shinF: -0.1, scarfLift: 21, scarfWave: 4.0, scarfReach: 1.35, swordAngle: 0.98, handX: 8, handY: -31, offArmX: -11, offArmY: -36 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 4 * fh, p));

  // Row 5: Double Jump (30..32)
  [
    { bob: -5, crouch: 0.3, doubleSpin: 0.8, scarfLift: 12, swordAngle: -0.5, handX: 6, handY: -32 },
    { bob: -6, crouch: 0.3, doubleSpin: 2.7, scarfLift: 14, swordAngle: -0.5, handX: 6, handY: -32 },
    { bob: -5, crouch: 0.25, doubleSpin: 4.7, scarfLift: 12, swordAngle: -0.5, handX: 6, handY: -32 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 5 * fh, p));

  // Row 6: Land (36..38) — heavy crouch impact + boot dust puffs
  [
    { bob: 1, crouch: 0.95, lean: 5, thighB: 0.52, shinB: 0.85, thighF: -0.58, shinF: 0.22, scarfLift: 8, scarfReach: 1.25, swordAngle: 0.72, handX: 9, handY: -22, offArmX: -10, offArmY: -24, landDust: true },
    { bob: 0.5, crouch: 0.6, lean: 3, thighB: 0.32, shinB: 0.55, thighF: -0.38, shinF: 0.08, scarfLift: 5, scarfReach: 1.15, swordAngle: 0.62, handX: 8, handY: -25, offArmX: -8, offArmY: -26, landDust: true },
    { bob: 0, crouch: 0.2, lean: 1.5, thighB: 0.14, shinB: 0.2, thighF: -0.18, shinF: -0.05, scarfLift: 2, scarfReach: 1.05, swordAngle: 0.52, handX: 7, handY: -28 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 6 * fh, p));

  // Row 7: Attack 1 (42..45) — Crisp downward Nightfang cleave + electric-blue arc
  [
    { lean: -2, thighB: 0.25, shinB: 0.35, thighF: -0.32, shinF: -0.15, swordAngle: -2.2, handX: 2, handY: -44, scarfLift: 5, offArmX: 8, offArmY: -29 },
    { lean: 7, crouch: 0.2, thighB: 0.55, shinB: 0.65, thighF: -0.58, shinF: 0.05, swordAngle: 0.08, swordLen: 34, handX: 13, handY: -29, slashArc: 1, slashAlpha: 0.98, scarfLift: 12, scarfReach: 1.4, offArmX: -9, offArmY: -26 },
    { lean: 8, crouch: 0.25, thighB: 0.6, shinB: 0.7, thighF: -0.62, shinF: 0.08, swordAngle: 0.62, swordLen: 33, handX: 12, handY: -25, slashArc: 1, slashAlpha: 0.85, scarfLift: 11, scarfReach: 1.35, offArmX: -10, offArmY: -25 },
    { lean: 4, crouch: 0.1, thighB: 0.28, shinB: 0.35, thighF: -0.32, shinF: -0.1, swordAngle: 0.78, handX: 9, handY: -26, slashArc: 1, slashAlpha: 0.48, scarfLift: 6, scarfReach: 1.15 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 7 * fh, p));

  // Row 8: Attack 2 (48..51) — Reverse rising/wide Nightfang arc
  [
    { lean: 1, crouch: 0.25, thighB: 0.35, shinB: 0.55, thighF: -0.4, shinF: 0.1, swordAngle: 1.35, handX: 5, handY: -24, scarfLift: 6 },
    { lean: 8, crouch: 0.15, thighB: 0.62, shinB: 0.72, thighF: -0.65, shinF: -0.05, swordAngle: -0.25, swordLen: 35, handX: 14, handY: -31, slashArc: 2, slashAlpha: 0.98, scarfLift: 14, scarfReach: 1.45, offArmX: -10, offArmY: -27 },
    { lean: 8, crouch: 0.1, thighB: 0.58, shinB: 0.68, thighF: -0.6, shinF: -0.08, swordAngle: -0.78, swordLen: 34, handX: 12, handY: -35, slashArc: 2, slashAlpha: 0.84, scarfLift: 12, scarfReach: 1.35, offArmX: -11, offArmY: -26 },
    { lean: 3, thighB: 0.25, shinB: 0.3, thighF: -0.28, shinF: -0.1, swordAngle: 0.35, handX: 9, handY: -29, slashArc: 2, slashAlpha: 0.45, scarfLift: 6 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 8 * fh, p));

  // Row 9: Combo Attack 3 (54..58) — Heavy forward Nightfang finisher + wide twin crescent
  [
    { lean: -4, crouch: 0.3, thighB: 0.45, shinB: 0.65, thighF: -0.35, shinF: 0.15, swordAngle: -2.45, handX: 0, handY: -45, scarfLift: 9, scarfReach: 1.25 },
    { lean: 5, crouch: 0.15, thighB: 0.55, shinB: 0.65, thighF: -0.58, shinF: 0.02, swordAngle: -0.85, swordLen: 35, handX: 11, handY: -37, scarfLift: 13, scarfReach: 1.45 },
    { lean: 10, crouch: 0.32, thighB: 0.72, shinB: 0.85, thighF: -0.75, shinF: 0.05, swordAngle: 0.12, swordLen: 37, handX: 15, handY: -27, slashArc: 3, slashAlpha: 1.0, scarfLift: 16, scarfReach: 1.6, offArmX: -12, offArmY: -26 },
    { lean: 9, crouch: 0.28, thighB: 0.68, shinB: 0.8, thighF: -0.72, shinF: 0.06, swordAngle: 0.58, swordLen: 36, handX: 14, handY: -25, slashArc: 3, slashAlpha: 0.86, scarfLift: 14, scarfReach: 1.5, offArmX: -11, offArmY: -25 },
    { lean: 4, crouch: 0.1, thighB: 0.3, shinB: 0.35, thighF: -0.32, shinF: -0.08, swordAngle: 0.75, handX: 9, handY: -26, slashArc: 3, slashAlpha: 0.45, scarfLift: 7 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 9 * fh, p));

  // Row 10: Dash (60..62) — High-velocity horizontal blue energy surge
  [
    { lean: 11, crouch: 0.35, thighB: 0.78, shinB: 1.05, thighF: -0.72, shinF: -0.1, scarfLift: 18, scarfReach: 1.85, swordAngle: 2.75, handX: -4, handY: -26, offArmX: 11, offArmY: -26, dashTrail: true },
    { lean: 13, crouch: 0.38, thighB: 0.85, shinB: 1.12, thighF: -0.78, shinF: -0.15, scarfLift: 20, scarfReach: 1.95, swordAngle: 2.82, handX: -5, handY: -25, offArmX: 12, offArmY: -25, dashTrail: true },
    { lean: 10, crouch: 0.3, thighB: 0.72, shinB: 0.98, thighF: -0.68, shinF: -0.08, scarfLift: 17, scarfReach: 1.75, swordAngle: 2.7, handX: -4, handY: -27, offArmX: 10, offArmY: -27, dashTrail: true },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 10 * fh, p));

  // Row 11: Hurt (66..67)
  [
    { lean: -6, bob: -2, hurt: true, thighB: 0.18, shinB: 0.32, thighF: -0.25, shinF: 0.05, scarfLift: 9, scarfReach: 1.2, swordAngle: 1.1, handX: 5, handY: -24, offArmX: -10, offArmY: -30 },
    { lean: -3, bob: 0, hurt: false, thighB: 0.12, shinB: 0.2, thighF: -0.18, shinF: -0.02, scarfLift: 5, scarfReach: 1.1, swordAngle: 0.9, handX: 6, handY: -26 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 11 * fh, p));

  // Row 12: Victory (72..75) — Heroic raised Nightfang pose
  [
    { bob: 0, victory: true, thighB: 0.12, shinB: 0.12, thighF: -0.18, shinF: -0.18, scarfWave: 0.2, scarfLift: 7, scarfReach: 1.25, handX: 8, offArmX: -8, offArmY: -27 },
    { bob: -2, victory: true, thighB: 0.14, shinB: 0.14, thighF: -0.2, shinF: -0.2, scarfWave: 1.7, scarfLift: 10, scarfReach: 1.35, handX: 8, offArmX: -9, offArmY: -28 },
    { bob: -3, victory: true, thighB: 0.14, shinB: 0.14, thighF: -0.2, shinF: -0.2, scarfWave: 3.3, scarfLift: 12, scarfReach: 1.4, handX: 8, offArmX: -9, offArmY: -28 },
    { bob: -1.5, victory: true, thighB: 0.12, shinB: 0.12, thighF: -0.18, shinF: -0.18, scarfWave: 4.8, scarfLift: 9, scarfReach: 1.3, handX: 8, offArmX: -8, offArmY: -27 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 12 * fh, p));

  // Row 13: Defeat (78..81)
  [
    { defeat: 0.22, crouch: 0.5, scarfLift: 4, swordAngle: 1.2, handX: 6, handY: -22 },
    { defeat: 0.55, crouch: 0.8, scarfLift: 2, swordAngle: 1.4, handX: 5, handY: -19, landDust: true },
    { defeat: 0.85, crouch: 0.9, scarfLift: 0, swordAngle: 1.5, handX: 4, handY: -17 },
    { defeat: 0.95, crouch: 0.95, scarfLift: 0, swordAngle: 1.55, handX: 4, handY: -16 },
  ].forEach((p, i) => drawKaelFrame(ctx, i * fw, 13 * fh, p));

  registerSheet(scene, 'kael', canvas, fw, fh);
}

function generateEnemySheets(scene) {
  // 1. Blight Stalker (fast corrupted hound/beast, 56x48)
  {
    const fw = 56, fh = 48;
    const { canvas, ctx } = makeCanvas(fw * 6, fh * 2);
    for (let i = 0; i < 12; i++) {
      const ox = (i % 6) * fw;
      const oy = Math.floor(i / 6) * fh;
      const stride = Math.sin(i * 1.4) * 5;
      const isWindup = i === 6 || i === 7;
      const isAttack = i === 8 || i === 9;
      const isHurt = i === 10;
      const isDead = i === 11;
      ctx.save();
      ctx.translate(ox + 28, oy + 42);
      if (isDead) ctx.globalAlpha = 0.45;
      // Body
      ctx.fillStyle = isHurt ? '#fca5a5' : isWindup ? '#fb7185' : '#2c223b';
      ctx.fillRect(-16, -20 + (isDead ? 8 : 0), 30, 14);
      // Spines
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(-12, -24, 4, 4);
      ctx.fillRect(-4, -25, 4, 5);
      ctx.fillRect(4, -24, 4, 4);
      // Head & jaws
      ctx.fillStyle = isAttack ? '#ef4444' : '#3b2d52';
      ctx.fillRect(10, -24, 14, 12);
      ctx.fillStyle = isWindup ? '#fde047' : '#f43f5e';
      ctx.fillRect(16, -21, 4, 3);
      // Legs
      ctx.fillStyle = '#1b1426';
      ctx.fillRect(-13 + stride, -8, 5, 8);
      ctx.fillRect(6 - stride, -8, 5, 8);
      ctx.restore();
    }
    registerSheet(scene, 'blight_stalker', canvas, fw, fh);
  }

  // 2. Spore Wisp (floating ranged kiter, 48x48)
  {
    const fw = 48, fh = 48;
    const { canvas, ctx } = makeCanvas(fw * 6, fh);
    for (let i = 0; i < 6; i++) {
      const ox = i * fw;
      const bob = Math.sin(i * 1.2) * 3;
      const charging = i === 2 || i === 3;
      const hurt = i === 4;
      ctx.save();
      ctx.translate(ox + 24, 24 + bob);
      if (i === 5) ctx.globalAlpha = 0.4;
      // Cap
      ctx.fillStyle = hurt ? '#fecaca' : charging ? '#a855f7' : '#0f766e';
      ctx.beginPath();
      ctx.arc(0, -4, 14, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#5eead4';
      ctx.fillRect(-7, -11, 4, 4);
      ctx.fillRect(3, -10, 3, 3);
      // Core
      ctx.fillStyle = charging ? '#f0abfc' : '#1e293b';
      ctx.fillRect(-6, -4, 12, 14);
      ctx.fillStyle = charging ? '#ffffff' : '#2dd4bf';
      ctx.fillRect(-3, 0, 2, 3);
      ctx.fillRect(2, 0, 2, 3);
      // Tendrils
      ctx.fillStyle = '#14b8a6';
      ctx.fillRect(-5, 10, 2, 6);
      ctx.fillRect(0, 10, 2, 8);
      ctx.fillRect(4, 10, 2, 5);
      ctx.restore();
    }
    registerSheet(scene, 'spore_wisp', canvas, fw, fh);
  }

  // 3. Bramble Sentinel (shielded heavy guardian, 64x64)
  {
    const fw = 64, fh = 64;
    const { canvas, ctx } = makeCanvas(fw * 6, fh * 2);
    for (let i = 0; i < 12; i++) {
      const ox = (i % 6) * fw;
      const oy = Math.floor(i / 6) * fh;
      const step = Math.sin(i * 1.1) * 3;
      const windup = i >= 6 && i <= 7;
      const slam = i >= 8 && i <= 9;
      const hurt = i === 10;
      ctx.save();
      ctx.translate(ox + 32, oy + 58);
      if (i === 11) ctx.globalAlpha = 0.4;
      // Armored torso
      ctx.fillStyle = hurt ? '#fca5a5' : '#2d3a2f';
      ctx.fillRect(-14, -44, 28, 30);
      // Horned helm
      ctx.fillStyle = '#475569';
      ctx.fillRect(-10, -54, 20, 12);
      ctx.fillStyle = windup ? '#facc15' : '#ef4444';
      ctx.fillRect(2, -50, 5, 3);
      // Heavy Shield on front
      ctx.fillStyle = slam ? '#f97316' : '#64748b';
      ctx.fillRect(10, -44 + (windup ? -6 : 0), 8, 32);
      ctx.fillStyle = '#d4a656';
      ctx.fillRect(12, -38 + (windup ? -6 : 0), 4, 20);
      // Legs
      ctx.fillStyle = '#1e2420';
      ctx.fillRect(-10 + step, -14, 7, 14);
      ctx.fillRect(3 - step, -14, 7, 14);
      ctx.restore();
    }
    registerSheet(scene, 'bramble_sentinel', canvas, fw, fh);
  }

  // 4. Corrupted Treant Mini-Boss (84x88)
  {
    const fw = 84, fh = 88;
    const { canvas, ctx } = makeCanvas(fw * 6, fh);
    for (let i = 0; i < 6; i++) {
      const ox = i * fw;
      const bob = Math.sin(i) * 2;
      const windup = i === 2;
      const cleave = i === 3;
      ctx.save();
      ctx.translate(ox + 42, 82 + bob);
      if (i === 5) ctx.globalAlpha = 0.4;
      ctx.fillStyle = i === 4 ? '#fecaca' : '#3a271c';
      ctx.fillRect(-18, -62, 36, 50);
      // Bark crown
      ctx.fillStyle = '#14532d';
      ctx.fillRect(-24, -74, 48, 16);
      // Glowing corrupted eyes & core
      ctx.fillStyle = windup ? '#fde047' : '#a855f7';
      ctx.fillRect(-8, -52, 5, 4);
      ctx.fillRect(4, -52, 5, 4);
      ctx.fillRect(-6, -34, 12, 12);
      // Huge branch arm
      ctx.fillStyle = cleave ? '#f43f5e' : '#4b3325';
      ctx.fillRect(14, windup ? -72 : cleave ? -32 : -48, 16, 26);
      // Roots
      ctx.fillStyle = '#291a12';
      ctx.fillRect(-20, -14, 12, 14);
      ctx.fillRect(8, -14, 12, 14);
      ctx.restore();
    }
    registerSheet(scene, 'corrupted_treant', canvas, fw, fh);
  }
}

function generateBossSheet(scene) {
  // Multi-pose Boss Sheet (128x128, 8 frames) adaptable to Root Warden & all 7 Kingdom Bosses
  const fw = 128, fh = 128;
  const { canvas, ctx } = makeCanvas(fw * 8, fh);

  for (let i = 0; i < 8; i++) {
    const ox = i * fw;
    const bob = Math.sin(i * 1.1) * 3;
    const windup = i === 2 || i === 3;
    const slam = i === 4;
    const rage = i === 5;
    const hurt = i === 6;
    const defeat = i === 7;

    ctx.save();
    ctx.translate(ox + 64, 118 + bob + (defeat ? 16 : 0));
    if (defeat) {
      ctx.globalAlpha = 0.55;
      ctx.rotate(0.25);
    }

    // Back antlers / crown
    ctx.fillStyle = hurt ? '#fecaca' : rage ? '#7c3aed' : '#2d4a36';
    ctx.beginPath();
    ctx.moveTo(-26, -86);
    ctx.lineTo(-42, -112);
    ctx.lineTo(-14, -92);
    ctx.lineTo(14, -92);
    ctx.lineTo(42, -112);
    ctx.lineTo(26, -86);
    ctx.closePath();
    ctx.fill();

    // Massive Bark / Mantle Torso
    ctx.fillStyle = hurt ? '#fca5a5' : '#2a221c';
    ctx.fillRect(-30, -88, 60, 68);
    ctx.fillStyle = '#3f3229';
    ctx.fillRect(-24, -84, 48, 58);

    // Glowing Core & Runes
    ctx.fillStyle = windup ? '#fde047' : slam ? '#f43f5e' : rage ? '#c084fc' : '#2dd4bf';
    ctx.beginPath();
    ctx.arc(0, -52, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3, -55, 6, 6);

    // Glowing Eyes
    ctx.fillStyle = windup ? '#facc15' : '#38f2d2';
    ctx.fillRect(-14, -76, 8, 5);
    ctx.fillRect(6, -76, 8, 5);

    // Giant Arms (raised on windup, slammed down on slam)
    const armY = windup ? -96 : slam ? -30 : -64;
    ctx.fillStyle = hurt ? '#f87171' : '#382a20';
    ctx.fillRect(-48, armY, 18, 42);
    ctx.fillRect(30, armY, 18, 42);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(-44, armY + 32, 10, 6);
    ctx.fillRect(34, armY + 32, 10, 6);

    // Root legs
    ctx.fillStyle = '#1e1712';
    ctx.fillRect(-26, -22, 18, 22);
    ctx.fillRect(8, -22, 18, 22);

    ctx.restore();
  }

  registerSheet(scene, 'boss_sheet', canvas, fw, fh);
}

function generateEnvironmentAndVfx(scene) {
  // Ground tile (64x64)
  {
    const { canvas, ctx } = makeCanvas(64, 64);
    ctx.fillStyle = '#241a14';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#35261c';
    ctx.fillRect(4, 16, 22, 14);
    ctx.fillRect(34, 22, 24, 16);
    ctx.fillRect(14, 40, 28, 16);
    ctx.fillStyle = '#1b130e';
    ctx.fillRect(42, 46, 18, 12);
    ctx.fillRect(8, 2, 18, 10);
    scene.textures.addCanvas('tile_ground', canvas);
  }

  // Platform tile (64x24)
  {
    const { canvas, ctx } = makeCanvas(64, 24);
    ctx.fillStyle = '#332820';
    ctx.fillRect(0, 6, 64, 18);
    ctx.fillStyle = '#1f1712';
    ctx.fillRect(6, 12, 20, 6);
    ctx.fillRect(36, 12, 20, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 7);
    scene.textures.addCanvas('tile_platform', canvas);
  }

  // Breakable Crate (40x40, 2 frames)
  {
    const { canvas, ctx } = makeCanvas(80, 40);
    for (let f = 0; f < 2; f++) {
      const ox = f * 40;
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(ox + 2, 2, 36, 36);
      ctx.strokeStyle = '#3e2411';
      ctx.lineWidth = 3;
      ctx.strokeRect(ox + 3, 3, 34, 34);
      ctx.beginPath();
      ctx.moveTo(ox + 4, 4);
      ctx.lineTo(ox + 36, 36);
      ctx.moveTo(ox + 36, 4);
      ctx.lineTo(ox + 4, 36);
      ctx.stroke();
      if (f === 1) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox + 18, 4);
        ctx.lineTo(ox + 12, 20);
        ctx.lineTo(ox + 24, 34);
        ctx.stroke();
      }
    }
    registerSheet(scene, 'crate_sheet', canvas, 40, 40);
  }

  // Checkpoint Shrine (48x72, 2 frames: dormant & lit)
  {
    const { canvas, ctx } = makeCanvas(96, 72);
    for (let f = 0; f < 2; f++) {
      const ox = f * 48;
      ctx.fillStyle = '#334155';
      ctx.fillRect(ox + 12, 56, 24, 16);
      ctx.fillRect(ox + 17, 22, 14, 36);
      ctx.fillStyle = '#475569';
      ctx.fillRect(ox + 10, 18, 28, 8);
      if (f === 1) {
        ctx.fillStyle = '#2dd4bf';
        ctx.beginPath();
        ctx.arc(ox + 24, 12, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ox + 24, 12, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(ox + 24, 12, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    registerSheet(scene, 'checkpoint_sheet', canvas, 48, 72);
  }

  // Rune Switch (40x44, 2 frames)
  {
    const { canvas, ctx } = makeCanvas(80, 44);
    for (let f = 0; f < 2; f++) {
      const ox = f * 40;
      ctx.fillStyle = '#334155';
      ctx.fillRect(ox + 8, 30, 24, 14);
      ctx.fillStyle = f === 1 ? '#38f2d2' : '#f43f5e';
      ctx.beginPath();
      ctx.arc(ox + 20, 20, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 18, 15, 4, 10);
    }
    registerSheet(scene, 'rune_switch', canvas, 40, 44);
  }

  // Collectibles (32x32, 3 frames: shard, gem, heal)
  {
    const { canvas, ctx } = makeCanvas(96, 32);
    // 0: Moon Shard
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(16, 3);
    ctx.lineTo(25, 16);
    ctx.lineTo(16, 29);
    ctx.lineTo(7, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(14, 10, 4, 10);

    // 1: Soul Gem
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(48, 2);
    ctx.lineTo(60, 12);
    ctx.lineTo(56, 28);
    ctx.lineTo(40, 28);
    ctx.lineTo(36, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fae8ff';
    ctx.fillRect(45, 9, 6, 8);

    // 2: Heal Orb
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(80, 16, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(78, 10, 4, 12);
    ctx.fillRect(74, 14, 12, 4);

    registerSheet(scene, 'collectibles_sheet', canvas, 32, 32);
  }

  // Exit Portal (64x96, 4 frames)
  {
    const { canvas, ctx } = makeCanvas(256, 96);
    for (let f = 0; f < 4; f++) {
      const ox = f * 64;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(ox + 8, 82, 48, 14);
      ctx.strokeStyle = '#38f2d2';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(ox + 32, 46, 18 + (f % 2) * 2, 34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 242, 210, 0.35)';
      ctx.beginPath();
      ctx.ellipse(ox + 32, 46, 13, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 30, 22 + f * 6, 4, 12);
    }
    registerSheet(scene, 'exit_portal', canvas, 64, 96);
  }

  // Thorn Spikes (32x20)
  {
    const { canvas, ctx } = makeCanvas(32, 20);
    ctx.fillStyle = '#991b1b';
    for (let x = 0; x < 32; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x + 4, 2);
      ctx.lineTo(x + 8, 20);
      ctx.closePath();
      ctx.fill();
    }
    scene.textures.addCanvas('spikes', canvas);
  }

  // Soul Strike Crescent Projectile (36x44)
  {
    const { canvas, ctx } = makeCanvas(36, 44);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(10, 22, 18, -1.1, 1.1);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(12, 22, 16, -0.9, 0.9);
    ctx.stroke();
    scene.textures.addCanvas('soul_wave', canvas);
  }

  // Enemy / Boss Orb (20x20)
  {
    const { canvas, ctx } = makeCanvas(20, 20);
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(10, 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(10, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    scene.textures.addCanvas('enemy_orb', canvas);
  }

  // Generic soft particle dot (12x12)
  {
    const { canvas, ctx } = makeCanvas(12, 12);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(6, 6, 5, 0, Math.PI * 2);
    ctx.fill();
    scene.textures.addCanvas('particle_dot', canvas);
  }

  // Locked Gate texture (36x150)
  {
    const { canvas, ctx } = makeCanvas(36, 150);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, 36, 150);
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(4, 0, 6, 150);
    ctx.fillRect(16, 0, 6, 150);
    ctx.fillRect(28, 0, 6, 150);
    ctx.fillStyle = '#10b981';
    for (let y = 14; y < 140; y += 26) {
      ctx.fillRect(2, y, 32, 6);
    }
    scene.textures.addCanvas('gate_locked', canvas);
  }

  // Seamless Parallax Far Forest Band (512x512 POT, white silhouette so tintable for Day/Night)
  {
    const { canvas, ctx } = makeCanvas(512, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.beginPath();
    ctx.moveTo(0, 512);
    ctx.lineTo(0, 412);
    ctx.quadraticCurveTo(128, 362, 256, 407);
    ctx.quadraticCurveTo(384, 447, 512, 412);
    ctx.lineTo(512, 512);
    ctx.closePath();
    ctx.fill();

    const pines = [36, 108, 178, 248, 322, 405, 474];
    pines.forEach((px, idx) => {
      const topY = 235 + (idx % 3) * 34;
      const w = 44 + (idx % 2) * 14;
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      for (let tier = 0; tier < 4; tier++) {
        const ty = topY + tier * 42;
        const tw = w * (0.45 + tier * 0.25);
        ctx.beginPath();
        ctx.moveTo(px, ty);
        ctx.lineTo(px + tw, ty + 58);
        ctx.lineTo(px - tw, ty + 58);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillRect(px - 6, topY + 120, 12, 512 - (topY + 120));
    });
    scene.textures.addCanvas('tree_far_band', canvas);
  }

  // Seamless Parallax Mid Ancient Oaks & Roots Band (512x512 POT, tintable silhouette)
  {
    const { canvas, ctx } = makeCanvas(512, 512);
    const trees = [64, 210, 368, 468];
    trees.forEach((tx, idx) => {
      const h = 235 + (idx % 2) * 55;
      const baseY = 512;
      const topY = baseY - h;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.moveTo(tx - 24, baseY);
      ctx.quadraticCurveTo(tx - 11, baseY - h * 0.4, tx - 9, topY + 30);
      ctx.lineTo(tx + 9, topY + 30);
      ctx.quadraticCurveTo(tx + 12, baseY - h * 0.4, tx + 24, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(tx - 6, topY + 75);
      ctx.lineTo(tx - 48, topY + 35);
      ctx.lineTo(tx - 42, topY + 46);
      ctx.lineTo(tx - 6, topY + 90);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(tx + 6, topY + 62);
      ctx.lineTo(tx + 52, topY + 24);
      ctx.lineTo(tx + 46, topY + 36);
      ctx.lineTo(tx + 6, topY + 78);
      ctx.closePath();
      ctx.fill();

      const lobes = [
        [tx, topY + 18, 42, 24],
        [tx - 38, topY + 32, 30, 19],
        [tx + 40, topY + 28, 32, 20],
        [tx - 18, topY + 5, 28, 18],
        [tx + 20, topY + 8, 26, 17],
      ];
      lobes.forEach(([lx, ly, rx, ry]) => {
        ctx.beginPath();
        ctx.ellipse(lx, ly, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    scene.textures.addCanvas('tree_mid_band', canvas);
  }
}

export function generateAllSpritesAndAnimations(scene) {
  generateKaelSheet(scene);
  generateEnemySheets(scene);
  generateBossSheet(scene);
  generateEnvironmentAndVfx(scene);

  const anims = scene.anims;
  const safeCreate = (cfg) => {
    if (!anims.exists(cfg.key)) anims.create(cfg);
  };

  // Kael animations (all 14 rows: 6 cols per row)
  safeCreate({ key: 'kael_idle', frames: anims.generateFrameNumbers('kael', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
  safeCreate({ key: 'kael_walk', frames: anims.generateFrameNumbers('kael', { start: 6, end: 11 }), frameRate: 9, repeat: -1 });
  safeCreate({ key: 'kael_run', frames: anims.generateFrameNumbers('kael', { start: 12, end: 17 }), frameRate: 13, repeat: -1 });
  safeCreate({ key: 'kael_jump', frames: anims.generateFrameNumbers('kael', { start: 18, end: 20 }), frameRate: 10, repeat: 0 });
  safeCreate({ key: 'kael_fall', frames: anims.generateFrameNumbers('kael', { start: 24, end: 26 }), frameRate: 8, repeat: -1 });
  safeCreate({ key: 'kael_double_jump', frames: anims.generateFrameNumbers('kael', { start: 30, end: 32 }), frameRate: 15, repeat: 0 });
  safeCreate({ key: 'kael_land', frames: anims.generateFrameNumbers('kael', { start: 36, end: 38 }), frameRate: 16, repeat: 0 });
  safeCreate({ key: 'kael_attack1', frames: anims.generateFrameNumbers('kael', { start: 42, end: 45 }), frameRate: 15, repeat: 0 });
  safeCreate({ key: 'kael_attack2', frames: anims.generateFrameNumbers('kael', { start: 48, end: 51 }), frameRate: 15, repeat: 0 });
  safeCreate({ key: 'kael_combo_attack', frames: anims.generateFrameNumbers('kael', { start: 54, end: 58 }), frameRate: 16, repeat: 0 });
  safeCreate({ key: 'kael_dash', frames: anims.generateFrameNumbers('kael', { start: 60, end: 62 }), frameRate: 16, repeat: -1 });
  safeCreate({ key: 'kael_hurt', frames: anims.generateFrameNumbers('kael', { start: 66, end: 67 }), frameRate: 10, repeat: 0 });
  safeCreate({ key: 'kael_victory', frames: anims.generateFrameNumbers('kael', { start: 72, end: 75 }), frameRate: 6, repeat: -1 });
  safeCreate({ key: 'kael_defeat', frames: anims.generateFrameNumbers('kael', { start: 78, end: 81 }), frameRate: 7, repeat: 0 });

  // Enemy animations
  safeCreate({ key: 'stalker_idle', frames: anims.generateFrameNumbers('blight_stalker', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
  safeCreate({ key: 'stalker_run', frames: anims.generateFrameNumbers('blight_stalker', { start: 2, end: 5 }), frameRate: 11, repeat: -1 });
  safeCreate({ key: 'stalker_windup', frames: anims.generateFrameNumbers('blight_stalker', { start: 6, end: 7 }), frameRate: 8, repeat: 0 });
  safeCreate({ key: 'stalker_attack', frames: anims.generateFrameNumbers('blight_stalker', { start: 8, end: 9 }), frameRate: 12, repeat: 0 });

  safeCreate({ key: 'wisp_idle', frames: anims.generateFrameNumbers('spore_wisp', { start: 0, end: 1 }), frameRate: 5, repeat: -1 });
  safeCreate({ key: 'wisp_charge', frames: anims.generateFrameNumbers('spore_wisp', { start: 2, end: 3 }), frameRate: 8, repeat: 0 });

  safeCreate({ key: 'sentinel_idle', frames: anims.generateFrameNumbers('bramble_sentinel', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
  safeCreate({ key: 'sentinel_walk', frames: anims.generateFrameNumbers('bramble_sentinel', { start: 2, end: 5 }), frameRate: 7, repeat: -1 });
  safeCreate({ key: 'sentinel_windup', frames: anims.generateFrameNumbers('bramble_sentinel', { start: 6, end: 7 }), frameRate: 7, repeat: 0 });
  safeCreate({ key: 'sentinel_attack', frames: anims.generateFrameNumbers('bramble_sentinel', { start: 8, end: 9 }), frameRate: 11, repeat: 0 });

  safeCreate({ key: 'treant_idle', frames: anims.generateFrameNumbers('corrupted_treant', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
  safeCreate({ key: 'treant_windup', frames: [{ key: 'corrupted_treant', frame: 2 }], frameRate: 4, repeat: 0 });
  safeCreate({ key: 'treant_attack', frames: [{ key: 'corrupted_treant', frame: 3 }], frameRate: 8, repeat: 0 });

  // Portal animation
  safeCreate({ key: 'portal_spin', frames: anims.generateFrameNumbers('exit_portal', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
}

import { INK } from '../core/constants.js';

/*
 * Stick figure skeleton. Angles are measured from "straight down":
 * 0 = down, +PI/2 = forward (toward facing), PI = up, negative = backward.
 * Lengths are for scale 1 (≈60px tall figure).
 */
const THIGH = 12, SHIN = 12, TORSO = 22, NECK = 8, HEAD = 6.5, UPPER = 10, FORE = 10;

const seg = (x, y, a, len, f) => [x + Math.sin(a) * len * f, y + Math.cos(a) * len];

function stroke(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

/** Poses for legs/arms while walking at phase p. */
export function walkLegs(p, stride = 0.55) {
  const a = Math.sin(p) * stride;
  const b = -a;
  return [
    [a, a - 0.6 * Math.max(0, Math.cos(p))],
    [b, b - 0.6 * Math.max(0, -Math.cos(p))],
  ];
}
export const walkArms = (p, swing = 0.5) => [
  [-Math.sin(p) * swing, -Math.sin(p) * swing + 0.4],
  [Math.sin(p) * swing, Math.sin(p) * swing + 0.4],
];
export const STAND_LEGS = [[0.2, 0.12], [-0.2, -0.12]];

/** Converts a canvas angle (0 = right, +y down) into a skeleton limb angle. */
export const limbAngle = (theta, f = 1) => Math.atan2(Math.cos(theta) * f, Math.sin(theta));

/** Torso joints of a figure without drawing it, so arms can be posed toward points first. */
export function skeleton(o) {
  const s = o.s ?? 1;
  const f = o.f ?? 1;
  const lean = o.lean ?? 0;
  const legs = o.legs ?? STAND_LEGS;
  // Lift the hip so the lowest foot touches the ground.
  const drop = (l) => (Math.cos(l[0]) * THIGH + Math.cos(l[1]) * SHIN) * s;
  const hip = [o.x, o.y - Math.max(drop(legs[0]), drop(legs[1])) + (o.crouch ?? 0) * s];
  const neck = [hip[0] + Math.sin(lean) * TORSO * s * f, hip[1] - Math.cos(lean) * TORSO * s];
  const head = [neck[0] + Math.sin(lean) * NECK * s * f, neck[1] - Math.cos(lean) * NECK * s];
  const sh = [neck[0] + (hip[0] - neck[0]) * 0.12, neck[1] + (hip[1] - neck[1]) * 0.12];
  return { hip, neck, head, sh };
}

/**
 * Two-bone arm reaching from the shoulder toward a canvas point. The elbow bends toward
 * (bx, by); returns skeleton limb angles for drawFigure's armF/armB.
 */
export function reachArm(sh, target, s, bx, by, f = 1) {
  const l1 = UPPER * s;
  const l2 = FORE * s;
  let dx = target[0] - sh[0];
  let dy = target[1] - sh[1];
  const d0 = Math.hypot(dx, dy) || 1e-6;
  const d = Math.min(l1 + l2 - 0.01 * s, Math.max(Math.abs(l1 - l2) + 0.5 * s, d0));
  dx /= d0;
  dy /= d0;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const side = -dy * bx + dx * by >= 0 ? 1 : -1;
  const elbow = [sh[0] + dx * along - dy * h * side, sh[1] + dy * along + dx * h * side];
  const hand = [sh[0] + dx * d, sh[1] + dy * d];
  const ang = (a, b) => Math.atan2((b[0] - a[0]) * f, b[1] - a[1]);
  return [ang(sh, elbow), ang(elbow, hand)];
}

/**
 * Draws a stick figure standing on (x, y) and returns joint positions so
 * callers can attach weapons, hats, capes...
 * o: { x, y, s, f, color, lw, legs, armF, armB, lean, crouch }
 */
export function drawFigure(ctx, o) {
  const s = o.s ?? 1;
  const f = o.f ?? 1;
  const color = o.color ?? INK;
  const legs = o.legs ?? STAND_LEGS;
  const armF = o.armF ?? [0.25, 0.5];
  const armB = o.armB ?? [-0.2, 0.2];
  const { hip, neck, head, sh } = skeleton(o);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = (o.lw ?? 3.2) * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const limb = (start, a1, a2, l1, l2) => {
    const mid = seg(start[0], start[1], a1, l1 * s, f);
    const end = seg(mid[0], mid[1], a2, l2 * s, f);
    stroke(ctx, [start, mid, end]);
    return [mid, end];
  };

  const [elbowB, handB] = limb(sh, armB[0], armB[1], UPPER, FORE);
  const [kneeB, footB] = limb(hip, legs[1][0], legs[1][1], THIGH, SHIN);
  const [kneeF, footF] = limb(hip, legs[0][0], legs[0][1], THIGH, SHIN);
  stroke(ctx, [hip, neck]);
  // Clothing goes between the back arm and the front arm, under the head
  if (o.body) {
    o.body({ hip, neck, head, sh, elbowB, handB, kneeB, footB, kneeF, footF, s, f, headR: HEAD * s });
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = (o.lw ?? 3.2) * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  const [elbowF, handF] = limb(sh, armF[0], armF[1], UPPER, FORE);

  ctx.beginPath();
  ctx.arc(head[0], head[1], HEAD * s, 0, Math.PI * 2);
  ctx.fill();

  return { hip, neck, head, sh, elbowF, handF, elbowB, handB, kneeB, footB, kneeF, footF, s, f, headR: HEAD * s };
}

/**
 * drawFigure with its hands placed on canvas points instead of limb angles:
 * o.reachF / o.reachB = { to: [x, y], bend: [bx, by] } (the elbow bends toward bend).
 * Either may be left out to fall back to o.armF / o.armB.
 */
export function drawPosed(ctx, o) {
  const s = o.s ?? 1;
  const f = o.f ?? 1;
  const { sh } = skeleton(o);
  const arm = (r, fallback) => (r ? reachArm(sh, r.to, s, r.bend[0], r.bend[1], f) : fallback);
  return drawFigure(ctx, { ...o, armF: arm(o.reachF, o.armF), armB: arm(o.reachB, o.armB) });
}

/** Small helper for weapons: a line from a hand at an angle (canvas radians). */
export function drawStick(ctx, x, y, angle, len, width, color = INK) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
  ctx.stroke();
}

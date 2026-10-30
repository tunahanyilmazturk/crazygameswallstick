import { INK } from '../core/constants.js';

const TAU = Math.PI * 2;

function ellipse(ctx, x, y, rx, ry, color, rot = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

function tri(ctx, a, b, c, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.lineTo(...c);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function eye(ctx, x, y, color = '#ffe08a') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 1.3, 0, TAU);
  ctx.fill();
}

function legs(ctx, xs, y, h, color, stride) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  xs.forEach((x, i) => {
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + Math.sin(stride + i * 2) * 2, y);
  });
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
}

/** A canine: the wolf and the fox differ in colour and tail. */
function canine(ctx, t, moving, coat, belly, tailTip) {
  const stride = moving ? t * 14 : 0;
  const wag = Math.sin(t * (moving ? 12 : 3)) * 3;
  legs(ctx, [-9, -5, 7, 10], 0, 9, coat, stride);
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(-12, -12);
  ctx.quadraticCurveTo(-24, -12 + wag, -27, -20 + wag);
  ctx.quadraticCurveTo(-21, -9, -11, -7);
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, -27, -20 + wag, 3, 3, tailTip);
  ellipse(ctx, 0, -12, 14, 7, coat);
  ellipse(ctx, 1, -9, 9, 3, belly);
  ellipse(ctx, 14, -18, 6.5, 6, coat);
  tri(ctx, [10, -22], [11, -30], [15, -23], coat);
  tri(ctx, [15, -23], [17, -30], [19, -21], coat);
  tri(ctx, [18, -21], [27, -16], [18, -14], belly);
  ellipse(ctx, 27, -16, 1.5, 1.5, INK);
  eye(ctx, 16, -19);
}

function bird(ctx, t, body, wingColor, face, big) {
  const flap = Math.sin(t * 11) * 0.9;
  ctx.save();
  ctx.scale(big, big);
  tri(ctx, [-9, 0], [-18, -3], [-16, 5], wingColor);
  ctx.save();
  ctx.translate(-2, -3);
  ctx.rotate(-1.1 - flap);
  ellipse(ctx, 11, 0, 12, 4.5, wingColor);
  ctx.restore();
  ellipse(ctx, 0, 0, 10, 7, body);
  ellipse(ctx, 9, -5, 5.5, 5.5, body);
  ctx.save();
  ctx.translate(2, -3);
  ctx.rotate(0.9 + flap);
  ellipse(ctx, -11, 0, 12, 4.5, wingColor);
  ctx.restore();
  face();
  ctx.restore();
}

const ART = {
  wolf: (ctx, t, moving) => canine(ctx, t, moving, '#7c8290', '#c9ced6', '#c9ced6'),
  fox: (ctx, t, moving) => canine(ctx, t, moving, '#d97a2e', '#f4e6cf', '#f4e6cf'),
  hawk: (ctx, t) => bird(ctx, t, '#8a5a30', '#5a3a20', () => {
    tri(ctx, [13, -7], [19, -3], [13, -2], '#e2b33c');
    eye(ctx, 10, -6);
  }, 1),
  owl: (ctx, t) => bird(ctx, t, '#a58a68', '#6b5640', () => {
    tri(ctx, [6, -10], [6, -15], [10, -10], '#6b5640');
    tri(ctx, [11, -10], [14, -15], [14, -8], '#6b5640');
    ellipse(ctx, 8, -6, 2.6, 2.6, '#f4e6cf');
    ellipse(ctx, 12.5, -6, 2.6, 2.6, '#f4e6cf');
    eye(ctx, 8.5, -6, INK);
    eye(ctx, 13, -6, INK);
    tri(ctx, [10, -4.5], [12, -4.5], [11, -2], '#e2b33c');
  }, 1),
  turtle: (ctx, t, moving) => {
    const stride = moving ? t * 6 : 0;
    legs(ctx, [-10, 10], 0, 5, '#6a7a4a', stride);
    ellipse(ctx, 19, -8 + Math.sin(t * 1.5), 6, 5, '#7a8a52');
    eye(ctx, 21, -9, INK);
    tri(ctx, [-16, -6], [-23, -3], [-15, -2], '#6a7a4a');
    ctx.fillStyle = '#5a6a6e';
    ctx.beginPath();
    ctx.arc(0, -5, 17, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.moveTo(-8, -5);
    ctx.lineTo(-5, -19);
    ctx.moveTo(8, -5);
    ctx.lineTo(5, -19);
    ctx.moveTo(-5, -14);
    ctx.lineTo(5, -14);
    ctx.stroke();
    ctx.strokeStyle = INK;
  },
  drake: (ctx, t, moving) => {
    const stride = moving ? t * 12 : 0;
    const flap = Math.sin(t * 5) * 0.4;
    legs(ctx, [-6, 7], 0, 8, '#8a3226', stride);
    ctx.fillStyle = '#8a3226';
    ctx.beginPath();
    ctx.moveTo(-11, -12);
    ctx.quadraticCurveTo(-24, -10, -28, -2);
    ctx.quadraticCurveTo(-20, -7, -10, -6);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(-2, -16);
    ctx.rotate(-0.9 - flap);
    tri(ctx, [0, 0], [-4, -19], [14, -11], '#5a2020');
    ctx.restore();
    ellipse(ctx, 0, -12, 13, 8, '#a83c2a');
    ellipse(ctx, 2, -8, 8, 3.5, '#e0a84a');
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#a83c2a';
    ctx.beginPath();
    ctx.moveTo(10, -16);
    ctx.lineTo(14, -24);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = INK;
    ellipse(ctx, 17, -27, 7, 5, '#a83c2a');
    tri(ctx, [13, -31], [8, -37], [17, -32], '#e8dcc0');
    tri(ctx, [21, -29], [29, -26], [21, -24], '#a83c2a');
    eye(ctx, 19, -28);
  },
};

/** One pet at (x, y), feet on y; `f` is 1 facing right, -1 left. */
export function drawPet(ctx, id, x, y, t, { f = 1, s = 1, moving = false } = {}) {
  const art = ART[id];
  if (!art) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(f * s, s);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  art(ctx, t, moving);
  ctx.restore();
}

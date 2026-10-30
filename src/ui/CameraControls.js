import { clamp } from '../utils/math.js';

const DRAG_THRESHOLD = 8; // px of movement before a press becomes a drag instead of a tap

/**
 * Camera panning for the wide battlefield + village:
 *  - drag (mouse or finger) to slide, with momentum on release; a press without movement is a tap
 *  - ← / → keys held down
 *  - mouse wheel / trackpad
 * On-screen arrow buttons live in the HUD and call game.setPan() directly.
 */
export function initCameraControls(canvas, game) {
  let drag = null;

  const worldPerPx = () => game.view.w / canvas.getBoundingClientRect().width;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    game.audio.unlock();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: game.cam.offset, moved: false, lastX: e.clientX, lastT: performance.now() };
    // A press on the battlefield fires at once and keeps firing while held
    drag.aiming = game.aimAt(e.clientX, e.clientY);
    game.cam.vel = 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone — drag still works while it stays over the canvas */
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (drag.aiming && !drag.moved) game.aimAt(e.clientX, e.clientY); // follow the pointer while holding fire
    if (!drag.moved) {
      // Holding fire on the field sweeps the aim instead of panning the camera
      if (drag.aiming || Math.abs(dx) < DRAG_THRESHOLD || game.cam.max <= 0) return;
      drag.moved = true;
      game.cam.dragging = true;
      game.cam.goto = null;
      canvas.classList.add('dragging');
    }
    const k = worldPerPx();
    // Dragging right reveals what is to the left, i.e. a larger offset
    game.cam.offset = clamp(drag.start + dx * k, 0, game.cam.max);
    game.applyCamera();
    // Flick velocity, sampled over at least ~16ms and smoothed so one jittery event can't fling the view
    const now = performance.now();
    const dt = (now - drag.lastT) / 1000;
    if (dt >= 0.016) {
      const inst = ((e.clientX - drag.lastX) * k) / dt;
      game.cam.vel = game.cam.vel * 0.4 + inst * 0.6;
      drag.lastX = e.clientX;
      drag.lastT = now;
    }
  });

  const end = (e, tap) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.aiming) game.releaseAim();
    else if (!drag.moved && tap) game.tapAt(drag.x, drag.y);
    // Keep the flick velocity only if the finger was still moving when released
    if (performance.now() - drag.lastT > 80) game.cam.vel = 0;
    game.cam.vel = clamp(game.cam.vel, -2500, 2500);
    game.cam.dragging = false;
    canvas.classList.remove('dragging');
    drag = null;
  };
  canvas.addEventListener('pointerup', (e) => end(e, true));
  canvas.addEventListener('pointercancel', (e) => end(e, false));

  canvas.addEventListener('wheel', (e) => {
    if (game.cam.max <= 0) return;
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    game.cam.goto = null;
    game.cam.vel = 0;
    // Scrolling down / right moves toward the battle
    game.cam.offset = clamp(game.cam.offset - d * 0.9, 0, game.cam.max);
    game.applyCamera();
  }, { passive: false });

  const held = new Set();
  const syncKeys = () => game.setPan((held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0));
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    held.add(e.key);
    syncKeys();
  });
  window.addEventListener('keyup', (e) => {
    if (!held.delete(e.key)) return;
    syncKeys();
  });
  window.addEventListener('blur', () => {
    held.clear();
    game.setPan(0);
  });
}

// First-person walker: pointer-lock mouse look + WASD, or touch stick + drag look.
import * as THREE from 'three';

const EYE = 1.7;          // eye height above ground (m)
const TOUCH_LOOK = 0.0042;

export class Player {
  constructor(camera, canvas, heightAt, opts = {}) {
    this.camera = camera;
    this.canvas = canvas;
    this.heightAt = heightAt;
    this.bound = opts.bound || 1180;
    this.walkSpeed = opts.walk || 9;
    this.runSpeed = opts.run || 22;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;           // radians, 0 = facing -Z (north)
    this.pitch = 0;
    this.keys = new Set();
    this.stick = { active: false, x: 0, y: 0 };
    this.enabled = false;
    this.locked = false;
    this._vel = new THREE.Vector3();
    this._bob = 0;

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
  }

  place(x, z, yawDeg = 0) {
    this.pos.set(x, this.heightAt(x, z) + EYE, z);
    this.yaw = THREE.MathUtils.degToRad(yawDeg);
    this.pitch = 0;
    this._sync();
  }

  _bindKeyboard() {
    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  _bindMouse() {
    this.canvas.addEventListener('click', () => {
      if (this.enabled && !this.locked && !document.body.classList.contains('touch')) {
        this.canvas.requestPointerLock?.();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0026;
      this.pitch -= e.movementY * 0.0026;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.25, 1.25);
    });
  }

  _bindTouch() {
    const zone = document.getElementById('stick-zone');
    const base = document.getElementById('stick-base');
    const nub = document.getElementById('stick-nub');
    let stickId = null, cx = 0, cy = 0;
    let lookId = null, lx = 0, ly = 0;

    const isTouchLike = matchMedia('(pointer: coarse)').matches;
    if (isTouchLike) document.body.classList.add('touch');

    zone.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      if (stickId !== null) return;
      stickId = t.identifier; cx = t.clientX; cy = t.clientY;
      base.style.display = 'block';
      base.style.left = (cx - 55) + 'px'; base.style.top = (cy - 55) + 'px';
      e.preventDefault();
    }, { passive: false });

    addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          const dx = t.clientX - cx, dy = t.clientY - cy;
          const len = Math.hypot(dx, dy), max = 48;
          const k = len > max ? max / len : 1;
          this.stick.x = (dx * k) / max; this.stick.y = (dy * k) / max;
          this.stick.active = true;
          nub.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
        } else if (t.identifier === lookId) {
          this.yaw -= (t.clientX - lx) * TOUCH_LOOK;
          this.pitch = THREE.MathUtils.clamp(this.pitch - (t.clientY - ly) * TOUCH_LOOK, -1.25, 1.25);
          lx = t.clientX; ly = t.clientY;
        }
      }
      if (stickId !== null || lookId !== null) e.preventDefault();
    }, { passive: false });

    const endTouch = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null; this.stick.active = false; this.stick.x = this.stick.y = 0;
          base.style.display = 'none'; nub.style.transform = 'translate(-50%,-50%)';
        }
        if (t.identifier === lookId) lookId = null;
      }
    };
    addEventListener('touchend', endTouch);
    addEventListener('touchcancel', endTouch);

    // right-half drag = look
    this.canvas.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId && lookId === null && t.clientX > innerWidth * 0.4) {
          lookId = t.identifier; lx = t.clientX; ly = t.clientY;
        }
      }
    });
  }

  update(dt) {
    if (!this.enabled) return;
    let fwd = 0, strafe = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
    if (this.stick.active) { fwd -= this.stick.y; strafe += this.stick.x; }

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      || (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.92);  // full stick = run
    const speed = running ? this.runSpeed : this.walkSpeed;
    const len = Math.hypot(fwd, strafe);
    if (len > 1) { fwd /= len; strafe /= len; }

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward is -Z rotated by yaw
    this._vel.set(
      (-sin * fwd + cos * strafe) * speed,
      0,
      (-cos * fwd - sin * strafe) * speed
    );
    this.pos.x += this._vel.x * dt;
    this.pos.z += this._vel.z * dt;

    // keep inside world bounds
    const B = this.bound;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -B, B);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -B, B);

    // glide over terrain
    const groundY = this.heightAt(this.pos.x, this.pos.z) + EYE;
    this.pos.y += (groundY - this.pos.y) * Math.min(1, dt * 10);

    // subtle head bob while moving
    const moving = len > 0.01 || this.stick.active;
    if (moving) this._bob += dt * (running ? 11 : 7.5);
    const bobY = moving ? Math.sin(this._bob) * 0.045 : 0;

    this._sync(bobY);
  }

  _sync(bobY = 0) {
    this.camera.position.set(this.pos.x, this.pos.y + bobY, this.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }

  headingDeg() {
    let d = (-THREE.MathUtils.radToDeg(this.yaw)) % 360;
    if (d < 0) d += 360;
    return d; // 0 = North (-Z)
  }
}

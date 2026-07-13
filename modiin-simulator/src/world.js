// Terrain, sky, sun and day/night for the Judean foothills.
import * as THREE from 'three';
import { WORLD, TERRAIN, ROADS } from './data/city-data.js';

const GRID = 220; // heightmap resolution

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.night = false;
    this._buildHeightmap();
    this._buildSky();
    this._buildLights();
    this._buildGround();
    this.setNight(false, true);
  }

  // ── heightfield ──────────────────────────────────────
  _buildHeightmap() {
    const S = WORLD.size, half = S / 2, N = GRID;
    const h = new Float32Array(N * N);

    // gentle rolling base (deterministic sines — the Judean shephelah)
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * S - half;
        const z = (j / (N - 1)) * S - half;
        let y = TERRAIN.base
          + 6.0 * Math.sin(x * 0.0021 + 1.3) * Math.cos(z * 0.0017 - 0.6)
          + 3.2 * Math.sin(x * 0.0052 - 2.1) * Math.sin(z * 0.0046 + 0.9)
          + 1.2 * Math.sin(x * 0.013 + z * 0.011);
        for (const hill of TERRAIN.hills) {
          const d2 = (x - hill.x) ** 2 + (z - hill.z) ** 2;
          y += hill.h * Math.exp(-d2 / (2 * hill.r * hill.r));
        }
        h[j * N + i] = y;
      }
    }

    // flat plots for landmarks (sampled from the raw field at their centre)
    this._h = h; this._N = N; this._S = S;
    for (const f of (TERRAIN.flats || [])) {
      const cy = (f.y !== undefined) ? f.y : this.heightAt(f.x, f.z);
      const r2 = 2 * f.r * f.r;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * S - half, z = (j / (N - 1)) * S - half;
          const d2 = (x - f.x) ** 2 + (z - f.z) ** 2;
          if (d2 > r2 * 4) continue;
          const k = Math.exp(-d2 / r2);
          h[j * N + i] = h[j * N + i] * (1 - k) + cy * k;
        }
      }
    }

    // Safdie's plan: boulevards run in the valleys — carve/flatten terrain along roads
    const flat = (pts, width, drop) => {
      const w2 = (width * 2.6) ** 2;
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
        const minx = Math.min(ax, bx) - width * 4, maxx = Math.max(ax, bx) + width * 4;
        const minz = Math.min(az, bz) - width * 4, maxz = Math.max(az, bz) + width * 4;
        const i0 = Math.max(0, Math.floor((minx + half) / S * (N - 1)));
        const i1 = Math.min(N - 1, Math.ceil((maxx + half) / S * (N - 1)));
        const j0 = Math.max(0, Math.floor((minz + half) / S * (N - 1)));
        const j1 = Math.min(N - 1, Math.ceil((maxz + half) / S * (N - 1)));
        const abx = bx - ax, abz = bz - az, ab2 = abx * abx + abz * abz || 1;
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const x = (i / (N - 1)) * S - half, z = (j / (N - 1)) * S - half;
            let t = ((x - ax) * abx + (z - az) * abz) / ab2;
            t = Math.max(0, Math.min(1, t));
            const px = ax + abx * t, pz = az + abz * t;
            const d2 = (x - px) ** 2 + (z - pz) ** 2;
            const k = Math.exp(-d2 / w2);
            const idx = j * N + i;
            // pull terrain toward a slightly lowered smooth valley floor
            const target = this._roadFloor(px, pz, h, N, S, half) - drop;
            h[idx] = h[idx] * (1 - k * 0.85) + target * (k * 0.85);
          }
        }
      }
    };
    for (const r of ROADS) if (r.kind !== 'rail') flat(r.pts, r.width, r.kind === 'boulevard' ? 2.2 : 0.8);
    for (const r of ROADS) if (r.kind === 'rail') flat(r.pts, r.width, 3.0);

    // smooth twice to kill terracing
    for (let pass = 0; pass < 2; pass++) {
      const c = h.slice();
      for (let j = 1; j < N - 1; j++)
        for (let i = 1; i < N - 1; i++)
          h[j * N + i] = (c[j * N + i] * 4 + c[j * N + i - 1] + c[j * N + i + 1] + c[(j - 1) * N + i] + c[(j + 1) * N + i]) / 8;
    }
  }

  _roadFloor(x, z, h, N, S, half) {
    const fi = ((x + half) / S) * (N - 1), fj = ((z + half) / S) * (N - 1);
    const i = Math.max(0, Math.min(N - 2, Math.floor(fi)));
    const j = Math.max(0, Math.min(N - 2, Math.floor(fj)));
    return h[j * N + i];
  }

  heightAt(x, z) {
    const { _h: h, _N: N, _S: S } = this;
    const half = S / 2;
    const fi = THREE.MathUtils.clamp(((x + half) / S) * (N - 1), 0, N - 1.001);
    const fj = THREE.MathUtils.clamp(((z + half) / S) * (N - 1), 0, N - 1.001);
    const i = Math.floor(fi), j = Math.floor(fj);
    const u = fi - i, v = fj - j;
    const a = h[j * N + i], b = h[j * N + i + 1], c = h[(j + 1) * N + i], d = h[(j + 1) * N + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  // ── ground mesh ──────────────────────────────────────
  _buildGround() {
    const N = 200, S = WORLD.size;
    const geo = new THREE.PlaneGeometry(S, S, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cA = new THREE.Color('#8a9a56'); // dry grass green
    const cB = new THREE.Color('#b5a878'); // sun-bleached earth
    const cC = new THREE.Color('#7d8c4d'); // greener low ground
    const col = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      const y = this.heightAt(x, z);
      pos.setY(k, y);
      const n = 0.5 + 0.5 * Math.sin(x * 0.021 + z * 0.017) * Math.sin(x * 0.007 - z * 0.011);
      const hgt = THREE.MathUtils.clamp((y - TERRAIN.base + 8) / 30, 0, 1);
      col.copy(cC).lerp(cA, hgt).lerp(cB, n * 0.45 + hgt * 0.2);
      colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // far surrounding hills so the horizon isn't empty
    const farGeo = new THREE.PlaneGeometry(S * 5, S * 5, 60, 60);
    farGeo.rotateX(-Math.PI / 2);
    const fp = farGeo.attributes.position;
    for (let k = 0; k < fp.count; k++) {
      const x = fp.getX(k), z = fp.getZ(k);
      const r = Math.hypot(x, z);
      if (r < S * 0.68) { fp.setY(k, -6); continue; }
      const y = -4
        + 26 * Math.max(0, Math.sin(x * 0.0011 + 0.7) * Math.cos(z * 0.0009 - 1.2))
        + 40 * Math.max(0, Math.sin(x * 0.0006 - 2.0) * Math.sin(z * 0.0007 + 0.4))
        + Math.max(0, (r - S * 0.68) * 0.02);
      fp.setY(k, y);
    }
    farGeo.computeVertexNormals();
    this.farHills = new THREE.Mesh(farGeo, new THREE.MeshLambertMaterial({ color: '#9aa06b' }));
    this.farHills.position.y = -0.5;
    this.scene.add(this.farHills);
  }

  // ── sky & light ──────────────────────────────────────
  _buildSky() {
    const geo = new THREE.SphereGeometry(4800, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#3f7fd4') },
        botColor: { value: new THREE.Color('#dfeaf2') },
        offset: { value: 400 },
        exponent: { value: 0.7 },
      },
      vertexShader: `varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 topColor,botColor; uniform float offset,exponent; varying vec3 vp;
        void main(){ float h = normalize(vp + vec3(0,offset,0)).y;
        gl_FragColor = vec4(mix(botColor, topColor, max(pow(max(h,0.0), exponent), 0.0)), 1.0); }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);

    // stars (only visible at night)
    const starGeo = new THREE.BufferGeometry();
    const n = 900, sp = new Float32Array(n * 3);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const t = rnd() * Math.PI * 2, p = Math.acos(rnd() * 0.9);
      const r = 4500;
      sp[i * 3] = r * Math.sin(p) * Math.cos(t);
      sp[i * 3 + 1] = r * Math.cos(p) + 200;
      sp[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 6, sizeAttenuation: true, transparent: true, opacity: 0 }));
    this.scene.add(this.stars);
  }

  _buildLights() {
    this.sun = new THREE.DirectionalLight('#fff4dd', 2.6);
    this.sun.position.set(-600, 900, 300);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.near = 100; s.camera.far = 2600;
    s.camera.left = s.camera.bottom = -900; s.camera.right = s.camera.top = 900;
    s.bias = -0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight('#cfe4ff', '#8f8460', 0.9);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight('#9db6e8', 0);
    this.moon.position.set(500, 700, -400);
    this.scene.add(this.moon);
  }

  setNight(night, instant = false) {
    this.night = night;
    this._targets = night
      ? { top: '#0b1230', bot: '#1c2a4a', fog: '#131b33', sun: 0, moon: 0.5, hemi: 0.18, stars: 0.95, far: '#3a4258' }
      : { top: '#3f7fd4', bot: '#e6ecf0', fog: '#dfe7ea', sun: 2.6, moon: 0, hemi: 0.9, stars: 0, far: '#9aa06b' };
    if (!this.scene.fog) this.scene.fog = new THREE.Fog('#dfe7ea', 500, 2600);
    if (instant) this._applyLerp(1);
  }

  _applyLerp(k) {
    const t = this._targets; if (!t) return;
    const u = this.sky.material.uniforms;
    u.topColor.value.lerp(new THREE.Color(t.top), k);
    u.botColor.value.lerp(new THREE.Color(t.bot), k);
    this.scene.fog.color.lerp(new THREE.Color(t.fog), k);
    this.sun.intensity += (t.sun - this.sun.intensity) * k;
    this.moon.intensity += (t.moon - this.moon.intensity) * k;
    this.hemi.intensity += (t.hemi - this.hemi.intensity) * k;
    this.stars.material.opacity += (t.stars - this.stars.material.opacity) * k;
    this.farHills.material.color.lerp(new THREE.Color(t.far), k);
  }

  update(dt, playerPos) {
    this._applyLerp(Math.min(1, dt * 1.6));
    // keep shadow camera centred on player so shadows stay crisp
    this.sun.position.set(playerPos.x - 420, 780, playerPos.z + 260);
    this.sun.target.position.set(playerPos.x, 0, playerPos.z);
    this.sky.position.copy(playerPos).setY(0);
  }
}

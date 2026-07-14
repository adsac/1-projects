// Builds the real city from the baked dataset: every street, every mapped
// building footprint, water, trees by land cover, streetlights, name labels.
import * as THREE from 'three';
import { WORLD } from './loader.js';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// road class → [width, color, yOffset]
const ROAD_STYLE = {
  0: [19, '#3b3b40', 0.10], 1: [16, '#3b3b40', 0.10], 2: [13, '#45454a', 0.09],
  3: [11, '#45454a', 0.09], 4: [9.5, '#4a4a4f', 0.08], 5: [7.5, '#505055', 0.07],
  6: [7, '#505055', 0.07], 7: [4.5, '#5a5a5f', 0.055], 8: [2.4, '#beb5a2', 0.05],
  9: [2.2, '#c6bdaa', 0.05], 10: [2.6, '#84605a', 0.05], 11: [3.2, '#95866a', 0.045],
};

export class City {
  constructor(scene, heightAt, data, opts = {}) {
    this.scene = scene;
    this.heightAt = heightAt;
    this.data = data;
    this.exclude = opts.exclude || [];   // {x,z,r} — replaced by bespoke landmark models
    this.low = !!opts.low;               // phone-friendly budget
    this.nightMats = [];
    this.lampMats = [];
    this._labelPool = [];
    this._buildRoads();
    this._buildWater();
    this._buildBuildings();
    this._buildTrees();
    this._buildStreetlights();
    this._buildLabels();
    this._buildCollisionIndex();
  }

  // ── roads ────────────────────────────────────────────
  _resample(pts, step) {
    const out = [];
    for (let i = 0; i < pts.length / 2 - 1; i++) {
      const ax = pts[i * 2], az = pts[i * 2 + 1], bx = pts[i * 2 + 2], bz = pts[i * 2 + 3];
      const d = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(d / step));
      for (let s = 0; s < n; s++) out.push(ax + (bx - ax) * s / n, az + (bz - az) * s / n);
    }
    out.push(pts[pts.length - 2], pts[pts.length - 1]);
    return out;
  }

  _appendRibbon(arr, pts, width, y0, step = 12) {
    const p = this._resample(pts, step);
    const n = p.length / 2;
    if (n < 2) return;
    const base = arr.verts.length / 3;
    for (let i = 0; i < n; i++) {
      const x = p[i * 2], z = p[i * 2 + 1];
      const px = p[Math.max(0, i - 1) * 2], pz = p[Math.max(0, i - 1) * 2 + 1];
      const nx = p[Math.min(n - 1, i + 1) * 2], nz = p[Math.min(n - 1, i + 1) * 2 + 1];
      let dx = nx - px, dz = nz - pz;
      const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const ox = -dz * width / 2, oz = dx * width / 2;
      const y = Math.min(
        this.heightAt(x + ox, z + oz),
        this.heightAt(x - ox, z - oz),
        this.heightAt(x, z)) + y0;
      arr.verts.push(x + ox, y, z + oz, x - ox, y, z - oz);
      if (i > 0) {
        const k = base + (i - 1) * 2;
        arr.idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
  }

  _buildRoads() {
    const buckets = new Map();
    for (const r of this.data.roads) {
      if (r.cls === 12) continue;
      const st = ROAD_STYLE[r.cls];
      if (!st) continue;
      let b = buckets.get(r.cls);
      if (!b) { b = { verts: [], idx: [], style: st }; buckets.set(r.cls, b); }
      this._appendRibbon(b, r.pts, st[0], st[2]);
    }
    for (const [, b] of buckets) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.verts, 3));
      geo.setIndex(b.idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: b.style[1] }));
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    // rail: ballast + track hint
    const ballast = { verts: [], idx: [] }, track = { verts: [], idx: [] };
    for (const r of this.data.roads) {
      if (r.cls !== 12) continue;
      this._appendRibbon(ballast, r.pts, 7, 0.06);
      this._appendRibbon(track, r.pts, 1.6, 0.12);
    }
    for (const [b, col] of [[ballast, '#6f675c'], [track, '#3a3a3d']]) {
      if (!b.verts.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.verts, 3));
      geo.setIndex(b.idx);
      geo.computeVertexNormals();
      this.scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col })));
    }
  }

  // ── water ────────────────────────────────────────────
  _buildWater() {
    const mat = new THREE.MeshStandardMaterial({
      color: '#2f7fa8', roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.93,
    });
    for (const a of this.data.areas) {
      if (a.kind !== 0) continue;
      const area = (a.maxx - a.minx) * (a.maxz - a.minz);
      if (area < 200) continue;
      const shape = new THREE.Shape();
      shape.moveTo(a.pts[0], a.pts[1]);
      for (let i = 1; i < a.pts.length / 2; i++) shape.lineTo(a.pts[i * 2], a.pts[i * 2 + 1]);
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(Math.PI / 2);   // shape y → -z; flip to lie flat
      // find min terrain height over ring for the water level
      let hmin = 1e9;
      for (let i = 0; i < a.pts.length / 2; i++) {
        hmin = Math.min(hmin, this.heightAt(a.pts[i * 2], a.pts[i * 2 + 1]));
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.z = -1;          // undo the mirroring from rotateX
      mesh.position.y = hmin + 0.25;
      this.scene.add(mesh);
    }
  }

  // ── buildings ────────────────────────────────────────
  _facadeTextures() {
    // one tile = one window on a stone wall
    const mk = (night) => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = night ? '#000000' : '#ffffff';   // day map is multiplied by vertex color
      g.fillRect(0, 0, 64, 64);
      if (!night) {
        g.fillStyle = 'rgba(0,0,0,0.08)';
        g.fillRect(0, 60, 64, 4);                    // floor shadow line
        g.fillStyle = '#8a93a3';                     // glass, soft blue-grey
        g.fillRect(21, 19, 22, 28);
        g.fillStyle = 'rgba(60,70,90,0.45)';
        g.fillRect(21, 33, 22, 14);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(21, 19, 22, 4);                   // lintel highlight
        g.strokeStyle = 'rgba(80,80,80,0.35)';
        g.strokeRect(20.5, 18.5, 23, 29);
      }
      return c;
    };
    const day = new THREE.CanvasTexture(mk(false));
    day.wrapS = day.wrapT = THREE.RepeatWrapping;
    day.colorSpace = THREE.SRGBColorSpace;

    // night emissive: random windows lit
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 256);
    const rng = mulberry32(99);
    for (let wy = 0; wy < 4; wy++) {
      for (let wx = 0; wx < 4; wx++) {
        if (rng() < 0.42) {
          g.fillStyle = rng() < 0.8 ? '#ffd98a' : '#ffe9bb';
          g.fillRect(wx * 64 + 21, wy * 64 + 19, 22, 28);
        }
      }
    }
    const night = new THREE.CanvasTexture(c);
    night.wrapS = night.wrapT = THREE.RepeatWrapping;
    return { day, night };
  }

  _buildBuildings() {
    const rng = mulberry32(20031126);
    const { day, night } = this._facadeTextures();
    const wallMat = new THREE.MeshLambertMaterial({
      map: day, emissiveMap: night, emissive: '#000000', vertexColors: true,
    });
    this.nightMats.push(wallMat);
    const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true });

    const CHUNK = 1600;
    const chunks = new Map();
    const key = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    const stone = [
      new THREE.Color('#efe6d0'), new THREE.Color('#e7dcc3'),
      new THREE.Color('#dfd2b4'), new THREE.Color('#f2ead8'), new THREE.Color('#e2d5bc'),
    ];
    const roofFlat = [new THREE.Color('#b9b2a4'), new THREE.Color('#c8c1b1'), new THREE.Color('#aaa294')];
    const roofRed = [new THREE.Color('#9e4630'), new THREE.Color('#a85138'), new THREE.Color('#8f3d2a')];

    const heaters = [];
    this.roofSpots = [];

    for (const b of this.data.buildings) {
      if (this.exclude.some(e => Math.hypot(b.cx - e.x, b.cz - e.z) < e.r)) continue;
      let ch = chunks.get(key(b.cx, b.cz));
      if (!ch) {
        ch = { wv: [], wn: [], wuv: [], wc: [], wi: [], rv: [], rc: [], ri: [] };
        chunks.set(key(b.cx, b.cz), ch);
      }
      const n = b.pts.length / 2;
      // ground: lowest terrain under ring
      let base = 1e9;
      for (let i = 0; i < n; i++) base = Math.min(base, this.heightAt(b.pts[i * 2], b.pts[i * 2 + 1]));
      base -= 0.6;
      const top = base + b.h + 0.6;
      const col = b.villa
        ? stone[(rng() * stone.length) | 0].clone().lerp(new THREE.Color('#f6f0e2'), 0.4)
        : stone[(rng() * stone.length) | 0];
      const rcol = b.villa ? roofRed[(rng() * 3) | 0] : roofFlat[(rng() * 3) | 0];

      // ensure consistent winding (CCW in x/z for outward normals)
      let areaSum = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        areaSum += b.pts[i * 2] * b.pts[j * 2 + 1] - b.pts[j * 2] * b.pts[i * 2 + 1];
      }
      const flip = areaSum < 0;

      // walls
      let cum = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        let ax = b.pts[i * 2], az = b.pts[i * 2 + 1];
        let bx = b.pts[j * 2], bz = b.pts[j * 2 + 1];
        if (flip) { [ax, bx] = [bx, ax]; [az, bz] = [bz, az]; }
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.4) continue;
        const nx = (bz - az) / len, nz = -(bx - ax) / len;
        const vbase = ch.wv.length / 3;
        ch.wv.push(ax, base, az, bx, base, bz, ax, top, az, bx, top, bz);
        for (let k = 0; k < 4; k++) ch.wn.push(nx, 0, nz);
        const u0 = cum / 3.4, u1 = (cum + len) / 3.4;
        const v1 = (top - base) / 3.1;
        ch.wuv.push(u0, 0, u1, 0, u0, v1, u1, v1);
        for (let k = 0; k < 4; k++) ch.wc.push(col.r, col.g, col.b);
        ch.wi.push(vbase, vbase + 1, vbase + 2, vbase + 1, vbase + 3, vbase + 2);
        cum += len;
      }

      // roof cap
      const contour = [];
      for (let i = 0; i < n; i++) {
        const idx2 = flip ? n - 1 - i : i;
        contour.push(new THREE.Vector2(b.pts[idx2 * 2], b.pts[idx2 * 2 + 1]));
      }
      let tris;
      try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch { tris = []; }
      const rbase = ch.rv.length / 3;
      for (const p of contour) {
        ch.rv.push(p.x, top, p.y);
        ch.rc.push(rcol.r, rcol.g, rcol.b);
      }
      for (const t of tris) ch.ri.push(rbase + t[0], rbase + t[2], rbase + t[1]);

      // solar heaters on larger flat roofs
      if (!b.villa && b.h > 8 && n >= 4 && rng() < 0.85) {
        const cnt = 1 + ((rng() * 3) | 0);
        for (let k = 0; k < cnt; k++) {
          const px = b.cx + (rng() - 0.5) * b.r * 0.7;
          const pz = b.cz + (rng() - 0.5) * b.r * 0.7;
          heaters.push([px, top, pz, rng() * Math.PI]);
        }
      }
      if (b.h > 5) this.roofSpots.push([b.cx, top, b.cz]);
    }

    for (const [, ch] of chunks) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(ch.wv, 3));
      wg.setAttribute('normal', new THREE.Float32BufferAttribute(ch.wn, 3));
      wg.setAttribute('uv', new THREE.Float32BufferAttribute(ch.wuv, 2));
      wg.setAttribute('color', new THREE.Float32BufferAttribute(ch.wc, 3));
      wg.setIndex(ch.wi);
      const wm = new THREE.Mesh(wg, wallMat);
      wm.castShadow = true; wm.receiveShadow = true;
      this.scene.add(wm);

      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(ch.rv, 3));
      rg.setAttribute('color', new THREE.Float32BufferAttribute(ch.rc, 3));
      rg.setIndex(ch.ri);
      rg.computeVertexNormals();
      const rm = new THREE.Mesh(rg, roofMat);
      rm.castShadow = true; rm.receiveShadow = true;
      this.scene.add(rm);
    }

    // instanced solar heaters (the dud shemesh on every roof)
    if (heaters.length) {
      const hGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8);
      hGeo.rotateZ(Math.PI / 2);
      const pGeo = new THREE.BoxGeometry(1.5, 0.08, 1.1);
      const hMat = new THREE.MeshLambertMaterial({ color: '#ececec' });
      const pMat = new THREE.MeshStandardMaterial({ color: '#16233c', roughness: 0.3, metalness: 0.4 });
      const hInst = new THREE.InstancedMesh(hGeo, hMat, heaters.length);
      const pInst = new THREE.InstancedMesh(pGeo, pMat, heaters.length);
      const d = new THREE.Object3D();
      heaters.forEach(([x, y, z, yaw], i) => {
        d.position.set(x, y + 0.55, z); d.rotation.set(0, yaw, 0); d.updateMatrix();
        hInst.setMatrixAt(i, d.matrix);
        d.position.set(x, y + 0.42, z + 1.1); d.rotation.set(0.5, yaw, 0); d.updateMatrix();
        pInst.setMatrixAt(i, d.matrix);
      });
      this.scene.add(hInst, pInst);
    }
  }

  // ── vegetation ───────────────────────────────────────
  _pointInPoly(x, z, pts) {
    let inside = false;
    const n = pts.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[i * 2], zi = pts[i * 2 + 1], xj = pts[j * 2], zj = pts[j * 2 + 1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  _buildTrees() {
    const rng = mulberry32(5758);
    const q = this.low ? 0.45 : 1;
    const kinds = {
      pine: { geo: new THREE.SphereGeometry(2.4, 7, 5), mat: new THREE.MeshLambertMaterial({ color: '#3d5f33' }), yOff: 5.2, squash: 0.6, trunk: 4.4, cap: Math.round(5200 * q) },
      olive: { geo: new THREE.IcosahedronGeometry(1.6, 1), mat: new THREE.MeshLambertMaterial({ color: '#7c8f66' }), yOff: 2.5, squash: 0.72, trunk: 2.0, cap: Math.round(2600 * q) },
      cypress: { geo: new THREE.ConeGeometry(0.95, 7, 6), mat: new THREE.MeshLambertMaterial({ color: '#2f4a2b' }), yOff: 3.5, squash: 1, trunk: 0, cap: Math.round(2400 * q) },
      bush: { geo: new THREE.IcosahedronGeometry(0.9, 0), mat: new THREE.MeshLambertMaterial({ color: '#6d7d54' }), yOff: 0.6, squash: 0.8, trunk: 0, cap: Math.round(2400 * q) },
    };
    const spots = { pine: [], olive: [], cypress: [], bush: [] };

    // forest/orchard/park polygons
    for (const a of this.data.areas) {
      let kind = null, dens = 0;
      if (a.kind === 2) { kind = 'pine'; dens = 1 / 350; }
      else if (a.kind === 1) { kind = 'olive'; dens = 1 / 900; }
      else if (a.kind === 7) { kind = 'bush'; dens = 1 / 700; }
      else continue;
      const bboxA = (a.maxx - a.minx) * (a.maxz - a.minz);
      let want = Math.min(500, Math.max(1, Math.round(bboxA * dens)));
      let guard = want * 8;
      while (want > 0 && guard-- > 0) {
        const x = a.minx + rng() * (a.maxx - a.minx);
        const z = a.minz + rng() * (a.maxz - a.minz);
        if (!this._pointInPoly(x, z, a.pts)) continue;
        const arr = spots[kind === 'pine' && rng() < 0.15 ? 'cypress' : kind];
        arr.push([x, z, 0.7 + rng() * 0.9]);
        if (kind === 'olive' && rng() < 0.25) spots.cypress.push([x + 4, z + 3, 0.8 + rng() * 0.6]);
        want--;
      }
    }
    // street trees along residential/tertiary
    for (const r of this.data.roads) {
      if (r.cls !== 4 && r.cls !== 5 && r.cls !== 6) continue;
      const p = this._resample(r.pts, 38);
      const st = ROAD_STYLE[r.cls];
      for (let i = 1; i < p.length / 2 - 1; i++) {
        if (rng() < 0.45) continue;
        const x = p[i * 2], z = p[i * 2 + 1];
        const px = p[(i - 1) * 2], pz = p[(i - 1) * 2 + 1];
        let dx = x - px, dz = z - pz;
        const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        const side = i % 2 ? 1 : -1;
        const ox = -dz * (st[0] / 2 + 2.2) * side, oz = dx * (st[0] / 2 + 2.2) * side;
        spots[rng() < 0.5 ? 'olive' : 'cypress'].push([x + ox, z + oz, 0.7 + rng() * 0.6]);
      }
    }
    // palms along primary/secondary
    const palms = [];
    for (const r of this.data.roads) {
      if (r.cls !== 2 && r.cls !== 3) continue;
      const p = this._resample(r.pts, 44);
      const st = ROAD_STYLE[r.cls];
      for (let i = 1; i < p.length / 2 - 1; i++) {
        const x = p[i * 2], z = p[i * 2 + 1];
        const px = p[(i - 1) * 2], pz = p[(i - 1) * 2 + 1];
        let dx = x - px, dz = z - pz;
        const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        for (const side of [1, -1]) {
          const ox = -dz * (st[0] / 2 + 2.6) * side, oz = dx * (st[0] / 2 + 2.6) * side;
          palms.push([x + ox, z + oz]);
        }
      }
    }

    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 4, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#6e5b3e' });
    const d = new THREE.Object3D();
    for (const [name, k] of Object.entries(kinds)) {
      const arr = spots[name];
      if (!arr.length) continue;
      const cnt = Math.min(arr.length, k.cap);
      const inst = new THREE.InstancedMesh(k.geo, k.mat, cnt);
      const trunks = k.trunk ? new THREE.InstancedMesh(trunkGeo, trunkMat, cnt) : null;
      for (let i = 0; i < cnt; i++) {
        const [x, z, s] = arr[(i * 997) % arr.length];
        const y = this.heightAt(x, z);
        d.position.set(x, y + k.yOff * s * k.squash, z);
        d.scale.set(s, s * k.squash, s);
        d.rotation.set(0, (i * 2.399) % 6.28, 0);
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
        if (trunks) {
          d.position.set(x, y + k.trunk * s / 2, z);
          d.scale.set(s, s * k.trunk / 4, s);
          d.rotation.set(0, 0, 0);
          d.updateMatrix();
          trunks.setMatrixAt(i, d.matrix);
        }
      }
      inst.castShadow = true;
      this.scene.add(inst);
      if (trunks) this.scene.add(trunks);
    }
    if (palms.length) {
      const cnt = Math.min(palms.length, this.low ? 550 : 1100);
      const pTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.36, 8.5, 6), trunkMat, cnt);
      const pFrond = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 1.0, 7),
        new THREE.MeshLambertMaterial({ color: '#4f7a34' }), cnt);
      for (let i = 0; i < cnt; i++) {
        const [x, z] = palms[(i * 991) % palms.length];
        const y = this.heightAt(x, z);
        d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
        d.position.set(x, y + 4.25, z); d.updateMatrix();
        pTrunk.setMatrixAt(i, d.matrix);
        d.position.set(x, y + 8.9, z); d.scale.set(1, 1.35, 1); d.updateMatrix();
        pFrond.setMatrixAt(i, d.matrix);
      }
      pTrunk.castShadow = pFrond.castShadow = true;
      this.scene.add(pTrunk, pFrond);
    }
  }

  _buildStreetlights() {
    const spots = [];
    for (const r of this.data.roads) {
      if (r.cls < 2 || r.cls > 4) continue;
      const p = this._resample(r.pts, 62);
      const st = ROAD_STYLE[r.cls];
      for (let i = 1; i < p.length / 2 - 1; i++) {
        const x = p[i * 2], z = p[i * 2 + 1];
        const px = p[(i - 1) * 2], pz = p[(i - 1) * 2 + 1];
        let dx = x - px, dz = z - pz;
        const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        const side = i % 2 ? 1 : -1;
        spots.push([x - dz * (st[0] / 2 + 1) * side, z + dx * (st[0] / 2 + 1) * side]);
      }
    }
    const cnt = Math.min(spots.length, this.low ? 1100 : 2000);
    if (!cnt) return;
    const poleMat = new THREE.MeshLambertMaterial({ color: '#565b60' });
    const headMat = new THREE.MeshLambertMaterial({ color: '#fff6cf', emissive: '#000000' });
    this.lampMats.push(headMat);
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 6.5, 5), poleMat, cnt);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 6, 5), headMat, cnt);
    const d = new THREE.Object3D();
    for (let i = 0; i < cnt; i++) {
      const [x, z] = spots[(i * 883) % spots.length];
      const y = this.heightAt(x, z);
      d.position.set(x, y + 3.25, z); d.updateMatrix();
      poles.setMatrixAt(i, d.matrix);
      d.position.set(x, y + 6.6, z); d.updateMatrix();
      heads.setMatrixAt(i, d.matrix);
    }
    this.scene.add(poles, heads);
  }

  // ── street-name labels (lazy pool near the player) ───
  _buildLabels() {
    const pts = [];
    const grid = new Map();
    for (const r of this.data.roads) {
      if (r.name === 65535 || r.cls > 6) continue;
      // length
      let len = 0;
      for (let i = 0; i < r.pts.length / 2 - 1; i++) {
        len += Math.hypot(r.pts[i * 2 + 2] - r.pts[i * 2], r.pts[i * 2 + 3] - r.pts[i * 2 + 1]);
      }
      if (len < 70) continue;
      const mid = Math.floor(r.pts.length / 4) * 2;
      const x = r.pts[mid], z = r.pts[mid + 1];
      const name = this.data.names[r.name];
      // dedupe same name within ~400m
      const gk = `${name}:${Math.round(x / 400)}:${Math.round(z / 400)}`;
      if (grid.has(gk)) continue;
      grid.set(gk, 1);
      pts.push({ x, z, name });
    }
    this._labelPts = pts;
    // pool of reusable sprites
    for (let i = 0; i < 44; i++) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 96;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sp.scale.set(30, 5.6, 1);
      sp.visible = false;
      sp.renderOrder = 5;
      this.scene.add(sp);
      this._labelPool.push({ sp, c, tex, key: null });
    }
  }

  updateLabels(px, pz) {
    const near = [];
    for (const p of this._labelPts) {
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d > 48 && d < 330) near.push([d, p]);   // hide when you're on the street itself
    }
    near.sort((a, b) => a[0] - b[0]);
    const want = near.slice(0, this._labelPool.length);
    const wanted = new Set(want.map(w => w[1].name + ':' + w[1].x));
    // free pool entries not wanted
    const free = [];
    for (const e of this._labelPool) {
      if (e.key && !wanted.has(e.key)) { e.key = null; e.sp.visible = false; }
      if (!e.key) free.push(e);
    }
    for (const [, p] of want) {
      const k = p.name + ':' + p.x;
      if (this._labelPool.some(e => e.key === k)) continue;
      const e = free.pop();
      if (!e) break;
      const g = e.c.getContext('2d');
      g.clearRect(0, 0, 512, 96);
      g.font = '600 44px "Segoe UI", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 9; g.strokeStyle = 'rgba(20,16,8,0.85)';
      g.strokeText(p.name, 256, 48);
      g.fillStyle = '#ffe9b0';
      g.fillText(p.name, 256, 48);
      e.tex.needsUpdate = true;
      e.sp.position.set(p.x, this.heightAt(p.x, p.z) + 9.5, p.z);
      e.sp.visible = true;
      e.key = k;
    }
  }

  // ── collision (real footprints, spatial hash) ────────
  _buildCollisionIndex() {
    this._colCell = 80;
    this._colMap = new Map();
    this.data.buildings.forEach((b, i) => {
      if (this.exclude.some(e => Math.hypot(b.cx - e.x, b.cz - e.z) < e.r)) return;
      const k = `${Math.floor(b.cx / this._colCell)},${Math.floor(b.cz / this._colCell)}`;
      if (!this._colMap.has(k)) this._colMap.set(k, []);
      this._colMap.get(k).push(i);
    });
    this.extraColliders = [];   // circles from landmarks
  }

  collide(pos, radius = 0.8) {
    for (const c of this.extraColliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 0.001) { pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; }
    }
    const cx = Math.floor(pos.x / this._colCell), cz = Math.floor(pos.z / this._colCell);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        const cell = this._colMap.get(`${i},${j}`);
        if (!cell) continue;
        for (const bi of cell) {
          const b = this.data.buildings[bi];
          if (Math.hypot(pos.x - b.cx, pos.z - b.cz) > b.r + radius + 2) continue;
          if (this._pointInPoly(pos.x, pos.z, b.pts)) {
            // push out via nearest edge
            let best = 1e9, bx = 0, bz = 0;
            const n = b.pts.length / 2;
            for (let e = 0; e < n; e++) {
              const f = (e + 1) % n;
              const ax = b.pts[e * 2], az = b.pts[e * 2 + 1];
              const ex = b.pts[f * 2], ez = b.pts[f * 2 + 1];
              const abx = ex - ax, abz = ez - az;
              const ab2 = abx * abx + abz * abz || 1;
              let t = ((pos.x - ax) * abx + (pos.z - az) * abz) / ab2;
              t = Math.max(0, Math.min(1, t));
              const qx = ax + abx * t, qz = az + abz * t;
              const dd = (pos.x - qx) ** 2 + (pos.z - qz) ** 2;
              if (dd < best) { best = dd; bx = qx; bz = qz; }
            }
            const d = Math.sqrt(best) || 1;
            const ox = (pos.x - bx) / d, oz = (pos.z - bz) / d;
            pos.x = bx - ox * (radius + 0.05);
            pos.z = bz - oz * (radius + 0.05);
          }
        }
      }
    }
  }

  setNight(night) {
    for (const m of this.nightMats) m.emissive.set(night ? '#c9a55e' : '#000000');
    for (const m of this.lampMats) m.emissive.set(night ? '#ffdf8a' : '#000000');
  }
}

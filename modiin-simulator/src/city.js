// Procedural city: roads draped on terrain, districts of stone-clad housing,
// instanced trees, streetlights, parks. Content comes from data/city-data.js.
import * as THREE from 'three';
import { WORLD, ROADS, ROUNDABOUTS, DISTRICTS, PARKS } from './data/city-data.js';

// deterministic RNG so the city is identical on every visit
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class City {
  constructor(scene, heightAt, reserved = []) {
    this.scene = scene;
    this.heightAt = heightAt;
    this._reserved = reserved;  // no-build zones around landmarks
    this.colliders = [];      // {x, z, r} circles the player can't enter
    this.nightMats = [];      // materials whose emissive toggles at night
    this.lampMats = [];
    this._roadSegs = [];
    for (const r of ROADS) {
      if (r.kind === 'rail') continue;
      for (let i = 0; i < r.pts.length - 1; i++)
        this._roadSegs.push([r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1], r.width]);
    }
    this._parkShapes = PARKS.map(p => ({ ...p }));

    this._buildRoads();
    this._buildRail();
    this._buildRoundabouts();
    this._buildParks();
    this._buildDistricts();
    this._buildTrees();
    this._buildStreetlights();
  }

  // distance from point to nearest road centreline minus half width (<0 means on road)
  roadDist(x, z) {
    let best = 1e9;
    for (const [ax, az, bx, bz, w] of this._roadSegs) {
      const abx = bx - ax, abz = bz - az;
      const ab2 = abx * abx + abz * abz || 1;
      let t = ((x - ax) * abx + (z - az) * abz) / ab2;
      t = Math.max(0, Math.min(1, t));
      const dx = x - (ax + abx * t), dz = z - (az + abz * t);
      best = Math.min(best, Math.hypot(dx, dz) - w / 2);
    }
    return best;
  }

  inPark(x, z, margin = 0) {
    for (const p of this._parkShapes) {
      if (Math.hypot(x - p.x, z - p.z) < p.r + margin) return true;
    }
    return false;
  }

  // ── roads ────────────────────────────────────────────
  _ribbon(pts, width, y0, color, opts = {}) {
    // build a triangle strip following the polyline, draped on terrain
    const verts = [], idx = [];
    const up = [];
    // resample into ~8m steps for smooth draping
    const pathPts = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const d = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.round(d / 8));
      for (let s = 0; s < steps; s++) pathPts.push([ax + (bx - ax) * s / steps, az + (bz - az) * s / steps]);
    }
    pathPts.push(pts[pts.length - 1]);
    for (let i = 0; i < pathPts.length; i++) {
      const [x, z] = pathPts[i];
      const [px, pz] = pathPts[Math.max(0, i - 1)];
      const [nx, nz] = pathPts[Math.min(pathPts.length - 1, i + 1)];
      let dx = nx - px, dz = nz - pz;
      const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const ox = -dz * width / 2, oz = dx * width / 2;
      const yl = this.heightAt(x + ox, z + oz) + y0;
      const yr = this.heightAt(x - ox, z - oz) + y0;
      const yc = Math.min(yl, yr, this.heightAt(x, z) + y0);
      verts.push(x + ox, yc + 0.02, z + oz, x - ox, yc + 0.02, z - oz);
      up.push([x, z, dx, dz]);
      if (i > 0) {
        const k = (i - 1) * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color, ...opts.mat });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this._lastPath = up;
    return mesh;
  }

  _buildRoads() {
    for (const r of ROADS) {
      if (r.kind === 'rail') continue;
      this._ribbon(r.pts, r.width, 0.05, '#4a4a4f');
      // centre line / median for boulevards
      if (r.kind === 'boulevard') {
        this._ribbon(r.pts, 1.6, 0.10, '#7d9b57');            // planted median
        this._ribbon(r.pts, r.width + 5, 0.028, '#b9b1a0');   // sidewalks
      } else {
        this._ribbon(r.pts, r.width + 3.4, 0.028, '#b9b1a0');
      }
    }
  }

  _buildRail() {
    for (const r of ROADS) {
      if (r.kind !== 'rail') continue;
      this._ribbon(r.pts, r.width, 0.03, '#6f675c');           // ballast
      this._ribbon(r.pts, 1.5, 0.14, '#3a3a3d');               // track hint (dark strip)
      this._ribbon(r.pts, 0.28, 0.20, '#8e8e94');
    }
  }

  _buildRoundabouts() {
    const stone = new THREE.MeshLambertMaterial({ color: '#cfc4ac' });
    const green = new THREE.MeshLambertMaterial({ color: '#6f9048' });
    for (const rb of ROUNDABOUTS) {
      const y = this.heightAt(rb.x, rb.z);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rb.r, rb.r, 0.5, 28), stone);
      ring.position.set(rb.x, y + 0.25, rb.z);
      this.scene.add(ring);
      const grass = new THREE.Mesh(new THREE.CylinderGeometry(rb.r - 1.2, rb.r - 1.2, 0.7, 28), green);
      grass.position.set(rb.x, y + 0.36, rb.z);
      this.scene.add(grass);
      this.colliders.push({ x: rb.x, z: rb.z, r: rb.r });
      if (rb.art === 'menorah') this._menorah(rb.x, rb.z, y + 0.7, 4.4);
      else if (rb.art === 'sculpture') {
        const s = new THREE.Mesh(
          new THREE.TorusKnotGeometry(1.6, 0.5, 60, 10),
          new THREE.MeshStandardMaterial({ color: '#b0522d', roughness: 0.5, metalness: 0.6 }));
        s.position.set(rb.x, y + 3.1, rb.z);
        s.castShadow = true;
        this.scene.add(s);
      } else if (rb.art === 'flag') {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 8),
          new THREE.MeshLambertMaterial({ color: '#d8d8d8' }));
        pole.position.set(rb.x, y + 5.5, rb.z);
        this.scene.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2),
          new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide }));
        flag.position.set(rb.x + 1.7, y + 9.8, rb.z);
        this.scene.add(flag);
        const stripe = new THREE.MeshLambertMaterial({ color: '#1c5d99', side: THREE.DoubleSide });
        for (const dy of [0.75, -0.75]) {
          const st = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.3), stripe);
          st.position.set(rb.x + 1.7, y + 9.8 + dy, rb.z + 0.01);
          this.scene.add(st);
        }
        const star = new THREE.Mesh(new THREE.CircleGeometry(0.55, 6), stripe);
        star.position.set(rb.x + 1.7, y + 9.8, rb.z + 0.012);
        this.scene.add(star);
      } else {
        // olive tree on the roundabout — very Modi'in
        this._oliveAt(rb.x, rb.z, y + 0.7, 1.35);
      }
    }
  }

  _menorah(x, z, y, scale) {
    const mat = new THREE.MeshStandardMaterial({ color: '#c89b3c', roughness: 0.35, metalness: 0.85 });
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.14 * scale, 1.5 * scale, 10), mat);
    stem.position.y = 0.75 * scale; g.add(stem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * scale, 0.55 * scale, 0.18 * scale, 12), mat);
    base.position.y = 0.09 * scale; g.add(base);
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const r = Math.abs(i) * 0.22 * scale;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05 * scale, 8, 22, Math.PI), mat);
      arc.position.y = 1.5 * scale;
      g.add(arc);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.35 * scale, 8), mat);
      up.position.set(i * 0.22 * scale, 1.5 * scale + 0.17 * scale + r - r, 0);
      up.position.x = i * 0.22 * scale; up.position.y = 1.5 * scale + 0.17 * scale;
      g.add(up);
    }
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.6 * scale, 8), mat);
    mid.position.y = 1.5 * scale + 0.3 * scale; g.add(mid);
    g.position.set(x, y, z);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    return g;
  }

  // ── parks ────────────────────────────────────────────
  _buildParks() {
    for (const p of this._parkShapes) {
      const seg = 36;
      const geo = new THREE.CircleGeometry(p.r, seg);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + p.x, z = pos.getZ(i) + p.z;
        pos.setY(i, this.heightAt(x, z) + 0.09);
      }
      geo.computeVertexNormals();
      const lawn = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: p.color || '#5f8f3e' }));
      lawn.position.set(p.x, 0, p.z);
      lawn.receiveShadow = true;
      this.scene.add(lawn);

      if (p.lake) {
        const lg = new THREE.CircleGeometry(p.lake.r, 40);
        lg.rotateX(-Math.PI / 2);
        const water = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({
          color: '#2f7fa8', roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.92,
        }));
        const wy = this.heightAt(p.x + (p.lake.dx || 0), p.z + (p.lake.dz || 0)) + 0.22;
        water.position.set(p.x + (p.lake.dx || 0), wy, p.z + (p.lake.dz || 0));
        this.scene.add(water);
        p._lakeY = wy;
        // little rowboat
        const boat = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 2.4, 4, 8),
          new THREE.MeshLambertMaterial({ color: '#b34435' }));
        hull.scale.set(1, 0.42, 1); hull.rotation.z = Math.PI / 2;
        boat.add(hull);
        boat.position.set(water.position.x + p.lake.r * 0.35, wy + 0.18, water.position.z - p.lake.r * 0.2);
        this.scene.add(boat);
      }
    }
  }

  // ── housing districts ────────────────────────────────
  _facadeTexture(base, floors, night = false) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 32 * floors;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < 4; w++) {
        const lit = night && Math.random() < 0.55;
        g.fillStyle = night ? (lit ? '#ffd98a' : '#0e1420') : 'rgba(38,48,66,0.85)';
        g.fillRect(10 + w * 30, 8 + f * 32, 16, 15);
        if (!night) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(10 + w * 30, 8 + f * 32, 16, 3); }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildDistricts() {
    const rng = mulberry32(20031126);
    const archetypes = [];
    // shared solar-heater instanced mesh (the white rooftop boilers every Israeli knows)
    const heaterGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.6, 10);
    heaterGeo.rotateZ(Math.PI / 2);
    const panelGeo = new THREE.BoxGeometry(1.7, 0.1, 1.2);
    const heaterMat = new THREE.MeshLambertMaterial({ color: '#eeeeee' });
    const panelMat = new THREE.MeshStandardMaterial({ color: '#12203a', roughness: 0.25, metalness: 0.5 });
    const heaters = [], panels = [];

    const pergolaMat = new THREE.MeshLambertMaterial({ color: '#8a6b43' });
    const roofMat = new THREE.MeshLambertMaterial({ color: '#9e3f2c' });

    const dummy = new THREE.Object3D();

    for (const d of DISTRICTS) {
      const stones = d.palette || ['#e7dcc3', '#efe6d0', '#dccfae', '#e2d5b8'];
      const count = d.count || 90;
      const placed = [];
      const isCottages = d.style === 'cottages';

      // one InstancedMesh per district & stone shade, textured facade
      const floorsBase = isCottages ? 2 : (d.floors || 5);
      const meshes = stones.map(col => {
        const floors = floorsBase;
        const dayTex = this._facadeTexture(col, floors);
        const nightTex = this._facadeTexture('#3d3833', floors, true);
        const mat = new THREE.MeshLambertMaterial({ map: dayTex, emissiveMap: nightTex, emissive: '#000000' });
        this.nightMats.push(mat);
        const w = isCottages ? 9 : 14, h = floors * 3.1, dep = isCottages ? 8 : 11;
        const geo = new THREE.BoxGeometry(w, h, dep);
        const m = new THREE.InstancedMesh(geo, mat, Math.ceil(count / stones.length) + 6);
        m.castShadow = true; m.receiveShadow = true;
        m.count = 0;
        m.userData.h = h; m.userData.w = w;
        this.scene.add(m);
        return m;
      });
      const roofInst = isCottages
        ? new THREE.InstancedMesh(new THREE.ConeGeometry(7.2, 3.2, 4), roofMat, count + 4)
        : null;
      if (roofInst) { roofInst.count = 0; roofInst.castShadow = true; this.scene.add(roofInst); }

      let attempts = 0;
      while (placed.length < count && attempts < count * 40) {
        attempts++;
        const a = rng() * Math.PI * 2;
        const rr = Math.sqrt(rng()) * d.r;
        const x = d.x + Math.cos(a) * rr * (d.sx || 1);
        const z = d.z + Math.sin(a) * rr * (d.sz || 1);
        if (this.roadDist(x, z) < 14) continue;
        if (this.inPark(x, z, 10)) continue;
        if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < (isCottages ? 13 : 21))) continue;
        if (this._reserved && this._reserved.some(rv => Math.hypot(rv.x - x, rv.z - z) < rv.r + 12)) continue;
        placed.push([x, z]);

        const mi = Math.floor(rng() * meshes.length);
        const mesh = meshes[mi];
        const h = mesh.userData.h;
        const y = this.heightAt(x, z);
        // face nearest road
        const yaw = this._yawToRoad(x, z) + (rng() - 0.5) * 0.12;
        dummy.position.set(x, y + h / 2 - 0.6, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(mesh.count++, dummy.matrix);
        this.colliders.push({ x, z, r: isCottages ? 6.5 : 9.5 });

        if (roofInst) {
          dummy.position.set(x, y + h - 0.6 + 1.6, z);
          dummy.rotation.set(0, yaw + Math.PI / 4, 0);
          dummy.updateMatrix();
          roofInst.setMatrixAt(roofInst.count++, dummy.matrix);
        } else {
          // flat roof: solar heaters
          const n = 1 + Math.floor(rng() * 3);
          for (let k = 0; k < n; k++) {
            const ox = (rng() - 0.5) * 8, oz = (rng() - 0.5) * 6;
            heaters.push([x + ox, y + h - 0.6 + 0.6, z + oz, yaw]);
            panels.push([x + ox, y + h - 0.6 + 0.45, z + oz + 1.3, yaw]);
          }
        }
      }
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
      if (roofInst) roofInst.instanceMatrix.needsUpdate = true;
    }

    const hInst = new THREE.InstancedMesh(heaterGeo, heaterMat, Math.max(1, heaters.length));
    const pInst = new THREE.InstancedMesh(panelGeo, panelMat, Math.max(1, panels.length));
    heaters.forEach(([x, y, z, yaw], i) => {
      dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.updateMatrix();
      hInst.setMatrixAt(i, dummy.matrix);
    });
    panels.forEach(([x, y, z, yaw], i) => {
      dummy.position.set(x, y, z); dummy.rotation.set(0.5, yaw, 0); dummy.updateMatrix();
      pInst.setMatrixAt(i, dummy.matrix);
    });
    hInst.count = heaters.length; pInst.count = panels.length;
    this.scene.add(hInst, pInst);
  }

  _yawToRoad(x, z) {
    let best = 1e9, yaw = 0;
    for (const [ax, az, bx, bz] of this._roadSegs) {
      const abx = bx - ax, abz = bz - az;
      const ab2 = abx * abx + abz * abz || 1;
      let t = ((x - ax) * abx + (z - az) * abz) / ab2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + abx * t, pz = az + abz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; yaw = Math.atan2(px - x, pz - z); }
    }
    return yaw;
  }

  // ── vegetation ───────────────────────────────────────
  _oliveAt(x, z, y, s = 1) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.4 * s, 1.6 * s, 7),
      new THREE.MeshLambertMaterial({ color: '#6e5b3e' }));
    trunk.position.set(x, y + 0.8 * s, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 1),
      new THREE.MeshLambertMaterial({ color: '#7c8f66' }));
    crown.position.set(x, y + 2.3 * s, z);
    crown.scale.y = 0.72;
    trunk.castShadow = crown.castShadow = true;
    this.scene.add(trunk, crown);
  }

  _buildTrees() {
    const rng = mulberry32(5758);
    const kinds = {
      cypress: {
        geo: new THREE.ConeGeometry(1.05, 7.5, 7),
        mat: new THREE.MeshLambertMaterial({ color: '#2f4a2b' }),
        yOff: 3.75, n: 480,
      },
      olive: {
        geo: new THREE.IcosahedronGeometry(1.7, 1),
        mat: new THREE.MeshLambertMaterial({ color: '#7c8f66' }),
        yOff: 2.6, n: 420, squash: 0.7, trunk: true,
      },
      pine: {
        geo: new THREE.SphereGeometry(2.6, 8, 6),
        mat: new THREE.MeshLambertMaterial({ color: '#3d5f33' }),
        yOff: 5.4, n: 300, squash: 0.55, trunk: true, trunkH: 4.6,
      },
      palm: null, // built separately
    };
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 4.2, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#6e5b3e' });
    const dummy = new THREE.Object3D();

    for (const key of ['cypress', 'olive', 'pine']) {
      const k = kinds[key];
      const inst = new THREE.InstancedMesh(k.geo, k.mat, k.n);
      const trunks = k.trunk ? new THREE.InstancedMesh(trunkGeo, trunkMat, k.n) : null;
      let c = 0;
      let guard = 0;
      while (c < k.n && guard++ < k.n * 30) {
        const x = (rng() * 2 - 1) * WORLD.size * 0.48;
        const z = (rng() * 2 - 1) * WORLD.size * 0.48;
        const rd = this.roadDist(x, z);
        if (rd < 6) continue;
        const park = this.inPark(x, z);
        // denser in parks and on open hillsides, sparse inside dense housing
        if (!park && rd < 26 && rng() < 0.72) continue;
        if (this._reserved && this._reserved.some(rv => Math.hypot(rv.x - x, rv.z - z) < rv.r + 4)) continue;
        const y = this.heightAt(x, z);
        const s = 0.7 + rng() * 0.8;
        dummy.position.set(x, y + k.yOff * s * (k.squash || 1), z);
        dummy.scale.set(s, s * (k.squash || 1), s);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(c, dummy.matrix);
        if (trunks) {
          dummy.position.set(x, y + (k.trunkH || 2.1) * s / 2, z);
          dummy.scale.set(s, s * ((k.trunkH || 4.2) / 4.2), s);
          dummy.updateMatrix();
          trunks.setMatrixAt(c, dummy.matrix);
        }
        c++;
      }
      inst.count = c;
      inst.castShadow = true;
      this.scene.add(inst);
      if (trunks) { trunks.count = c; this.scene.add(trunks); }
    }

    // palms along the boulevards
    const frondGeo = new THREE.ConeGeometry(1.55, 1.0, 7);
    const frondMat = new THREE.MeshLambertMaterial({ color: '#4f7a34' });
    const pTrunkGeo = new THREE.CylinderGeometry(0.26, 0.38, 8.5, 7);
    const palms = [];
    for (const r of ROADS) {
      if (r.kind !== 'boulevard') continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
        const d = Math.hypot(bx - ax, bz - az), n = Math.floor(d / 42);
        for (let s = 1; s <= n; s++) {
          const t = s / (n + 1);
          const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          const ox = -(bz - az) / d * (r.width / 2 + 3.4), oz = (bx - ax) / d * (r.width / 2 + 3.4);
          palms.push([x + ox, z + oz], [x - ox, z - oz]);
        }
      }
    }
    const pt = new THREE.InstancedMesh(pTrunkGeo, trunkMat, palms.length);
    const pf = new THREE.InstancedMesh(frondGeo, frondMat, palms.length);
    palms.forEach(([x, z], i) => {
      const y = this.heightAt(x, z);
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, y + 4.25, z); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      pt.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y + 8.9, z); dummy.scale.set(1, 1.3, 1); dummy.updateMatrix();
      pf.setMatrixAt(i, dummy.matrix);
    });
    pt.castShadow = pf.castShadow = true;
    this.scene.add(pt, pf);
  }

  _buildStreetlights() {
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6.5, 6);
    const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: '#565b60' });
    const headMat = new THREE.MeshLambertMaterial({ color: '#fff6cf', emissive: '#000000' });
    this.lampMats.push(headMat);
    const spots = [];
    for (const r of ROADS) {
      if (r.kind === 'rail') continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
        const d = Math.hypot(bx - ax, bz - az), n = Math.floor(d / 55);
        for (let s = 1; s <= n; s++) {
          const t = s / (n + 1);
          const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          const side = s % 2 ? 1 : -1;
          const ox = -(bz - az) / d * (r.width / 2 + 1.6) * side;
          const oz = (bx - ax) / d * (r.width / 2 + 1.6) * side;
          spots.push([x + ox, z + oz]);
        }
      }
    }
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      const y = this.heightAt(x, z);
      dummy.position.set(x, y + 3.25, z); dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y + 6.6, z); dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    });
    this.scene.add(poles, heads);
  }

  setNight(night) {
    for (const m of this.nightMats) m.emissive.set(night ? '#ffffff' : '#000000');
    for (const m of this.lampMats) m.emissive.set(night ? '#ffdf8a' : '#000000');
  }

  // circle-collider pushback for the player
  collide(pos, radius = 0.9) {
    for (const c of this.colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 0.001) {
        pos.x = c.x + dx / d * min;
        pos.z = c.z + dz / d * min;
      }
    }
  }
}

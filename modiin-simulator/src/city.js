// ============================================================
// city.js — Terrain, roads, buildings, landmarks, props.
// ============================================================
import * as THREE from 'three';
import {
  WORLD_SIZE, TERRAIN_SEGMENTS, CITY_BOUNDS,
  STREETS, NEIGHBORHOODS, LANDMARKS,
  BUILDING_COLORS, ROOF_COLORS,
  SIDEWALK_WIDTH,
} from './config.js';

// ----- Seeded RNG so every run looks identical -----
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1977);
const rr = (a, b) => a + (b - a) * rand();
const ri = (a, b) => Math.floor(rr(a, b + 1));

// ----- Terrain height field --------------------------------
// Combine low-frequency rolling hills with a bowl-like depression
// inside the city footprint so the center feels flatter.
function valueNoise(x, y, freq) {
  const s = Math.sin(x * freq * 12.9898 + y * freq * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function fbm(x, y) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) {
    v += a * valueNoise(x + i * 17.3, y - i * 11.1, f * 0.0018);
    a *= 0.5; f *= 2;
  }
  return v;
}
// ----- Terrain: Modi'in sits on foothills. West is low (valley floor
// near the station), center has Titura Hill (archaeological mound),
// east rises to Moriah ridge. Anabe Park is a shallow basin east.
export function terrainHeight(x, z) {
  // Large-scale west-to-east rise (a few meters over several km).
  const eastRise = (x + 2100) * 0.0055;                 // ~ +22m across the city
  // Perimeter hills mask (only active outside city bounds).
  const outCity = THREE.MathUtils.smoothstep(
    Math.max(
      Math.abs(x) - (CITY_BOUNDS.maxX - 40),
      Math.abs(z) - (CITY_BOUNDS.maxZ - 40)
    ), 0, 400
  );
  const hills = (fbm(x, z) - 0.5) * 60 * outCity;
  // Small in-city undulations so driving doesn't feel dead-flat.
  const undul = (fbm(x * 0.5 + 800, z * 0.5 - 400) - 0.5) * 3;
  // Titura Hill — a prominent archaeological mound near city center.
  const titDist = Math.hypot(x - 50, z - 30);
  const titura = Math.max(0, (1 - titDist / 110)) * 42;
  // Anabe bowl — a gentle depression where the lake sits.
  const anabeDist = Math.hypot(x - 1700, z - 250);
  const anabe = -Math.max(0, 1 - anabeDist / 220) * 5;
  // Highway cuts: 443 north and 431 south sit in shallow grooves.
  const cut443 = -Math.max(0, 1 - Math.abs(z + 920) / 60) * 4;
  const cut431 = -Math.max(0, 1 - Math.abs(z - 960) / 60) * 4;
  return eastRise + hills + undul + titura + anabe + cut443 + cut431;
}

// Distance from (x,z) to the nearest street centerline, along with
// the street it was closest to. Used for paving and keeping buildings
// off roads.
export function nearestStreet(x, z) {
  let bestD = Infinity, bestStreet = null;
  for (const s of STREETS) {
    for (let i = 0; i < s.path.length - 1; i++) {
      const [ax, az] = s.path[i], [bx, bz] = s.path[i + 1];
      const d = distToSegment(x, z, ax, az, bx, bz);
      if (d < bestD) { bestD = d; bestStreet = s; }
    }
  }
  return { d: bestD, street: bestStreet };
}
export function roadDistance(x, z) { return nearestStreet(x, z).d; }

// Minimum lateral distance to be "on" the nearest street's pavement.
export function pavedWidth(street) {
  return street.width * 0.55;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  if (L2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ----- Build the terrain mesh ------------------------------
export function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let h = terrainHeight(x, z);
    const ns = nearestStreet(x, z);
    const paved = ns.street ? pavedWidth(ns.street) : 0;
    if (ns.d < paved + SIDEWALK_WIDTH) {
      // Pull road surface down to the terrain-at-centerline (smooth conform).
      h = THREE.MathUtils.lerp(h, terrainHeight(x, z) - 0.05, 0.85);
    }
    pos.setY(i, h);

    const inCity =
      x > CITY_BOUNDS.minX - 50 && x < CITY_BOUNDS.maxX + 50 &&
      z > CITY_BOUNDS.minZ - 50 && z < CITY_BOUNDS.maxZ + 50;

    if (ns.d < paved) {
      c.setHex(ns.street.type === 'highway' ? 0x23262c : 0x2c2f36);
    } else if (ns.d < paved + SIDEWALK_WIDTH) {
      c.setHex(0xbdb6a6);                                  // sidewalk
    } else if (inCity) {
      c.setHex(0x8aa16a);                                  // lawns / medians
      if (rand() < 0.18) c.offsetHSL(0, 0, rr(-0.05, 0.05));
    } else {
      // Judean foothills: tan & ochre, darker where elevation rises.
      const t = THREE.MathUtils.clamp((h + 10) / 40, 0, 1);
      c.setRGB(0.56 + t * 0.12, 0.50 + t * 0.08, 0.34 + t * 0.04);
      if (rand() < 0.08) c.offsetHSL(0, 0, rr(-0.05, 0.05));
    }
    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}

// ----- Roads: build a triangulated ribbon from each street's polyline.
function streetRibbon(path, width, yOffset = 0.06) {
  const positions = [], indices = [], uvs = [];
  const half = width / 2;
  let cumulative = 0;

  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i];
    // Tangent (average of adjacent segments)
    let tx, tz;
    if (i === 0)                       { tx = path[1][0] - x; tz = path[1][1] - z; }
    else if (i === path.length - 1)    { tx = x - path[i-1][0]; tz = z - path[i-1][1]; }
    else                                { tx = path[i+1][0] - path[i-1][0]; tz = path[i+1][1] - path[i-1][1]; }
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;           // left perpendicular

    positions.push(x + nx * half, yOffset, z + nz * half);
    positions.push(x - nx * half, yOffset, z - nz * half);
    uvs.push(0, cumulative / width, 1, cumulative / width);

    if (i < path.length - 1) {
      cumulative += Math.hypot(path[i+1][0] - x, path[i+1][1] - z);
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = a + 2, d = b + 2;
    indices.push(a, b, c, c, b, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildRoads(scene) {
  const group = new THREE.Group();
  group.name = 'roads';

  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x2c2f36, roughness: 0.9, metalness: 0.0,
  });
  const highwayMat = new THREE.MeshStandardMaterial({
    color: 0x23262c, roughness: 0.85, metalness: 0.0,
  });

  for (const s of STREETS) {
    const mat = s.type === 'highway' ? highwayMat : asphaltMat;
    const geo = streetRibbon(s.path, s.width);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.userData.street = s;
    group.add(mesh);

    // Center lane stripe (slightly brighter) for arterials+highways.
    if (s.type === 'highway' || s.type === 'arterial' || s.type === 'spine') {
      const stripe = streetRibbon(s.path, 0.3, 0.07);
      const stripeMat = new THREE.MeshBasicMaterial({
        color: s.type === 'highway' ? 0xffffff : 0xf0e07b, transparent: true, opacity: 0.85,
      });
      group.add(new THREE.Mesh(stripe, stripeMat));
    }
  }

  // Crosswalks wherever two streets cross (rough intersection detection).
  const crosswalkMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.9,
  });
  const crosswalks = new THREE.Group();
  for (let i = 0; i < STREETS.length; i++) {
    for (let j = i + 1; j < STREETS.length; j++) {
      const isect = findIntersection(STREETS[i], STREETS[j]);
      if (!isect) continue;
      // Draw two hashed strips aligned with each street's tangent.
      for (const s of [STREETS[i], STREETS[j]]) {
        if (s.type === 'highway') continue;
        const { ang } = streetTangentAt(s, isect.x, isect.z);
        const perpA = ang + Math.PI / 2;
        const offset = (Math.max(STREETS[i].width, STREETS[j].width) / 2 + 1.5);
        for (let sgn of [-1, 1]) {
          for (let k = -3; k <= 3; k++) {
            const stripe = new THREE.Mesh(
              new THREE.PlaneGeometry(0.6, 3),
              crosswalkMat
            );
            stripe.rotation.x = -Math.PI / 2;
            stripe.rotation.z = ang;
            const cx = isect.x + Math.cos(ang) * offset * sgn + Math.cos(perpA) * k * 0.9;
            const cz = isect.z + Math.sin(ang) * offset * sgn + Math.sin(perpA) * k * 0.9;
            stripe.position.set(cx, 0.08, cz);
            crosswalks.add(stripe);
          }
        }
      }
    }
  }
  group.add(crosswalks);

  scene.add(group);
  return group;
}

function findIntersection(a, b) {
  for (let i = 0; i < a.path.length - 1; i++) {
    for (let j = 0; j < b.path.length - 1; j++) {
      const p = segIntersect(a.path[i], a.path[i+1], b.path[j], b.path[j+1]);
      if (p) return { x: p[0], z: p[1] };
    }
  }
  return null;
}
function segIntersect(A, B, C, D) {
  const r = [B[0] - A[0], B[1] - A[1]];
  const s = [D[0] - C[0], D[1] - C[1]];
  const rxs = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(rxs) < 1e-6) return null;
  const qp = [C[0] - A[0], C[1] - A[1]];
  const t = (qp[0] * s[1] - qp[1] * s[0]) / rxs;
  const u = (qp[0] * r[1] - qp[1] * r[0]) / rxs;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [A[0] + t * r[0], A[1] + t * r[1]];
}

// ----- Labels via canvas sprite -----
export function makeLabel(text, subText = "", color = '#ffd277') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);

  // Background pill
  const pillPad = 18;
  ctx.fillStyle = 'rgba(10, 18, 34, 0.82)';
  roundRect(ctx, 10, 60, 492, 130, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(255, 210, 119, 0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 10, 60, 492, 130, 22); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 44px -apple-system, Helvetica, Arial';
  ctx.fillText(text, 256, 118);
  if (subText) {
    ctx.fillStyle = '#aac8ff';
    ctx.font = '28px -apple-system, Helvetica, Arial';
    ctx.fillText(subText, 256, 162);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(44, 22, 1);
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ----- Window texture (procedural) -----
const windowTextureCache = new Map();
function windowTexture(floors, baseColor) {
  const key = `${floors}_${baseColor}`;
  if (windowTextureCache.has(key)) return windowTextureCache.get(key);

  const w = 128, h = floors * 32;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const c = new THREE.Color(baseColor);
  ctx.fillStyle = `rgb(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0})`;
  ctx.fillRect(0, 0, w, h);

  // Subtle limestone banding
  for (let f = 0; f <= floors; f++) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.04})`;
    ctx.fillRect(0, f * 32 - 1, w, 2);
  }

  // Windows
  for (let f = 0; f < floors; f++) {
    for (let wi = 0; wi < 4; wi++) {
      const lit = rand() < 0.35;
      ctx.fillStyle = lit ? '#fff3bd' : '#24314a';
      const px = 12 + wi * 28;
      const py = f * 32 + 10;
      ctx.fillRect(px, py, 16, 16);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, 16, 16);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  windowTextureCache.set(key, tex);
  return tex;
}

// ----- Procedural buildings -----
function makeBuilding(width, depth, floors, color, roofColor) {
  const g = new THREE.Group();
  const h = floors * 3.2;
  const tex = windowTexture(floors, color);
  tex.repeat.set(Math.max(1, Math.round(width / 4)), 1);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, h, depth),
    [
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
    ]
  );
  body.position.y = h / 2;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // Roof: most residential blocks in Modi'in wear a pitched terra-cotta
  // tile roof (a Safdie signature). Taller buildings get a flat cap.
  if (floors <= 5 && rand() < 0.88) {
    // Build a gable: two triangular ends + two sloped rectangles.
    const ridgeH = Math.min(width, depth) * 0.35;
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.9 });
    // Sloped panels
    const slopeLen = Math.sqrt((width / 2) ** 2 + ridgeH ** 2);
    const slope = new THREE.PlaneGeometry(depth + 0.3, slopeLen);
    for (const sgn of [-1, 1]) {
      const panel = new THREE.Mesh(slope, roofMat);
      panel.rotation.y = Math.PI / 2;
      panel.rotation.x = -sgn * Math.atan2(width / 2, ridgeH);
      panel.position.set(sgn * width / 4, h + ridgeH / 2, 0);
      panel.castShadow = true;
      panel.receiveShadow = true;
      g.add(panel);
    }
    // Gable end walls (triangular)
    const gableMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    for (const sgn of [-1, 1]) {
      const tri = new THREE.Shape();
      tri.moveTo(-width / 2, 0);
      tri.lineTo( width / 2, 0);
      tri.lineTo(0, ridgeH);
      tri.closePath();
      const triGeo = new THREE.ShapeGeometry(tri);
      const end = new THREE.Mesh(triGeo, gableMat);
      end.position.set(0, h, sgn * depth / 2);
      end.rotation.y = sgn > 0 ? 0 : Math.PI;
      g.add(end);
    }
  } else {
    // Flat parapet cap for taller / occasional modern buildings.
    const roofH = 0.7;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.4, roofH, depth + 0.4),
      new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.9 })
    );
    roof.position.y = h + roofH / 2;
    roof.castShadow = true;
    g.add(roof);
  }

  // Occasional rooftop water tanks (very common on Israeli homes).
  // For pitched roofs, sit the tank on the roof ridge; for flat caps,
  // just above the parapet.
  if (floors <= 3 && rand() < 0.7) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.7 })
    );
    tank.position.set(
      rr(-width / 2 + 1, width / 2 - 1),
      h + Math.min(width, depth) * 0.18 + 0.45,
      rr(-depth / 2 + 1, depth / 2 - 1)
    );
    g.add(tank);
  }
  return g;
}

// Populate each neighborhood AABB with buildings on a jittered grid,
// rotating each to face the nearest street.
export function buildBuildings(scene) {
  const group = new THREE.Group();
  group.name = 'buildings';
  const STEP = 22;

  for (const n of NEIGHBORHOODS) {
    const [x0, z0, x1, z1] = n.aabb;
    const isCenter = n.key === 'heart' || n.key === 'mercaz';
    for (let x = x0 + 10; x < x1 - 10; x += STEP) {
      for (let z = z0 + 10; z < z1 - 10; z += STEP) {
        if (rand() < 0.18) continue;                   // plaza gaps
        const jx = rr(-6, 6), jz = rr(-6, 6);
        const px = x + jx, pz = z + jz;

        const ns = nearestStreet(px, pz);
        if (!ns.street || ns.d < pavedWidth(ns.street) + 3) continue;
        if (overlapsLandmark(px, pz, 8)) continue;

        // Face the nearest street: compute tangent at closest point.
        const { ang } = streetTangentAt(ns.street, px, pz);
        const faceAng = ang + Math.PI / 2;

        // Taller in the Heart; shorter at city edges.
        const floors = isCenter ? ri(4, 7) : ri(2, 5);
        const width = rr(9, 14);
        const depth = rr(9, 13);
        const color = BUILDING_COLORS[ri(0, BUILDING_COLORS.length - 1)];
        const roof  = ROOF_COLORS[ri(0, ROOF_COLORS.length - 1)];
        const b = makeBuilding(width, depth, floors, color, roof);
        b.position.set(px, terrainHeight(px, pz), pz);
        b.rotation.y = faceAng + rr(-0.05, 0.05);
        group.add(b);
      }
    }
  }

  scene.add(group);
  return group;
}

// Return unit tangent angle of a street near (x,z).
function streetTangentAt(street, x, z) {
  let best = Infinity, bestI = 0;
  for (let i = 0; i < street.path.length - 1; i++) {
    const [ax, az] = street.path[i], [bx, bz] = street.path[i + 1];
    const d = distToSegment(x, z, ax, az, bx, bz);
    if (d < best) { best = d; bestI = i; }
  }
  const [ax, az] = street.path[bestI];
  const [bx, bz] = street.path[bestI + 1];
  return { ang: Math.atan2(bz - az, bx - ax) };
}

function overlapsLandmark(x, z, pad = 0) {
  for (const lm of LANDMARKS) {
    const dx = x - lm.pos[0], dz = z - lm.pos[1];
    if (Math.abs(dx) < lm.size[0] / 2 + pad && Math.abs(dz) < lm.size[1] / 2 + pad) return true;
  }
  return false;
}

// ----- Landmarks -----
export function buildLandmarks(scene, labels, waterMeshes = []) {
  const group = new THREE.Group();
  group.name = 'landmarks';

  for (const lm of LANDMARKS) {
    const sub = new THREE.Group();
    // Sit the landmark on the current terrain height at its footprint center.
    sub.position.set(lm.pos[0], terrainHeight(lm.pos[0], lm.pos[1]), lm.pos[1]);

    if (lm.type === 'park') {
      // Flat green pad + lake + trees
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(lm.size[0], lm.size[1]),
        new THREE.MeshStandardMaterial({ color: 0x6a9a4c, roughness: 0.95 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.08;
      pad.receiveShadow = true;
      sub.add(pad);

      // Animated lake surface: the Y of each vertex drifts to simulate
      // ripples. Marked with userData.waterTime so main.js can tick it.
      const lakeR = Math.min(lm.size[0], lm.size[1]) * 0.3;
      const lakeGeo = new THREE.CircleGeometry(lakeR, 72);
      const lake = new THREE.Mesh(
        lakeGeo,
        new THREE.MeshStandardMaterial({
          color: lm.accent, roughness: 0.18, metalness: 0.55,
          emissive: 0x123040, emissiveIntensity: 0.1,
        })
      );
      lake.rotation.x = -Math.PI / 2;
      lake.position.y = 0.12;
      lake.userData.water = true;
      lake.userData.basePos = lakeGeo.attributes.position.array.slice();
      sub.add(lake);
      waterMeshes.push(lake);

      // Boardwalk / pier
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.3, lakeR * 0.8),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 })
      );
      pier.position.set(lakeR * 0.7, 0.2, 0);
      pier.rotation.y = Math.PI / 2;
      sub.add(pier);

      // Amphitheater: concentric half-rings of seating facing a small
      // stage. Real Anabe Park has exactly this feature on its west side.
      const amphi = new THREE.Group();
      amphi.position.set(-lm.size[0] * 0.28, 0, -lm.size[1] * 0.22);
      for (let r = 0; r < 6; r++) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(8 + r * 1.8, 9.5 + r * 1.8, 32, 1, Math.PI, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0xcbc1a8, roughness: 0.95 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1 + r * 0.45;
        amphi.add(ring);
      }
      const stage = new THREE.Mesh(
        new THREE.CircleGeometry(6.5, 28),
        new THREE.MeshStandardMaterial({ color: 0x7e5b3a, roughness: 0.9 })
      );
      stage.rotation.x = -Math.PI / 2;
      stage.position.y = 0.2;
      amphi.add(stage);
      sub.add(amphi);

      // Small island in the middle of the lake
      const island = new THREE.Mesh(
        new THREE.CylinderGeometry(lakeR * 0.12, lakeR * 0.18, 0.7, 18),
        new THREE.MeshStandardMaterial({ color: 0x7a9856, roughness: 1 })
      );
      island.position.y = 0.35;
      sub.add(island);
      const islandTree = makeTree('cypress');
      islandTree.position.y = 0.7;
      sub.add(islandTree);

      // Trees
      for (let i = 0; i < 30; i++) {
        const t = makeTree();
        t.position.set(rr(-lm.size[0] / 2 + 6, lm.size[0] / 2 - 6), 0, rr(-lm.size[1] / 2 + 6, lm.size[1] / 2 - 6));
        if (Math.hypot(t.position.x, t.position.z) < Math.min(lm.size[0], lm.size[1]) * 0.32) continue;
        sub.add(t);
      }
    } else if (lm.type === 'forest') {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(lm.size[0], lm.size[1]),
        new THREE.MeshStandardMaterial({ color: lm.color, roughness: 0.95 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.07;
      sub.add(pad);
      for (let i = 0; i < 80; i++) {
        const t = makeTree(true);
        t.position.set(rr(-lm.size[0] / 2 + 4, lm.size[0] / 2 - 4), 0, rr(-lm.size[1] / 2 + 4, lm.size[1] / 2 - 4));
        sub.add(t);
      }
    } else if (lm.type === 'nature' || lm.type === 'hill') {
      // Archaeological mound (Titura). The mound shape is already
      // embedded in the terrain; here we add ruins + paths + flag.
      for (let i = 0; i < 5; i++) {
        const stone = new THREE.Mesh(
          new THREE.BoxGeometry(rr(3, 6), rr(1.2, 2.2), rr(3, 6)),
          new THREE.MeshStandardMaterial({ color: 0xc8b996, roughness: 1 })
        );
        const a = rr(0, Math.PI * 2), r = rr(20, 60);
        stone.position.set(Math.cos(a) * r, rr(20, 36), Math.sin(a) * r);
        stone.rotation.y = rr(0, Math.PI);
        stone.castShadow = true;
        sub.add(stone);
      }
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 8),
        new THREE.MeshStandardMaterial({ color: 0x999999 })
      );
      pole.position.y = 48;
      sub.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(3.5, 2.2),
        new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      flag.position.set(1.8, 51, 0);
      sub.add(flag);
    } else if (lm.type === 'distant' || lm.type === 'suburb') {
      // Cluster of low-detail cream boxes to fill the horizon.
      for (let i = 0; i < 24; i++) {
        const w = rr(10, 22), d = rr(10, 22), h = rr(lm.h * 0.6, lm.h);
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({ color: lm.color, roughness: 0.9 })
        );
        b.position.set(rr(-lm.size[0]/2, lm.size[0]/2), h / 2, rr(-lm.size[1]/2, lm.size[1]/2));
        b.castShadow = true; b.receiveShadow = true;
        sub.add(b);
      }
    } else if (lm.type === 'gateway') {
      // Tall sculptural gateway arch
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(2, lm.h, 2),
        new THREE.MeshStandardMaterial({ color: lm.color, roughness: 0.7 })
      );
      pillar.position.y = lm.h / 2;
      pillar.castShadow = true;
      sub.add(pillar);
      const top = new THREE.Mesh(
        new THREE.TorusGeometry(8, 0.6, 8, 16, Math.PI),
        new THREE.MeshStandardMaterial({ color: lm.accent, emissive: lm.accent, emissiveIntensity: 0.5 })
      );
      top.position.y = lm.h;
      top.rotation.x = Math.PI / 2;
      sub.add(top);
    } else {
      // Generic landmark building with accent band
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(lm.size[0], lm.h, lm.size[1]),
        new THREE.MeshStandardMaterial({ color: lm.color, roughness: 0.85 })
      );
      base.position.y = lm.h / 2;
      base.castShadow = true;
      base.receiveShadow = true;
      sub.add(base);

      const band = new THREE.Mesh(
        new THREE.BoxGeometry(lm.size[0] + 0.4, 2, lm.size[1] + 0.4),
        new THREE.MeshStandardMaterial({ color: lm.accent, emissive: lm.accent, emissiveIntensity: 0.25 })
      );
      band.position.y = lm.h - 2.5;
      sub.add(band);

      if (lm.type === 'station') {
        // Train station: long low building + canopy
        const canopy = new THREE.Mesh(
          new THREE.BoxGeometry(lm.size[0] * 1.15, 0.5, lm.size[1] + 8),
          new THREE.MeshStandardMaterial({ color: 0x2b4b72, roughness: 0.5, metalness: 0.6 })
        );
        canopy.position.y = lm.h + 2;
        sub.add(canopy);
      } else if (lm.type === 'mall') {
        // Central glass atrium on top
        const atrium = new THREE.Mesh(
          new THREE.CylinderGeometry(lm.size[0] * 0.3, lm.size[0] * 0.3, 10, 24),
          new THREE.MeshStandardMaterial({ color: 0x9cc8ff, roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.7 })
        );
        atrium.position.y = lm.h + 5;
        sub.add(atrium);
      } else if (lm.type === 'sport' && lm.key === 'stadium') {
        // Open stadium: ring of seating around a green pitch
        const pitch = new THREE.Mesh(
          new THREE.PlaneGeometry(lm.size[0] * 0.8, lm.size[1] * 0.7),
          new THREE.MeshStandardMaterial({ color: 0x35a14a })
        );
        pitch.rotation.x = -Math.PI / 2;
        pitch.position.y = 0.1;
        sub.add(pitch);
      }
    }

    // Floating label
    const label = makeLabel(lm.name, lm.nameHe);
    label.position.set(0, lm.h + 10, 0);
    sub.add(label);
    labels.push({ sprite: label, pos: new THREE.Vector3(lm.pos[0], 0, lm.pos[1]), baseY: lm.h + 10 });

    // Attach trigger for notice
    sub.userData.landmark = lm;
    group.add(sub);
  }

  scene.add(group);
  return group;
}

// ----- Props: trees, lamp posts --------------------------
// Tree species tuned for Mediterranean/Judean look.
export function makeTree(species = 'pine') {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2b, roughness: 1 });

  if (species === 'cypress') {
    // Tall narrow spire (classic Italian / graveyard cypress).
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 6), trunkMat);
    trunk.position.y = 0.6; g.add(trunk);
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 6.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x2e5028, roughness: 1 })
    );
    spire.position.y = 4.5; spire.castShadow = true; g.add(spire);
  } else if (species === 'olive') {
    // Short, silvery, gnarled canopy.
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.6, 6), trunkMat);
    trunk.position.y = 0.8; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const bunch = new THREE.Mesh(
        new THREE.SphereGeometry(0.9 + rand() * 0.3, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x8a9d70, roughness: 1 })
      );
      bunch.position.set(rr(-0.7, 0.7), 2 + rr(-0.2, 0.4), rr(-0.7, 0.7));
      bunch.castShadow = true;
      g.add(bunch);
    }
  } else if (species === 'palm') {
    // Date palm: tall trunk, spray of fronds.
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0x8d6a3a, roughness: 1 })
    );
    trunk.position.y = 3; trunk.castShadow = true; g.add(trunk);
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x56893a, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), frondMat);
      const a = (i / 7) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 0.9, 6 + rand() * 0.2, Math.sin(a) * 0.9);
      frond.rotation.y = a;
      frond.rotation.z = -0.6;
      g.add(frond);
    }
  } else if (species === 'jacaranda') {
    // Purple-blooming shade tree (street trees in spring).
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 6), trunkMat);
    trunk.position.y = 1.2; g.add(trunk);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.8 + rand() * 0.5, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x8b68c8, roughness: 1 })
    );
    canopy.position.y = 3.3; canopy.castShadow = true; g.add(canopy);
  } else {
    // Pine (Jerusalem pine default)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 6), trunkMat);
    trunk.position.y = 1.1; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.5 - i * 0.3, 1.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a6a34, roughness: 1 })
      );
      cone.position.y = 2 + i * 1.0;
      cone.castShadow = true;
      g.add(cone);
    }
  }

  const s = rr(0.85, 1.2);
  g.scale.set(s, s, s);
  return g;
}

function pickSpecies() {
  const r = rand();
  if (r < 0.35) return 'pine';
  if (r < 0.55) return 'cypress';
  if (r < 0.75) return 'olive';
  if (r < 0.90) return 'jacaranda';
  return 'palm';
}

function makeBusStop() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 })
  );
  pole.position.y = 1.6;
  g.add(pole);
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.12, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.5, metalness: 0.2 })
  );
  canopy.position.set(0, 2.5, 0);
  g.add(canopy);
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.2, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.9 })
  );
  bench.position.set(0, 0.6, 0);
  g.add(bench);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.9, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x6688aa, emissiveIntensity: 0.15 })
  );
  sign.position.set(1.5, 2.2, 0);
  g.add(sign);
  return g;
}

function makeParkedCar() {
  const g = new THREE.Group();
  const palette = [0x2c4c8a, 0x8a3a3a, 0xdadada, 0x4a4a4a, 0x2a6a4a, 0xe1a227, 0x6a5a3a];
  const color = palette[ri(0, palette.length - 1)];
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.55, 4.2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.3 })
  );
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  g.add(chassis);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.6, 2.1),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
  );
  cabin.position.set(0, 1.1, -0.1);
  g.add(cabin);
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.55, 2),
    new THREE.MeshStandardMaterial({ color: 0x1a2330, roughness: 0.3, metalness: 0.7, transparent: true, opacity: 0.8 })
  );
  win.position.set(0, 1.15, -0.1);
  g.add(win);
  return g;
}

function makeLampPost() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 })
  );
  pole.position.y = 3;
  g.add(pole);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffe6a8, emissive: 0xffd577, emissiveIntensity: 0.0,
    })
  );
  head.position.y = 6.1;
  g.add(head);
  g.userData.bulb = head;
  return g;
}

export function buildProps(scene) {
  const trees = new THREE.Group();
  const lamps = new THREE.Group();
  trees.name = 'trees';
  lamps.name = 'lamps';

  // Street trees & lamps along every street (except highways — too fast).
  for (const s of STREETS) {
    if (s.type === 'highway') continue;
    const totalLen = pathLength(s.path);
    const spacing = 18;
    const n = Math.floor(totalLen / spacing);
    const half = s.width / 2 + SIDEWALK_WIDTH + 1;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const { x, z, nx, nz } = samplePath(s.path, i * spacing);
      const tx = x + nx * half * side, tz = z + nz * half * side;
      if (overlapsLandmark(tx, tz, 2)) continue;
      // Species choice by street type
      const species = s.type === 'spine' || s.type === 'arterial'
        ? (rand() < 0.6 ? 'jacaranda' : 'palm')
        : pickSpecies();
      const t = makeTree(species);
      t.position.set(tx, terrainHeight(tx, tz), tz);
      trees.add(t);
      if (i % 3 === 0) {
        const lp = makeLampPost();
        lp.position.set(tx - nx * side * 0.8, terrainHeight(tx, tz), tz - nz * side * 0.8);
        lamps.add(lp);
      }
    }
  }

  // Bus stops along arterials & the spine — small canopy + pole + bench.
  for (const s of STREETS) {
    if (s.type !== 'spine' && s.type !== 'arterial') continue;
    const total = pathLength(s.path);
    const spacing = 220;
    for (let d = 140; d < total; d += spacing) {
      const side = (Math.floor(d / spacing) % 2 === 0) ? 1 : -1;
      const { x, z, nx, nz } = samplePath(s.path, d);
      const bx = x + nx * (s.width / 2 + SIDEWALK_WIDTH - 0.4) * side;
      const bz = z + nz * (s.width / 2 + SIDEWALK_WIDTH - 0.4) * side;
      if (overlapsLandmark(bx, bz, 2)) continue;
      const stop = makeBusStop();
      stop.position.set(bx, terrainHeight(bx, bz), bz);
      stop.rotation.y = Math.atan2(nx * side, nz * side);
      scene.add(stop);
    }
  }

  // Parked cars along collector streets in neighborhoods.
  for (const s of STREETS) {
    if (s.type !== 'collector') continue;
    const total = pathLength(s.path);
    for (let d = 18; d < total; d += rr(14, 28)) {
      if (rand() < 0.45) continue;
      const side = rand() < 0.5 ? 1 : -1;
      const { x, z, tx, tz, nx, nz } = samplePath(s.path, d);
      const px = x + nx * (s.width / 2 + 1.3) * side;
      const pz = z + nz * (s.width / 2 + 1.3) * side;
      if (overlapsLandmark(px, pz, 1)) continue;
      const car = makeParkedCar();
      car.position.set(px, terrainHeight(px, pz), pz);
      car.rotation.y = Math.atan2(tx, tz);
      scene.add(car);
    }
  }

  // Scatter pines + olives in the Judean foothills outside the city.
  for (let i = 0; i < 420; i++) {
    const x = rr(-WORLD_SIZE/2 + 40, WORLD_SIZE/2 - 40);
    const z = rr(-WORLD_SIZE/2 + 40, WORLD_SIZE/2 - 40);
    const inCityX = x > CITY_BOUNDS.minX - 20 && x < CITY_BOUNDS.maxX + 20;
    const inCityZ = z > CITY_BOUNDS.minZ - 20 && z < CITY_BOUNDS.maxZ + 20;
    if (inCityX && inCityZ) continue;
    if (roadDistance(x, z) < 15) continue;
    const species = rand() < 0.7 ? 'pine' : 'olive';
    const t = makeTree(species);
    t.position.set(x, terrainHeight(x, z), z);
    trees.add(t);
  }

  scene.add(trees);
  scene.add(lamps);
  return { trees, lamps };
}

function pathLength(p) {
  let s = 0;
  for (let i = 0; i < p.length - 1; i++) s += Math.hypot(p[i+1][0]-p[i][0], p[i+1][1]-p[i][1]);
  return s;
}

function samplePath(path, dist) {
  let remaining = dist;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const segLen = Math.hypot(bx - ax, bz - az);
    if (remaining <= segLen) {
      const t = remaining / segLen;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const tx = (bx - ax) / segLen, tz = (bz - az) / segLen;
      return { x, z, tx, tz, nx: -tz, nz: tx };
    }
    remaining -= segLen;
  }
  const last = path[path.length - 1];
  return { x: last[0], z: last[1], tx: 1, tz: 0, nx: 0, nz: 1 };
}

// ----- Skybox / sky sphere -----
export function buildSky(scene) {
  const geo = new THREE.SphereGeometry(WORLD_SIZE * 0.9, 32, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0x87c0ea, side: THREE.BackSide });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  scene.add(sky);
  return sky;
}

// ----- Distant mountain silhouettes (two rings at the horizon) -----
export function buildHorizon(scene) {
  const group = new THREE.Group();
  group.name = 'horizon';

  function ring(radius, amplitude, baseY, color, segments = 96) {
    const positions = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const noise = Math.sin(a * 11) * 0.4 + Math.sin(a * 17.3) * 0.3 + Math.sin(a * 5.1) * 0.3;
      const h = baseY + amplitude * (0.6 + 0.4 * noise);
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      positions.push(x, baseY, z);                              // base
      positions.push(x, h, z);                                  // peak
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b = i * 2 + 1, c = a + 2, d = b + 2;
      indices.push(a, b, c, c, b, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true });
    return new THREE.Mesh(g, m);
  }

  // Far ridge (Judean hills in the east toward Jerusalem)
  group.add(ring(2400, 180, 0, 0x4a5a6a, 120));
  // Nearer ridge (Ben Shemen / Lapid foothills)
  group.add(ring(1800, 110, 0, 0x5c6b74, 96));

  scene.add(group);
  return group;
}

// ----- Neighborhood lookup (for HUD) -----
export function lookupLocation(x, z) {
  // Nearest landmark
  let nearest = null, bestD = Infinity;
  for (const lm of LANDMARKS) {
    const dd = Math.hypot(x - lm.pos[0], z - lm.pos[1]);
    if (dd < bestD) { bestD = dd; nearest = { lm, d: dd }; }
  }

  // Nearest street name
  const ns = nearestStreet(x, z);
  let street = "Off-road";
  if (ns.street) {
    const w = pavedWidth(ns.street) + SIDEWALK_WIDTH + 4;
    street = ns.d < w ? ns.street.name : `near ${ns.street.name}`;
  }

  // Neighborhood by AABB
  let nb = "Modi'in";
  const inCity =
    x > CITY_BOUNDS.minX && x < CITY_BOUNDS.maxX &&
    z > CITY_BOUNDS.minZ && z < CITY_BOUNDS.maxZ;
  if (!inCity) {
    if (z < CITY_BOUNDS.minZ) nb = "Judean Foothills (N)";
    else if (z > CITY_BOUNDS.maxZ) nb = "Judean Foothills (S)";
    else if (x < CITY_BOUNDS.minX) nb = "Ayalon Valley";
    else nb = "Eastern Ridge";
  } else {
    for (const n of NEIGHBORHOODS) {
      const [x0, z0, x1, z1] = n.aabb;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) { nb = n.name; break; }
    }
  }
  return { neighborhood: nb, street, nearest };
}

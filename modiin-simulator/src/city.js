// ============================================================
// city.js — Terrain, roads, buildings, landmarks, props.
// ============================================================
import * as THREE from 'three';
import {
  WORLD_SIZE, TERRAIN_SEGMENTS, CITY_RADIUS,
  RINGS, RADIAL_COUNT, NEIGHBORHOODS, LANDMARKS,
  BUILDING_COLORS, ROOF_COLORS,
  ROAD_WIDTH, SIDEWALK_WIDTH, DEG,
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
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  // "outside" is 0 inside the city (flat) and 1 in the surrounding hills.
  const outside = THREE.MathUtils.smoothstep(d, CITY_RADIUS * 0.55, CITY_RADIUS * 1.1);
  const hills = (fbm(x, z) - 0.5) * 55;
  const ridge = Math.sin(x * 0.0009) * Math.cos(z * 0.0012) * 6 * outside;
  // Gentle Anabe depression east of center
  const anabeDist = Math.hypot(x - 1050, z - 150);
  const anabe = -Math.max(0, 18 - anabeDist * 0.02) * 0.4;
  return hills * outside + ridge + anabe;
}

// Distance from point to nearest road — used to flatten + pave.
export function roadDistance(x, z) {
  const d = Math.hypot(x, z);
  let best = Infinity;

  // Ring roads
  for (const ring of RINGS) {
    best = Math.min(best, Math.abs(d - ring.r));
  }
  // Radial avenues, only within outer ring
  if (d < RINGS[RINGS.length - 1].r + 40) {
    const a = Math.atan2(z, x);
    const step = (Math.PI * 2) / RADIAL_COUNT;
    const snapped = Math.round(a / step) * step;
    const perp = Math.abs(Math.sin(a - snapped)) * d;
    if (d > 40) best = Math.min(best, perp);
  }
  // Spurs to outlying landmarks (train station + Anabe + forest)
  const spurs = [
    [-650, 780], [1050, 150], [1300, -900], [-1150, 450], [-900, -200],
  ];
  for (const [sx, sz] of spurs) {
    best = Math.min(best, distToSegment(x, z, 0, 0, sx, sz));
  }
  return best;
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
    const rd = roadDistance(x, z);
    if (rd < ROAD_WIDTH + SIDEWALK_WIDTH) {
      // Flatten roads + sidewalks
      h = THREE.MathUtils.lerp(h, 0, 0.9);
    }
    pos.setY(i, h);

    // Vertex color: grass, road, dirt, rock by elevation + proximity
    if (rd < ROAD_WIDTH) {
      c.setHex(0x2c2f36);                            // asphalt
    } else if (rd < ROAD_WIDTH + SIDEWALK_WIDTH) {
      c.setHex(0xbdb6a6);                            // sidewalk
    } else {
      const d = Math.hypot(x, z);
      const inCity = d < CITY_RADIUS;
      if (inCity) {
        c.setHex(0x8fa36a);                          // city greenery
        if (rand() < 0.15) c.offsetHSL(0, 0, rr(-0.04, 0.04));
      } else {
        // Outside city: hills → tan/ochre, higher → rockier
        const t = THREE.MathUtils.clamp((h + 20) / 40, 0, 1);
        c.setRGB(0.55 + t * 0.18, 0.50 + t * 0.10, 0.32 + t * 0.04);
      }
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

// ----- Roads as ribbons (slightly above terrain to avoid z-fight) -----
export function buildRoads(scene) {
  const group = new THREE.Group();
  group.name = 'roads';

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d34, roughness: 0.9, metalness: 0.0,
  });
  const laneMat = new THREE.MeshBasicMaterial({ color: 0xf0e07b });

  // Ring roads
  for (const ring of RINGS) {
    const g = new THREE.RingGeometry(ring.r - ROAD_WIDTH * 0.55, ring.r + ROAD_WIDTH * 0.55, 96);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, ringMat);
    m.position.y = 0.05;
    m.receiveShadow = true;
    group.add(m);

    // Dashed center line
    const lg = new THREE.RingGeometry(ring.r - 0.12, ring.r + 0.12, 96, 1, 0, Math.PI * 2);
    lg.rotateX(-Math.PI / 2);
    const dash = new THREE.Mesh(lg, laneMat);
    dash.position.y = 0.08;
    // Approximate dashes by scaling UV — easier: alpha test with a mask texture.
    dash.material = new THREE.MeshBasicMaterial({
      color: 0xf0e07b, transparent: true, opacity: 0.55,
    });
    group.add(dash);
  }

  // Radial avenues (straight bars from inner ring to outer)
  const radialLen = RINGS[RINGS.length - 1].r;
  const radialGeo = new THREE.PlaneGeometry(ROAD_WIDTH * 1.1, radialLen);
  radialGeo.rotateX(-Math.PI / 2);
  radialGeo.translate(0, 0.05, radialLen / 2);
  for (let i = 0; i < RADIAL_COUNT; i++) {
    const m = new THREE.Mesh(radialGeo.clone(), ringMat);
    m.rotation.y = (i * Math.PI * 2) / RADIAL_COUNT;
    m.receiveShadow = true;
    group.add(m);
  }

  // Spur roads out to distant landmarks
  const spurs = [
    { to: [-650, 780] }, { to: [1050, 150] },
    { to: [1300, -900] }, { to: [-1150, 450] }, { to: [-900, -200] },
  ];
  for (const { to } of spurs) {
    const len = Math.hypot(to[0], to[1]);
    const g = new THREE.PlaneGeometry(ROAD_WIDTH * 1.1, len);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.05, len / 2);
    const m = new THREE.Mesh(g, ringMat);
    m.rotation.y = -Math.atan2(to[1], to[0]) + Math.PI / 2;
    group.add(m);
  }

  scene.add(group);
  return group;
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

  // Pitched roof slab
  const roofH = 0.7;
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.5, roofH, depth + 0.5),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.85 })
  );
  roof.position.y = h + roofH / 2;
  roof.castShadow = true;
  g.add(roof);

  // Occasional rooftop water tanks (very common on Israeli homes)
  if (floors <= 3 && rand() < 0.7) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.7 })
    );
    tank.position.set(rr(-width / 2 + 1, width / 2 - 1), h + roofH + 0.45, rr(-depth / 2 + 1, depth / 2 - 1));
    g.add(tank);
  }
  return g;
}

// Populate each sector between ring roads with buildings facing the street.
export function buildBuildings(scene) {
  const group = new THREE.Group();
  group.name = 'buildings';

  for (let ri2 = 0; ri2 < RINGS.length - 1; ri2++) {
    const rInner = RINGS[ri2].r + ROAD_WIDTH + 3;
    const rOuter = RINGS[ri2 + 1].r - ROAD_WIDTH - 3;
    if (rOuter <= rInner) continue;
    for (let i = 0; i < RADIAL_COUNT * 3; i++) {
      const ang = (i / (RADIAL_COUNT * 3)) * Math.PI * 2;

      for (let r = rInner + 6; r < rOuter - 6; r += rr(12, 22)) {
        if (rand() < 0.10) continue;               // sparse voids for plazas
        const jitterA = rr(-0.03, 0.03);
        const x = Math.cos(ang + jitterA) * r;
        const z = Math.sin(ang + jitterA) * r;

        // Keep off roads + landmark footprints
        if (roadDistance(x, z) < ROAD_WIDTH + 3) continue;
        if (overlapsLandmark(x, z, 10)) continue;

        const floors = ri2 === 0 ? ri(3, 5) : ri2 === 1 ? ri(3, 6) : ri(2, 4);
        const width = rr(8, 14);
        const depth = rr(8, 13);
        const color = BUILDING_COLORS[ri(0, BUILDING_COLORS.length - 1)];
        const roof = ROOF_COLORS[ri(0, ROOF_COLORS.length - 1)];
        const b = makeBuilding(width, depth, floors, color, roof);
        b.position.set(x, 0, z);
        b.rotation.y = -ang + Math.PI / 2 + rr(-0.08, 0.08);
        group.add(b);
      }
    }
  }

  scene.add(group);
  return group;
}

function overlapsLandmark(x, z, pad = 0) {
  for (const lm of LANDMARKS) {
    const dx = x - lm.pos[0], dz = z - lm.pos[1];
    if (Math.abs(dx) < lm.size[0] / 2 + pad && Math.abs(dz) < lm.size[1] / 2 + pad) return true;
  }
  return false;
}

// ----- Landmarks -----
export function buildLandmarks(scene, labels) {
  const group = new THREE.Group();
  group.name = 'landmarks';

  for (const lm of LANDMARKS) {
    const sub = new THREE.Group();
    sub.position.set(lm.pos[0], 0, lm.pos[1]);

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

      // Lake
      const lake = new THREE.Mesh(
        new THREE.CircleGeometry(Math.min(lm.size[0], lm.size[1]) * 0.3, 40),
        new THREE.MeshStandardMaterial({ color: lm.accent, roughness: 0.25, metalness: 0.4 })
      );
      lake.rotation.x = -Math.PI / 2;
      lake.position.y = 0.12;
      sub.add(lake);

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
    } else if (lm.type === 'nature') {
      // Hill / archaeology mound
      const mound = new THREE.Mesh(
        new THREE.ConeGeometry(lm.size[0] * 0.9, lm.h, 12),
        new THREE.MeshStandardMaterial({ color: lm.color, roughness: 0.98 })
      );
      mound.position.y = lm.h / 2;
      mound.castShadow = true;
      sub.add(mound);
      // Flag on top
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 8),
        new THREE.MeshStandardMaterial({ color: 0x999999 })
      );
      pole.position.y = lm.h + 4;
      sub.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 2),
        new THREE.MeshStandardMaterial({ color: lm.accent, side: THREE.DoubleSide })
      );
      flag.position.set(1.5, lm.h + 7, 0);
      sub.add(flag);
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

// ----- Props: trees, lamp posts -----
export function makeTree(conifer = false) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2b, roughness: 1 })
  );
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  g.add(trunk);

  if (conifer) {
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.5 - i * 0.3, 1.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 1 })
      );
      cone.position.y = 2 + i * 1.0;
      cone.castShadow = true;
      g.add(cone);
    }
  } else {
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.4 + rand() * 0.5, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x558a3a, roughness: 1 })
    );
    canopy.position.y = 3;
    canopy.castShadow = true;
    g.add(canopy);
  }
  const s = rr(0.8, 1.3);
  g.scale.set(s, s, s);
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

  // Street trees along ring roads
  for (const ring of RINGS) {
    const circumference = 2 * Math.PI * ring.r;
    const count = Math.max(12, Math.floor(circumference / 22));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = ring.r + ROAD_WIDTH + SIDEWALK_WIDTH + 1.2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (overlapsLandmark(x, z, 2)) continue;
      const t = makeTree();
      t.position.set(x, 0, z);
      trees.add(t);

      if (i % 3 === 0) {
        const lp = makeLampPost();
        lp.position.set(x - Math.cos(a) * 0.6, 0, z - Math.sin(a) * 0.6);
        lamps.add(lp);
      }
    }
  }

  // Scatter trees in hills outside city
  for (let i = 0; i < 240; i++) {
    const a = rand() * Math.PI * 2;
    const r = rr(CITY_RADIUS + 50, WORLD_SIZE / 2 - 40);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const t = makeTree(rand() < 0.6);
    t.position.set(x, terrainHeight(x, z), z);
    trees.add(t);
  }

  scene.add(trees);
  scene.add(lamps);
  return { trees, lamps };
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

// ----- Neighborhood lookup (for HUD) -----
export function lookupLocation(x, z) {
  const d = Math.hypot(x, z);
  const a = (Math.atan2(z, x) * 180 / Math.PI + 360) % 360;

  // Nearest landmark within 100 m
  let nearest = null, bestD = Infinity;
  for (const lm of LANDMARKS) {
    const dd = Math.hypot(x - lm.pos[0], z - lm.pos[1]);
    if (dd < bestD) { bestD = dd; nearest = { lm, d: dd }; }
  }

  // Ring / street
  let street = "Outskirts";
  if (d < CITY_RADIUS + 40) {
    let bestRing = null, bestRd = Infinity;
    for (const ring of RINGS) {
      const rd = Math.abs(d - ring.r);
      if (rd < bestRd) { bestRd = rd; bestRing = ring; }
    }
    if (bestRing && bestRd < 40) street = bestRing.name;
    else street = "Side street";
  }

  // Neighborhood
  let nb = "Modi'in";
  for (const n of NEIGHBORHOODS) {
    const diff = Math.min(Math.abs(a - n.angle), 360 - Math.abs(a - n.angle));
    if (diff < 18 && d >= n.minR - 20 && d <= n.maxR + 20) { nb = n.name; break; }
  }
  if (d < 180) nb = "The Heart";
  if (d > CITY_RADIUS) nb = "Judean Foothills";

  return { neighborhood: nb, street, nearest };
}

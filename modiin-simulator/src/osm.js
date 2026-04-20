// ============================================================
// osm.js — Load data/osm.json (produced by tools/fetch-osm.mjs)
// and render its streets, buildings, parks, water and rails into
// the scene. When the file is missing we resolve to null so the
// caller can fall back to the hand-placed procedural city.
// ============================================================
import * as THREE from 'three';
import { terrainHeight } from './city.js';

// ---------- Loader ----------
export async function loadOSM(path = 'data/osm.json') {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const data = await res.json();
    console.log(`[osm] loaded ${data.streets.length} streets, ${data.buildings.length} buildings, ${data.areas.length} areas`);
    return data;
  } catch (err) {
    console.warn(`[osm] no OSM data (${err.message}); using procedural layout`);
    return null;
  }
}

// ---------- Road ribbons ----------
function ribbonGeometry(path, width, yOffset = 0.06) {
  const positions = [], indices = [];
  const half = width / 2;
  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i];
    let tx, tz;
    if (i === 0)                    { tx = path[1][0] - x; tz = path[1][1] - z; }
    else if (i === path.length - 1) { tx = x - path[i-1][0]; tz = z - path[i-1][1]; }
    else                            { tx = path[i+1][0] - path[i-1][0]; tz = path[i+1][1] - path[i-1][1]; }
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;
    positions.push(x + nx * half, yOffset, z + nz * half);
    positions.push(x - nx * half, yOffset, z - nz * half);
  }
  for (let i = 0; i < path.length - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = a + 2, d = b + 2;
    indices.push(a, b, c, c, b, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const ROAD_COLORS = {
  highway:   0x242731,
  spine:     0x2b2e36,
  arterial:  0x2e3138,
  ramp:      0x2e3138,
  collector: 0x323640,
  street:    0x363a44,
  service:   0x3a3e48,
};

export function buildOSMStreets(scene, osm) {
  const group = new THREE.Group();
  group.name = 'osm-streets';
  const matCache = new Map();
  for (const s of osm.streets) {
    if (s.path.length < 2) continue;
    const color = ROAD_COLORS[s.type] ?? ROAD_COLORS.street;
    if (!matCache.has(color)) {
      matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    }
    const geo = ribbonGeometry(s.path, s.width, 0.06);
    const m = new THREE.Mesh(geo, matCache.get(color));
    m.receiveShadow = true;
    m.userData.street = s;
    group.add(m);
  }
  scene.add(group);
  return group;
}

// ---------- Building footprints ----------
const LIMESTONE_PALETTE = [
  0xefe3c8, 0xe5d5b3, 0xdcc9a2, 0xf1e6cf, 0xd7c8a8,
  0xeaddbf, 0xe0d2b0, 0xf5ecd2, 0xd2c09a, 0xece1c3,
];
const ROOF_PALETTE = [0x7d3a2a, 0x6a4b35, 0x5a4534, 0x8a5540];

export function buildOSMBuildings(scene, osm) {
  const group = new THREE.Group();
  group.name = 'osm-buildings';

  // Shared material caches
  const bodyMats = LIMESTONE_PALETTE.map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
  );
  const roofMats = ROOF_PALETTE.map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
  );

  let rng = 1;
  const rnd = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };

  for (const b of osm.buildings) {
    if (b.polygon.length < 3) continue;

    // Discard improbably small slivers
    const poly = b.polygon;
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i];
      const [x2, z2] = poly[(i + 1) % poly.length];
      area += x1 * z2 - x2 * z1;
    }
    area = Math.abs(area) / 2;
    if (area < 20) continue;

    const shape = new THREE.Shape();
    shape.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i][0], poly[i][1]);
    shape.closePath();

    const height = Math.max(3, b.height || 10);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height, bevelEnabled: false, steps: 1,
    });
    geo.rotateX(-Math.PI / 2);                                // shape Y → world Y

    // Compute centroid for terrain base
    let cx = 0, cz = 0;
    for (const [x, z] of poly) { cx += x; cz += z; }
    cx /= poly.length; cz /= poly.length;
    const baseY = terrainHeight(cx, cz);

    const bodyMat = bodyMats[Math.floor(rnd() * bodyMats.length)];
    const mesh = new THREE.Mesh(geo, bodyMat);
    mesh.position.y = baseY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Flat-roof cap (cheap approximation of the universal cream-stone
    // parapet-or-tile look without doing per-footprint gable geometry).
    const roofShape = new THREE.Shape();
    roofShape.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) roofShape.lineTo(poly[i][0], poly[i][1]);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
      depth: 0.6, bevelEnabled: false, steps: 1,
    });
    roofGeo.rotateX(-Math.PI / 2);
    const roofMat = roofMats[Math.floor(rnd() * roofMats.length)];
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.y = baseY + height;
    roofMesh.castShadow = true;
    group.add(roofMesh);
  }
  scene.add(group);
  return group;
}

// ---------- Areas (parks, water, forests) ----------
const AREA_COLORS = {
  park:        0x6a9a4c,
  grass:       0x82a862,
  pitch:       0x4c8a3a,
  playground:  0xc1a85a,
  stadium:     0x5a8a42,
  sports:      0x8aa070,
  wood:        0x3d6a2c,
  scrub:       0x7a8a4a,
  water:       0x3a7aa8,
  cemetery:    0x9ba48f,
  industrial:  0xb0a990,
  school:      0xd7cfb8,
};

export function buildOSMAreas(scene, osm) {
  const group = new THREE.Group();
  group.name = 'osm-areas';
  const matCache = new Map();
  for (const a of osm.areas) {
    if (a.polygon.length < 3) continue;
    const color = AREA_COLORS[a.kind];
    if (color == null) continue;
    if (!matCache.has(a.kind)) {
      matCache.set(a.kind, new THREE.MeshStandardMaterial({
        color, roughness: a.kind === 'water' ? 0.25 : 0.95,
        metalness: a.kind === 'water' ? 0.4 : 0.0,
      }));
    }
    const shape = new THREE.Shape();
    shape.moveTo(a.polygon[0][0], a.polygon[0][1]);
    for (let i = 1; i < a.polygon.length; i++) shape.lineTo(a.polygon[i][0], a.polygon[i][1]);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, matCache.get(a.kind));
    // Sit slightly above the terrain so it z-wins over grass.
    m.position.y = a.kind === 'water' ? 0.10 : 0.04;
    m.receiveShadow = true;
    m.userData.area = a;
    group.add(m);
  }
  scene.add(group);
  return group;
}

// ---------- Railways ----------
export function buildOSMRails(scene, osm) {
  const group = new THREE.Group();
  group.name = 'osm-rails';
  const mat = new THREE.MeshStandardMaterial({ color: 0x666, roughness: 0.8 });
  for (const r of osm.rails) {
    if (r.path.length < 2) continue;
    const geo = ribbonGeometry(r.path, 3.2, 0.07);
    const m = new THREE.Mesh(geo, mat);
    group.add(m);
    // Ties
    const tieMat = new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.95 });
    const tieGeo = new THREE.BoxGeometry(3.2, 0.08, 0.4);
    let remaining = 0;
    for (let i = 0; i < r.path.length - 1; i++) {
      const [ax, az] = r.path[i], [bx, bz] = r.path[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      for (let d = remaining; d < L; d += 2.5) {
        const t = d / L;
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(ax + (bx - ax) * t, 0.09, az + (bz - az) * t);
        tie.rotation.y = Math.atan2(bx - ax, bz - az);
        group.add(tie);
      }
      remaining = (remaining + L) % 2.5;
    }
  }
  scene.add(group);
  return group;
}

// ---------- Point-of-interest helpers ----------
// Finds the OSM element whose tags suggest it's the Azrieli Mall,
// Central Station, Anabe Park, etc.  Returns { x, z } or null.
export function findByName(osm, ...needles) {
  const low = needles.map(s => s.toLowerCase());
  function match(name) {
    if (!name) return false;
    const n = name.toLowerCase();
    return low.some(k => n.includes(k));
  }
  // Streets first — useful for snapping a spawn point.
  for (const s of osm.streets) {
    if (match(s.name) || match(s.nameHe)) {
      const mid = s.path[Math.floor(s.path.length / 2)];
      return { x: mid[0], z: mid[1], street: s };
    }
  }
  for (const a of osm.areas) {
    if (match(a.name) || match(a.nameHe)) {
      let cx = 0, cz = 0;
      for (const [x, z] of a.polygon) { cx += x; cz += z; }
      return { x: cx / a.polygon.length, z: cz / a.polygon.length };
    }
  }
  for (const b of osm.buildings) {
    if (match(b.name) || match(b.nameHe)) {
      let cx = 0, cz = 0;
      for (const [x, z] of b.polygon) { cx += x; cz += z; }
      return { x: cx / b.polygon.length, z: cz / b.polygon.length };
    }
  }
  for (const p of osm.points) {
    if (match(p.name) || match(p.nameHe)) return { x: p.pos[0], z: p.pos[1] };
  }
  return null;
}

// Returns true if (x,z) is inside the city's rough OSM extent. Used to
// decide whether a procedural fallback feature should render.
export function computeBounds(osm) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of osm.streets) {
    for (const [x, z] of s.path) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  return { minX, maxX, minZ, maxZ };
}

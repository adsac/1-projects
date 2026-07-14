// Loads the baked real-city dataset (see tools/ for the pipeline).
// Local frame: metres, origin at 34.995°E 31.8975°N, +x east, +z south.

export const WORLD = {
  sizeX: (35.045 - 34.945) * 111320 * Math.cos(31.8975 * Math.PI / 180), // ≈ 9450 m
  sizeZ: (31.94 - 31.855) * 110574,                                      // ≈ 9400 m
};

async function bin(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return new DataView(await r.arrayBuffer());
}

export async function loadCityData(onProgress) {
  const [dem, roadsV, bldV, areasV, names] = await Promise.all([
    bin('data/dem.bin'),
    bin('data/roads.bin'),
    bin('data/bld.bin'),
    bin('data/areas.bin'),
    fetch('data/names.json').then(r => r.json()),
  ]);
  onProgress?.(0.4);

  // ── DEM: 'DEM1', uint16 w,h, float32 min,max, then w*h uint16 rows N→S ──
  const dw = dem.getUint16(4, true), dh = dem.getUint16(6, true);
  const dmin = dem.getFloat32(8, true), dmax = dem.getFloat32(12, true);
  const dgrid = new Float32Array(dw * dh);
  const scale = (dmax - dmin) / 65535;
  for (let i = 0; i < dw * dh; i++) dgrid[i] = dmin + dem.getUint16(16 + i * 2, true) * scale;

  // ── roads: 'RDS1', uint32 n, then {uint8 cls, uint16 name, uint16 npts, int16 xz*} ──
  const nRoads = roadsV.getUint32(4, true);
  const roads = new Array(nRoads);
  let o = 8;
  for (let i = 0; i < nRoads; i++) {
    const cls = roadsV.getUint8(o); const name = roadsV.getUint16(o + 1, true);
    const n = roadsV.getUint16(o + 3, true); o += 5;
    const pts = new Float32Array(n * 2);
    for (let k = 0; k < n * 2; k++) { pts[k] = roadsV.getInt16(o, true) * 0.5; o += 2; }
    roads[i] = { cls, name, pts };
  }

  // ── buildings: 'BLD1', uint32 n, then {uint8 h2, uint8 villa, uint16 npts, int16 xz*} ──
  const nB = bldV.getUint32(4, true);
  const buildings = new Array(nB);
  o = 8;
  for (let i = 0; i < nB; i++) {
    const h = bldV.getUint8(o) * 0.5; const villa = bldV.getUint8(o + 1);
    const n = bldV.getUint16(o + 2, true); o += 4;
    const pts = new Float32Array(n * 2);
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (let k = 0; k < n; k++) {
      const x = bldV.getInt16(o, true) * 0.5; o += 2;
      const z = bldV.getInt16(o, true) * 0.5; o += 2;
      pts[k * 2] = x; pts[k * 2 + 1] = z;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
    }
    buildings[i] = { h, villa, pts, cx: (minx + maxx) / 2, cz: (minz + maxz) / 2, r: Math.hypot(maxx - minx, maxz - minz) / 2 };
  }

  // ── areas: 'ARE1', uint32 n, then {uint8 kind, uint16 npts, int16 xz*} ──
  // kinds: 0 water 1 park/grass 2 forest/orchard 3 pitch 4 playground 5 school 6 construction 7 shrub 8 barren 9 crop
  const nA = areasV.getUint32(4, true);
  const areas = new Array(nA);
  o = 8;
  for (let i = 0; i < nA; i++) {
    const kind = areasV.getUint8(o); const n = areasV.getUint16(o + 1, true); o += 3;
    const pts = new Float32Array(n * 2);
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (let k = 0; k < n; k++) {
      const x = areasV.getInt16(o, true) * 0.5; o += 2;
      const z = areasV.getInt16(o, true) * 0.5; o += 2;
      pts[k * 2] = x; pts[k * 2 + 1] = z;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
    }
    areas[i] = { kind, pts, minx, maxx, minz, maxz };
  }
  onProgress?.(0.7);

  const demData = { w: dw, h: dh, grid: dgrid };
  return { dem: demData, roads, buildings, areas, names };
}

// bilinear terrain sample; grid row 0 = north edge (z = -sizeZ/2)
export function makeHeightAt(dem) {
  const { w, h, grid } = dem;
  const hx = WORLD.sizeX / 2, hz = WORLD.sizeZ / 2;
  return (x, z) => {
    const fi = Math.min(w - 1.001, Math.max(0, (x + hx) / WORLD.sizeX * (w - 1)));
    const fj = Math.min(h - 1.001, Math.max(0, (z + hz) / WORLD.sizeZ * (h - 1)));
    const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j;
    const a = grid[j * w + i], b = grid[j * w + i + 1];
    const c = grid[(j + 1) * w + i], d = grid[(j + 1) * w + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
}

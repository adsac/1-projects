// Bespoke, hand-modelled landmarks. Each builder assembles a landmark at local
// origin; main.js places the group at the landmark's map position.
import * as THREE from 'three';

const M = {
  stone: new THREE.MeshLambertMaterial({ color: '#e8ddc4' }),
  stoneDark: new THREE.MeshLambertMaterial({ color: '#cbbc9c' }),
  glassDay: new THREE.MeshStandardMaterial({ color: '#b9d8ea', roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.8 }),
  white: new THREE.MeshLambertMaterial({ color: '#f4f1e8' }),
  redRoof: new THREE.MeshLambertMaterial({ color: '#9e3f2c' }),
  steel: new THREE.MeshStandardMaterial({ color: '#b9c0c6', roughness: 0.35, metalness: 0.7 }),
  dark: new THREE.MeshLambertMaterial({ color: '#3c4148' }),
  wood: new THREE.MeshLambertMaterial({ color: '#8a6b43' }),
  green: new THREE.MeshLambertMaterial({ color: '#5f8f3e' }),
};
M.ancient = new THREE.MeshLambertMaterial({ color: '#c9b48e' });

function box(g, mat, w, h, d, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}
function cyl(g, mat, r1, r2, h, x = 0, y = 0, z = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

function hebrewSign(g, text, w, h, x, y, z, opts = {}) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.max(96, Math.round(512 * h / w));
  const ctx = c.getContext('2d');
  ctx.fillStyle = opts.bg || '#173a5e';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = opts.fg || '#ffffff';
  ctx.font = `bold ${Math.round(c.height * (opts.fs || 0.52))}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false }));
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  g.add(m);
  return m;
}

export const BUILDERS = {

  // ── Modi'in Merkaz railway station: sweeping twin steel arches over a
  //    glazed hall; the platforms are deep underground ─────────────────────
  station(g) {
    box(g, M.stoneDark, 90, 0.5, 60, 0, -0.2, 0);                 // plaza
    // glazed hall
    box(g, M.glassDay, 44, 8, 22, 0, 0, 0).castShadow = true;
    // the two great arches
    for (const dz of [-8, 8]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(24, 1.1, 10, 40, Math.PI), M.steel);
      arch.rotation.z = 0; arch.position.set(0, 1.5, dz);
      arch.castShadow = true;
      g.add(arch);
    }
    // cable hints
    for (let i = -4; i <= 4; i++) {
      const x = i * 5;
      const hgt = Math.sqrt(Math.max(0, 24 * 24 - x * x)) + 1.5;
      for (const dz of [-8, 8]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, hgt - 8, 5), M.steel);
        c.position.set(x, 8 + (hgt - 8) / 2, dz);
        g.add(c);
      }
    }
    hebrewSign(g, 'מודיעין מרכז', 16, 2.4, 0, 6.4, 11.3, { bg: '#12325a' });
    hebrewSign(g, 'רכבת ישראל ✦ Modi\'in Merkaz', 16, 1.6, 0, 4.6, 11.31, { bg: '#ffffff', fg: '#12325a', fs: 0.4 });
    // stairway down (the deepest station hall in Israel when it opened)
    box(g, M.dark, 10, 0.4, 14, -22, 0, -14);
    box(g, M.stoneDark, 1.2, 1.2, 14, -27.5, 0, -14);
    box(g, M.stoneDark, 1.2, 1.2, 14, -16.5, 0, -14);
  },

  // ── Azrieli Modi'in mall — beige block, curved glass entry, roof sign ──
  mall(g) {
    box(g, M.stone, 78, 15, 52, 0, 0, 0);
    box(g, M.stoneDark, 78, 2.2, 52, 0, 15, 0);
    const front = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 14, 24, 1, false, -Math.PI / 2, Math.PI), M.glassDay);
    front.position.set(0, 7, 26);
    g.add(front);
    hebrewSign(g, 'עזריאלי מודיעין', 24, 3, 0, 15.5, 27.2, { bg: '#b01e3c' });
    hebrewSign(g, 'AZRIELI', 14, 2, -26, 12.5, 26.2, { bg: '#b01e3c' });
    // the three rooftop office buildings
    for (const dx of [-24, 0, 24]) box(g, M.white, 14, 9, 16, dx, 17.2, -8);
    // Azrieli Eastern Tower — 15 floors, the tallest thing in town
    const tower = box(g, M.glassDay, 16, 55, 16, 52, 0, -12);
    for (let f = 1; f < 14; f++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(16.3, 0.5, 16.3), M.white);
      band.position.set(52, f * 3.9, -12);
      g.add(band);
    }
    box(g, M.white, 17, 1.4, 17, 52, 55, -12);
    // parking rows
    for (let i = 0; i < 6; i++) box(g, M.dark, 4.4, 1.4, 2, -30 + i * 12, 0, 38);
  },

  // ── Hasmonean Heritage Museum (2021) — stone drum + Maccabee banner ────
  museum(g) {
    box(g, M.stone, 22, 7, 16, 0, 0, 0);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.6, 9, 18), M.stoneDark);
    drum.position.set(-6, 4.5, 2); drum.castShadow = true;
    g.add(drum);
    box(g, M.glassDay, 8, 5, 1, 6, 0, 8.1);
    hebrewSign(g, 'מוזיאון מורשת החשמונאים', 15, 1.7, 2, 5.9, 8.6, { bg: '#6b3d12' });
    // corten-style Maccabee helmet sculpture out front
    const helm = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7),
      new THREE.MeshStandardMaterial({ color: '#8a4a24', roughness: 0.7, metalness: 0.4 }));
    helm.position.set(9, 2.2, 12);
    g.add(helm);
    cyl(g, M.stoneDark, 1.2, 1.4, 1.4, 9, 0, 12, 10);
  },

  // ── Municipal sports centre: pool + arena hall ─────────────────────────
  sport(g) {
    // arena with barrel roof
    box(g, M.white, 30, 8, 22, -8, 0, 0);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 30, 18, 1, false, Math.PI, Math.PI), M.steel);
    roof.rotation.z = Math.PI / 2;
    roof.position.set(-8, 8, 0);
    g.add(roof);
    hebrewSign(g, 'היכל הספורט העירוני', 14, 1.8, -8, 6.4, 11.1, { bg: '#0e5a35' });
    // outdoor pool
    box(g, M.stoneDark, 20, 0.5, 12, 16, 0, 8);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(17, 0.3, 9),
      new THREE.MeshStandardMaterial({ color: '#3db4d8', roughness: 0.1, metalness: 0.2 }));
    pool.position.set(16, 0.55, 8);
    g.add(pool);
    // tennis court
    box(g, M.green, 14, 0.2, 8, 16, 0, -8);
    box(g, M.white, 0.2, 1, 8, 16, 0, -8);
  },

  // ── Pa'atei Modi'in: platforms in the Route 431 median, long canopies ──
  paatei(g) {
    box(g, M.stoneDark, 70, 1.1, 10, 0, 0, 0);                   // island platform
    for (const dz of [-3, 3]) {
      for (let x = -30; x <= 30; x += 12) cyl(g, M.steel, 0.16, 0.16, 4.6, x, 1.1, dz, 6);
    }
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 64, 16, 1, false, Math.PI + 0.5, Math.PI - 1), M.steel);
    canopy.rotation.z = Math.PI / 2;
    canopy.position.set(0, 4.5, 0);
    g.add(canopy);
    hebrewSign(g, 'פאתי מודיעין', 12, 1.9, 0, 3.4, 5.2, { bg: '#12325a' });
    // footbridge over the highway
    box(g, M.steel, 3, 0.4, 34, -24, 6.2, 0);
    for (const dz of [-16, 16]) box(g, M.steel, 3, 6.2, 2.4, -24, 0, dz);
    box(g, M.glassDay, 3, 2.2, 30, -24, 6.6, 0);
  },

  // ── Yishpro-style big-box strip ────────────────────────────────────────
  bigbox(g) {
    box(g, M.white, 55, 9, 26, 0, 0, 0);
    box(g, M.stoneDark, 55, 1, 26, 0, 9, 0);
    hebrewSign(g, 'ישפרו סנטר', 16, 2.6, -12, 6.4, 13.1, { bg: '#d97706' });
    hebrewSign(g, 'סינמה ⭑ באולינג', 12, 1.8, 16, 5.6, 13.1, { bg: '#1e3a8a' });
    // parking lot
    box(g, M.dark, 50, 0.15, 20, 0, 0, 26);
    for (let i = 0; i < 8; i++) box(g, i % 3 ? M.dark : M.redRoof, 4.2, 1.5, 2, -21 + i * 6, 0.15, 26);
  },

  // ── Nofim promenade lookout ────────────────────────────────────────────
  lookout(g) {
    // curved balustrade deck
    box(g, M.stoneDark, 26, 0.4, 8, 0, 0, 0);
    for (let i = -6; i <= 6; i++) cyl(g, M.steel, 0.07, 0.07, 1.1, i * 2, 0.4, -3.6, 5);
    box(g, M.wood, 26, 0.14, 0.3, 0, 1.4, -3.6);
    // pergola
    for (const x of [-8, 8]) for (const z of [0, 3]) cyl(g, M.wood, 0.16, 0.16, 3, x, 0.4, z, 6);
    for (let i = 0; i < 7; i++) box(g, M.wood, 17, 0.12, 0.35, 0, 3.4, i * 0.55);
    // orientation table
    cyl(g, M.stoneDark, 0.9, 1.1, 1.1, 0, 0.4, -2, 12);
    hebrewSign(g, 'טיילת נופים — מכאן רואים עד הים', 10, 1.1, 0, 2.6, 4.2, { bg: '#4a5d23' });
    // bench
    box(g, M.wood, 4, 0.4, 0.5, 0, 0.7, 2);
  },

  // ── Morasha construction site: tower crane + skeleton building ────────
  crane(g) {
    // building skeleton
    for (let f = 0; f < 5; f++) box(g, new THREE.MeshLambertMaterial({ color: '#c8c8c8' }), 16, 0.5, 12, 0, f * 3.2 + 2.8, 0);
    for (const [x, z] of [[-7, -5], [7, -5], [-7, 5], [7, 5], [0, 0]]) {
      cyl(g, M.dark, 0.3, 0.3, 16.5, x, 0, z, 6);
    }
    // tower crane
    const yellow = new THREE.MeshLambertMaterial({ color: '#e8b90f' });
    box(g, yellow, 1.6, 30, 1.6, 14, 0, -8);
    box(g, yellow, 26, 1.2, 1.2, 22, 29, -8);
    box(g, yellow, 8, 1.2, 1.2, 6, 29, -8);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 12, 4), M.dark);
    cable.position.set(30, 23.5, -8);
    g.add(cable);
    box(g, M.stoneDark, 2.2, 2.2, 2.2, 30, 16.5, -8);
    // hoarding
    hebrewSign(g, 'כאן בונים את שכונת מורשה', 14, 1.6, 0, 1.4, 9, { bg: '#0e4a7b' });
    for (let i = -8; i <= 8; i += 4) box(g, M.white, 3.8, 2, 0.15, i, 0, 8.6);
  },

  // ── City Hall & plaza ──────────────────────────────────────────────────
  cityhall(g) {
    box(g, M.stoneDark, 70, 0.5, 55, 0, -0.2, 0);
    box(g, M.white, 34, 22, 20, 0, 0, -6);
    box(g, M.glassDay, 10, 22, 21, 0, 0, -6);
    box(g, M.white, 20, 12, 16, -26, 0, -4);
    // flag poles
    for (let i = -2; i <= 2; i++) {
      cyl(g, M.steel, 0.09, 0.12, 9, i * 4, 0, 12, 6);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4),
        new THREE.MeshLambertMaterial({ color: i === 0 ? '#ffffff' : '#1c5d99', side: THREE.DoubleSide }));
      f.position.set(i * 4 + 1.1, 8.2, 12);
      g.add(f);
    }
    hebrewSign(g, 'עיריית מודיעין מכבים רעות', 22, 2.2, 0, 17, 4.05, { bg: '#0e4a7b' });
  },

  // ── Cultural hall ──────────────────────────────────────────────────────
  culture(g) {
    box(g, M.stone, 46, 14, 34, 0, 0, 0);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 18, 26), M.stoneDark);
    drum.position.set(8, 9, -2); drum.castShadow = true;
    g.add(drum);
    box(g, M.glassDay, 30, 8, 2, -4, 0, 17);
    hebrewSign(g, 'היכל התרבות', 14, 2, -4, 9.6, 18.1, { bg: '#5b2472' });
    for (let i = 0; i < 4; i++) cyl(g, M.white, 0.5, 0.5, 8, -14 + i * 7, 0, 15.5, 10);
  },

  // ── Umm el-Umdan: ancient village & one of the oldest synagogues ──────
  ruins(g) {
    const wall = (w, d, x, z, ry = 0, h = 1.1) => {
      const m = box(g, M.ancient, w, h, 0.8, x, 0, z, ry);
      m.position.y = h / 2;
      return m;
    };
    // synagogue hall — rectangular, benches along walls, column bases
    wall(14, 0.8, 0, -5); wall(14, 0.8, 0, 5);
    wall(0.8, 0.8, -7, 0, 0, 1.1); wall(10.8, 0.8, -7, 0, Math.PI / 2);
    wall(10.8, 0.8, 7, 0, Math.PI / 2);
    for (const x of [-3.5, 0, 3.5]) for (const z of [-2, 2]) {
      cyl(g, M.ancient, 0.5, 0.6, 1.6, x, 0, z, 10);
    }
    // benches
    box(g, M.stoneDark, 12, 0.5, 1, 0, 0, -4);
    box(g, M.stoneDark, 12, 0.5, 1, 0, 0, 4);
    // surrounding village rooms
    for (const [x, z, w, d] of [[-16, 6, 8, 7], [-15, -8, 7, 8], [14, 8, 9, 6], [16, -6, 7, 7]]) {
      wall(w, 0.8, x, z - d / 2); wall(w, 0.8, x, z + d / 2);
      wall(d, 0.8, x - w / 2, z, Math.PI / 2); wall(d, 0.8, x + w / 2, z, Math.PI / 2);
    }
    // interpretive canopy over the synagogue
    for (const [x, z] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) cyl(g, M.steel, 0.14, 0.14, 5.4, x, 0, z, 6);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(19, 0.3, 15),
      new THREE.MeshLambertMaterial({ color: '#8f9aa3', transparent: true, opacity: 0.85 }));
    roof.position.set(0, 5.6, 0); roof.castShadow = true;
    g.add(roof);
  },

  // ── Titora hill lookout: ruined tower, ancient olive, view platform ───
  titora(g) {
    cyl(g, M.ancient, 4.4, 5.2, 6.5, 0, 0, 0, 14);
    cyl(g, M.ancient, 4.7, 4.9, 0.9, 0, 6.5, 0, 14);
    // broken crown
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      box(g, M.ancient, 1.4, 0.9 + (i % 3) * 0.5, 0.9, Math.cos(a) * 4.4, 7.4, Math.sin(a) * 4.4, -a);
    }
    box(g, M.wood, 8, 0.35, 6, 9, 0.4, 2);           // wooden viewing deck
    box(g, M.wood, 8, 0.9, 0.15, 9, 0.75, 5);
    box(g, M.wood, 0.15, 0.9, 6, 13, 0.75, 2);
    hebrewSign(g, 'תצפית תיתורה', 5, 1.1, 9, 1.9, -0.9, { bg: '#4a5d23' });
  },

  // ── Anabe park amphitheatre ────────────────────────────────────────────
  amphi(g) {
    // concentric stone tiers, each standing on the ground so the bowl reads solid
    for (let i = 0; i < 5; i++) {
      const r = 8 + i * 2.4, h = 0.9 + i * 0.75;
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 36, 1, false, Math.PI * 0.1, Math.PI * 0.8),
        M.stoneDark);
      ring.position.y = h / 2;
      ring.castShadow = true;
      g.add(ring);
    }
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.5, 24), M.stone);
    stage.position.y = 0.25;
    g.add(stage);
    // small canopy over the stage
    for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) cyl(g, M.steel, 0.12, 0.12, 5, x, 0.5, z, 6);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3), M.white);
    shell.position.y = 3.2; shell.scale.y = 0.7;
    g.add(shell);
  },

  // ── Neighborhood synagogue ─────────────────────────────────────────────
  synagogue(g) {
    box(g, M.stone, 16, 8, 12, 0, 0, 0);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#7fb0c9', roughness: 0.3, metalness: 0.4 }));
    dome.position.y = 8; dome.castShadow = true;
    g.add(dome);
    box(g, M.stone, 3, 10, 3, 9, 0, -3);
    // Ten-commandments tablets silhouette on the facade
    const tab = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 16, 1, false, 0, Math.PI), M.stoneDark);
    tab.rotation.x = Math.PI / 2; tab.rotation.z = Math.PI / 2;
    tab.position.set(0, 6.6, 6.1);
    g.add(tab);
    box(g, M.stoneDark, 2.2, 1.6, 0.3, 0, 5, 6.05);
  },

  // ── Baseball field (Ironi Modi'in — Israel's baseball town) ────────────
  baseball(g) {
    const grass = new THREE.Mesh(new THREE.CircleGeometry(30, 26, Math.PI / 4, Math.PI / 2), M.green);
    grass.rotation.x = -Math.PI / 2; grass.position.y = 0.06;
    g.add(grass);
    const dirt = new THREE.Mesh(new THREE.CircleGeometry(13, 20, Math.PI / 4, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#c28a52' }));
    dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.09;
    g.add(dirt);
    // bases
    const baseMat = M.white;
    for (const [x, z] of [[0, 9.5], [9.5, 0], [0, 0], [6.7, 6.7]]) {
      box(g, baseMat, 0.9, 0.12, 0.9, x === 6.7 ? 6.7 : x, 0.1, z === 6.7 ? 6.7 : z, Math.PI / 4);
    }
    // backstop
    for (let i = -2; i <= 2; i++) cyl(g, M.steel, 0.09, 0.09, 6, i * 2.2 - 3 * Math.SQRT1_2, 0, i * -2.2 - 3 * Math.SQRT1_2, 5);
    hebrewSign(g, '⚾ עירוני מודיעין', 7, 1.4, -5.6, 5.2, -5.6, { bg: '#123c1e', ry: Math.PI / 4 });
    // floodlights
    for (const [x, z] of [[-8, 20], [20, -8]]) {
      cyl(g, M.steel, 0.2, 0.3, 12, x, 0, z, 7);
      box(g, M.white, 2.6, 1.4, 0.4, x, 12, z, Math.atan2(-x, -z));
    }
  },

  // ── Mini commercial centre with cafés ─────────────────────────────────
  shops(g) {
    box(g, M.stone, 34, 5.5, 14, 0, 0, 0);
    box(g, M.stoneDark, 36, 0.7, 16, 0, 5.5, 0);
    // awnings + café tables
    for (let i = 0; i < 4; i++) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.18, 3),
        new THREE.MeshLambertMaterial({ color: i % 2 ? '#b34435' : '#3f6ea8' }));
      a.position.set(-12 + i * 8, 4, 8.4);
      a.rotation.x = 0.32;
      g.add(a);
      cyl(g, M.white, 0.75, 0.75, 0.08, -12 + i * 8, 1.0, 11, 10);
      cyl(g, M.wood, 0.09, 0.09, 1.0, -12 + i * 8, 0, 11, 6);
    }
    hebrewSign(g, 'מרכז מסחרי', 10, 1.5, 0, 4.6, 7.15, { bg: '#173a5e' });
  },

  // ── Quest torch ────────────────────────────────────────────────────────
  torch(g) {
    const mat = new THREE.MeshStandardMaterial({ color: '#7a5a2b', roughness: 0.5, metalness: 0.4 });
    cyl(g, mat, 0.32, 0.5, 3.4, 0, 0, 0, 9);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.4, 0.7, 10), mat);
    bowl.position.y = 3.7;
    g.add(bowl);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.5, 8),
      new THREE.MeshBasicMaterial({ color: '#4a3a2c' }));  // cold coals until lit
    flame.position.y = 4.9;
    flame.name = 'flame';
    g.add(flame);
    const glow = new THREE.PointLight('#ff9d2e', 0, 18, 2);
    glow.position.y = 4.9; glow.name = 'glow';
    g.add(glow);
  },

  // ── The great hanukkiah finale (on Titora / city plaza) ────────────────
  hanukkiah(g) {
    const mat = new THREE.MeshStandardMaterial({ color: '#c89b3c', roughness: 0.3, metalness: 0.85 });
    const s = 2.6;
    cyl(g, mat, 0.1 * s, 0.18 * s, 2.4 * s, 0, 0, 0, 10);
    cyl(g, mat, 0.55 * s, 0.7 * s, 0.2 * s, 0, 0, 0, 12);
    for (let i = -4; i <= 4; i++) {
      const x = i * 0.5 * s;
      const hgt = 2.4 * s + (i === 0 ? 0.5 * s : 0);
      if (i !== 0) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, Math.abs(x), 8), mat);
        arm.rotation.z = Math.PI / 2;
        arm.position.set(x / 2, 2.4 * s, 0);
        g.add(arm);
      }
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.5 * s, 8), mat);
      up.position.set(x, 2.4 * s + 0.25 * s + (i === 0 ? 0.3 * s : 0), 0);
      g.add(up);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.08 * s, 0.16 * s, 8), mat);
      cup.position.set(x, hgt + 0.5 * s, 0);
      g.add(cup);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.4 * s, 7),
        new THREE.MeshBasicMaterial({ color: '#ffb43a' }));
      flame.position.set(x, hgt + 0.78 * s, 0);
      flame.visible = false;
      flame.name = 'candle' + (i + 4);
      g.add(flame);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  },
};

// Build a landmark group; returns { group, colliders }
export function buildLandmark(def, heightAt) {
  const g = new THREE.Group();
  const y = heightAt(def.x, def.z);
  g.position.set(def.x, y, def.z);
  g.rotation.y = THREE.MathUtils.degToRad(def.yaw || 0);
  const builder = BUILDERS[def.builder];
  if (builder) builder(g);
  return g;
}

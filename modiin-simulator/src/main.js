// Modi'in City Walk — bootstrap & game loop (real-data edition).
import * as THREE from 'three';
import { loadCityData, makeHeightAt, WORLD } from './loader.js';
import { World } from './world.js';
import { City } from './city.js';
import { Player } from './player.js';
import { Hud } from './hud.js';
import { buildLandmark, BUILDERS } from './landmarks.js';
import { LANDMARKS, TORCHES, AMBIENT_FACTS, SPAWN } from './data/cityinfo.js';

const isTouch = matchMedia('(pointer: coarse)').matches;
const LOW = isTouch || (navigator.hardwareConcurrency || 8) <= 4;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 30000);

const progress = p => { document.getElementById('intro-bar').style.width = (p * 100).toFixed(0) + '%'; };

const EXAGGERATION = 1.22;   // gentle vertical boost so the wadis read on screen

let world, city, player, hud, hanukkiah = null;
const landmarkGroups = new Map();
const torches = TORCHES.map(t => ({ ...t, lit: false, group: null }));
const markers = [];

init().catch(err => {
  console.error(err);
  document.getElementById('start-btn').textContent = 'Failed to load city data';
});

async function init() {
  const data = await loadCityData(progress);
  flattenLakes(data);
  const rawHeight = makeHeightAt(data.dem);
  const base = 86;   // min elevation in the dataset
  const heightAt = (x, z) => (rawHeight(x, z) - base) * EXAGGERATION;
  progress(0.5);

  world = new World(scene, heightAt);
  await frame();
  progress(0.62);

  const exclude = LANDMARKS.filter(l => l.clearR && !l.keepReal)
    .map(l => ({ x: l.x, z: l.z, r: l.clearR }));
  city = new City(scene, heightAt, data, { exclude, low: LOW });
  await frame();
  progress(0.85);

  const markerGeo = new THREE.OctahedronGeometry(0.9);
  const markerMat = new THREE.MeshStandardMaterial({
    color: '#f2b632', emissive: '#7a5408', roughness: 0.3, metalness: 0.7,
  });
  for (const lm of LANDMARKS) {
    const g = buildLandmark(lm, heightAt);
    scene.add(g);
    landmarkGroups.set(lm.id, g);
    if (lm.builder === 'hanukkiah') hanukkiah = g;
    if (lm.collideR) { /* registered below once city exists */ }
    const mk = new THREE.Mesh(markerGeo, markerMat);
    const my = heightAt(lm.x, lm.z);
    mk.position.set(lm.x, my + 5.6, lm.z);
    mk.userData.baseY = my + 5.6;
    scene.add(mk);
    markers.push(mk);
  }
  city.extraColliders = LANDMARKS.filter(l => l.collideR)
    .map(l => ({ x: l.x, z: l.z, r: l.collideR }));
  for (const t of torches) {
    const g = new THREE.Group();
    g.position.set(t.x, heightAt(t.x, t.z), t.z);
    BUILDERS.torch(g);
    scene.add(g);
    t.group = g;
  }
  progress(0.94);

  player = new Player(camera, canvas, heightAt, { bound: 4650, walk: 8.5, run: 27 });
  player.place(SPAWN.x, SPAWN.z, SPAWN.yaw);
  hud = new Hud(data);
  progress(1);

  const btn = document.getElementById('start-btn');
  btn.disabled = false;
  btn.textContent = 'Start walking';
  btn.onclick = start;
}

const frame = () => new Promise(r => requestAnimationFrame(r));

// sink the DEM under water polygons so lakes sit in basins, not on bumps
function flattenLakes(data) {
  const { w, h, grid } = data.dem;
  const hx = WORLD.sizeX / 2, hz = WORLD.sizeZ / 2;
  const inPoly = (x, z, pts) => {
    let inside = false;
    const n = pts.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[i * 2], zi = pts[i * 2 + 1], xj = pts[j * 2], zj = pts[j * 2 + 1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  for (const a of data.areas) {
    if (a.kind !== 0) continue;
    if ((a.maxx - a.minx) * (a.maxz - a.minz) < 1500) continue;
    let hmin = 1e9;
    for (let i = 0; i < a.pts.length / 2; i++) {
      const gx = Math.round((a.pts[i * 2] + hx) / WORLD.sizeX * (w - 1));
      const gz = Math.round((a.pts[i * 2 + 1] + hz) / WORLD.sizeZ * (h - 1));
      if (gx >= 0 && gx < w && gz >= 0 && gz < h) hmin = Math.min(hmin, grid[gz * w + gx]);
    }
    if (hmin > 1e8) continue;
    const i0 = Math.max(0, Math.floor((a.minx + hx) / WORLD.sizeX * (w - 1)) - 1);
    const i1 = Math.min(w - 1, Math.ceil((a.maxx + hx) / WORLD.sizeX * (w - 1)) + 1);
    const j0 = Math.max(0, Math.floor((a.minz + hz) / WORLD.sizeZ * (h - 1)) - 1);
    const j1 = Math.min(h - 1, Math.ceil((a.maxz + hz) / WORLD.sizeZ * (h - 1)) + 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = i / (w - 1) * WORLD.sizeX - hx;
        const z = j / (h - 1) * WORLD.sizeZ - hz;
        if (inPoly(x, z, a.pts)) grid[j * w + i] = Math.min(grid[j * w + i], hmin - 0.4);
      }
    }
  }
}

function start() {
  document.getElementById('intro').style.display = 'none';
  document.getElementById('hud').classList.remove('hidden');
  player.enabled = true;
  if (!document.body.classList.contains('touch')) canvas.requestPointerLock?.();
  hud.toast(`Welcome to the real Modi'in — every street here is mapped from the actual city. Follow the <span class="toast-gold">orange dots</span> to the 8 relay torches, and read the golden plaques along the way.`, 8000);
}

// ── interactions ──────────────────────────────────────
let nearLandmark = null, nearTorch = null;

function checkProximity() {
  nearLandmark = null; nearTorch = null;
  const p = player.pos;
  for (const t of torches) {
    if (!t.lit && Math.hypot(p.x - t.x, p.z - t.z) < 7) { nearTorch = t; break; }
  }
  if (!nearTorch) {
    let best = 1e9;
    for (const lm of LANDMARKS) {
      const d = Math.hypot(p.x - lm.x, p.z - lm.z);
      if (d < (lm.triggerR || 30) && d < best) { best = d; nearLandmark = lm; }
    }
  }
  if (hud.cardOpen) { hud.hidePrompt(); return; }
  if (nearTorch) hud.showPrompt('Light the torch');
  else if (nearLandmark) hud.showPrompt(nearLandmark.prompt || `About: ${nearLandmark.name}`);
  else hud.hidePrompt();
}

function interact() {
  if (hud.cardOpen) { hud.hideCard(); return; }
  if (nearTorch) return lightTorch(nearTorch);
  if (nearLandmark) {
    if (document.pointerLockElement) document.exitPointerLock();
    hud.showCard(nearLandmark, () => {
      if (player.enabled && !document.body.classList.contains('touch')) canvas.requestPointerLock?.();
    });
  }
}

function lightTorch(t) {
  t.lit = true;
  const flame = t.group.getObjectByName('flame');
  const glow = t.group.getObjectByName('glow');
  if (glow) glow.intensity = 2.2;
  if (flame) flame.material = new THREE.MeshBasicMaterial({ color: '#ffd23a' });
  hud.torchesLit = torches.filter(x => x.lit).length;
  hud.updateTorches();
  const left = torches.length - hud.torchesLit;
  if (left > 0) {
    hud.toast(`🔥 Torch lit! <span class="toast-gold">${t.hint || ''}</span> ${left} to go.`, 5200);
    lightCandles(hud.torchesLit);
  } else {
    lightCandles(9);
    hud.toast(`🕎 <span class="toast-gold">All eight torches are lit!</span> The great hanukkiah on Titora is burning — like the relay that has run from Modi'in toward Jerusalem every Hanukkah since 1944. You know this city now!`, 12000);
  }
}

function lightCandles(n) {
  if (!hanukkiah) return;
  const order = [0, 1, 2, 3, 5, 6, 7, 8];
  for (let i = 0; i < Math.min(n, 8); i++) {
    const c = hanukkiah.getObjectByName('candle' + order[i]);
    if (c) c.visible = true;
  }
  if (n >= 9) {
    const sh = hanukkiah.getObjectByName('candle4');
    if (sh) sh.visible = true;
  }
}

// ── input wiring ──────────────────────────────────────
addEventListener('keydown', e => {
  if (!player?.enabled && !hud) return;
  if (e.code === 'KeyE' || e.code === 'Enter') interact();
  if (e.code === 'Escape' && hud?.cardOpen) hud.hideCard();
  if (e.code === 'KeyN') toggleNight();
  if (e.code === 'KeyM') hud?.mapOpen ? hud.hideMap() : (player && hud.showMap(player.pos.x, player.pos.z));
  if (e.code === 'KeyH') showHelp();
});
document.getElementById('card-close').addEventListener('click', () => hud.hideCard());
document.getElementById('btn-night').addEventListener('click', toggleNight);
document.getElementById('btn-map').addEventListener('click', () => hud.mapOpen ? hud.hideMap() : hud.showMap(player.pos.x, player.pos.z));
document.getElementById('btn-help').addEventListener('click', showHelp);
document.getElementById('touch-action').addEventListener('click', interact);

function toggleNight() {
  world.setNight(!world.night);
  city?.setNight(world.night);
  for (const t of torches) if (!t.lit) {
    const glow = t.group.getObjectByName('glow');
    if (glow) glow.intensity = world.night ? 0.6 : 0;
  }
  hud?.toast(world.night
    ? '🌙 Night over the Judean foothills. Watch the windows come on across the wadis.'
    : "☀️ Morning light on Jerusalem stone. Modi'in gets ~290 sunny days a year.");
}

function showHelp() {
  hud.showCard({
    id: '_help', kicker: 'How to explore', name: 'Walking guide', heb: 'מדריך',
    info: `<p><b>Move</b> with WASD or arrow keys (hold <b>Shift</b> to run — the city is real-scale, so run!). Look with the mouse — click to capture, <b>Esc</b> to release.</p>
    <p><b>E</b> reads plaques and lights torches. <b>M</b> opens the city map, <b>N</b> flips day and night.</p>
    <p>On phones: <b>left thumb</b> = joystick, <b>right thumb</b> = look around, gold button = interact.</p>
    <p class="fact">Your quest: find the <b>8 relay torches</b> (orange dots on the minimap) at the city's most storied spots. Each lights a candle on the great hanukkiah on Titora Hill. Street names, hills, and buildings are the real ones — if you know the city, you can navigate by memory.</p>`,
  });
}

let factIdx = 0, factTimer = 0;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// dev helpers
window.__teleport = (x, z, yaw = 0) => player?.place(x, z, yaw);
window.__dbg = () => ({
  pos: player && { x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1) },
  keys: player && [...player.keys], enabled: player?.enabled,
});

const clock = new THREE.Clock();
let frameNo = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.12, clock.getDelta());
  if (player && world) {
    player.update(dt);
    if (city) city.collide(player.pos);
    world.update(dt, player.pos);
    if (player.enabled && hud) {
      checkProximity();
      hud.updateCompass(player.headingDeg());
      if (frameNo % 4 === 0) hud.updateDistrict(player.pos.x, player.pos.z);
      if (frameNo % 6 === 0) hud.drawMinimap(player.pos.x, player.pos.z, player.headingDeg(), torches);
      if (frameNo % 15 === 0) city.updateLabels(player.pos.x, player.pos.z);
      factTimer += dt;
      if (factTimer > 26 && !hud.cardOpen && AMBIENT_FACTS.length) {
        factTimer = 0;
        hud.toast('💡 ' + AMBIENT_FACTS[factIdx % AMBIENT_FACTS.length], 8000);
        factIdx++;
      }
    }
    if (frameNo % 2 === 0) {
      const tNow = clock.elapsedTime;
      for (const mk of markers) {
        mk.rotation.y = tNow * 1.4;
        mk.position.y = mk.userData.baseY + Math.sin(tNow * 2 + mk.position.x) * 0.35;
      }
      for (const t of torches) {
        const f = t.group?.getObjectByName('flame');
        if (f && t.lit) {
          const s = 1 + Math.sin(tNow * 9 + t.x) * 0.18;
          f.scale.set(s, 1 + Math.sin(tNow * 7 + t.z) * 0.25, s);
        }
      }
    }
  }
  renderer.render(scene, camera);
  frameNo++;
}
loop();

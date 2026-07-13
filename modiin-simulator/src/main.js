// Modi'in City Walk — bootstrap & game loop.
import * as THREE from 'three';
import { World } from './world.js';
import { City } from './city.js';
import { Player } from './player.js';
import { Hud } from './hud.js';
import { buildLandmark, BUILDERS } from './landmarks.js';
import { LANDMARKS, TORCHES, AMBIENT_FACTS, SPAWN } from './data/city-data.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 12000);

const progress = p => { document.getElementById('intro-bar').style.width = (p * 100).toFixed(0) + '%'; };

// build in stages so the loading bar moves
const world = new World(scene, renderer);
progress(0.25);

const reserved = LANDMARKS.map(lm => ({ x: lm.x, z: lm.z, r: lm.clearR || 40 }));
let city, player, hud;
const landmarkGroups = new Map();
const torches = TORCHES.map(t => ({ ...t, lit: false, group: null }));
const markers = [];
let hanukkiah = null;

setTimeout(() => {
  city = new City(scene, (x, z) => world.heightAt(x, z), reserved);
  progress(0.65);

  setTimeout(() => {
    const markerGeo = new THREE.OctahedronGeometry(0.9);
    const markerMat = new THREE.MeshStandardMaterial({
      color: '#f2b632', emissive: '#7a5408', roughness: 0.3, metalness: 0.7,
    });
    for (const lm of LANDMARKS) {
      const g = buildLandmark(lm, (x, z) => world.heightAt(x, z));
      scene.add(g);
      landmarkGroups.set(lm.id, g);
      if (lm.builder === 'hanukkiah') hanukkiah = g;
      if (lm.collideR) city.colliders.push({ x: lm.x, z: lm.z, r: lm.collideR });
      // floating golden plaque beacon so landmarks are spottable from afar
      const mk = new THREE.Mesh(markerGeo, markerMat);
      const my = world.heightAt(lm.x, lm.z);
      mk.position.set(lm.x, my + 5.2, lm.z);
      mk.userData.baseY = my + 5.2;
      scene.add(mk);
      markers.push(mk);
    }
    for (const t of torches) {
      const g = new THREE.Group();
      const y = world.heightAt(t.x, t.z);
      g.position.set(t.x, y, t.z);
      BUILDERS.torch(g);
      scene.add(g);
      t.group = g;
    }
    progress(0.9);

    player = new Player(camera, canvas, (x, z) => world.heightAt(x, z));
    player.place(SPAWN.x, SPAWN.z, SPAWN.yaw);
    hud = new Hud();
    progress(1);

    const btn = document.getElementById('start-btn');
    btn.disabled = false;
    btn.textContent = 'Start walking';
    btn.onclick = start;
  }, 30);
}, 30);

function start() {
  document.getElementById('intro').classList.add('display-none');
  document.getElementById('intro').style.display = 'none';
  document.getElementById('hud').classList.remove('hidden');
  player.enabled = true;
  if (!document.body.classList.contains('touch')) canvas.requestPointerLock?.();
  hud.toast(`Welcome to Modi'in! Follow the <span class="toast-gold">orange dots</span> on your minimap to find the 8 relay torches. Walk up to golden plaques to learn the city's story.`, 7000);
}

// ── interactions ──────────────────────────────────────
let nearLandmark = null, nearTorch = null;

function checkProximity() {
  nearLandmark = null; nearTorch = null;
  const p = player.pos;
  for (const t of torches) {
    if (!t.lit && Math.hypot(p.x - t.x, p.z - t.z) < 6) { nearTorch = t; break; }
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
  if (flame) flame.material.color.set('#ffd23a');
  hud.torchesLit = torches.filter(x => x.lit).length;
  hud.updateTorches();
  const left = torches.length - hud.torchesLit;
  if (left > 0) {
    hud.toast(`🔥 Torch lit! <span class="toast-gold">${t.hint || ''}</span> ${left} to go.`, 5200);
    // also light the matching hanukkiah candle
    lightCandles(hud.torchesLit);
  } else {
    lightCandles(9);
    hud.toast(`🕎 <span class="toast-gold">All eight torches are lit!</span> The great hanukkiah at Mount Titora is burning — just like the relay that has run from Modi'in toward Jerusalem every Hanukkah since 1944. You know this city now!`, 12000);
  }
}

function lightCandles(n) {
  if (!hanukkiah) return;
  // candle0..candle8, skip shamash (candle4 = centre) until the end
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
    ? '🌙 Night over the Judean foothills. Watch the windows light up — and look up: you can still see stars here.'
    : '☀️ Morning light on Jerusalem stone. Modi\'in gets ~290 sunny days a year.');
}

function showHelp() {
  hud.showCard({
    id: '_help', kicker: 'How to explore', name: 'Walking guide', heb: 'מדריך',
    info: `<p><b>Move</b> with WASD or arrow keys (hold <b>Shift</b> to run). Look around with the mouse — click the view to capture it, <b>Esc</b> to release.</p>
    <p><b>E</b> reads plaques and lights torches. <b>M</b> opens the city map, <b>N</b> flips day and night.</p>
    <p>On touch screens: left thumb = joystick, right thumb = look, gold button = interact.</p>
    <p class="fact">Your quest: find the <b>8 relay torches</b> (orange dots on the minimap) scattered at the city's most storied spots. Each one lights a candle on the great hanukkiah on Mount Titora.</p>`,
  });
}

// ambient educational toasts while wandering
let factIdx = 0, factTimer = 0;

// ── resize & loop ─────────────────────────────────────
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// dev helpers: jump anywhere / inspect state from the console
window.__teleport = (x, z, yaw = 0) => player?.place(x, z, yaw);
window.__dbg = () => ({
  pos: player && { x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1) },
  keys: player && [...player.keys],
  enabled: player?.enabled,
});

const clock = new THREE.Clock();
let frame = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.12, clock.getDelta());
  if (player) {
    player.update(dt);
    if (city) city.collide(player.pos);
    world.update(dt, player.pos);
    if (player.enabled && hud) {
      checkProximity();
      hud.updateCompass(player.headingDeg());
      if (frame % 3 === 0) hud.updateDistrict(player.pos.x, player.pos.z);
      if (frame % 6 === 0) hud.drawMinimap(player.pos.x, player.pos.z, player.headingDeg(), torches);
      factTimer += dt * 3;
      if (factTimer > 75 && !hud.cardOpen && AMBIENT_FACTS.length) {
        factTimer = 0;
        hud.toast('💡 ' + AMBIENT_FACTS[factIdx % AMBIENT_FACTS.length], 8000);
        factIdx++;
      }
    }
    // animate torch flames & plaque beacons
    if (frame % 2 === 0) {
      const tNow = clock.elapsedTime;
      for (const mk of markers) {
        mk.rotation.y = tNow * 1.4;
        mk.position.y = mk.userData.baseY + Math.sin(tNow * 2 + mk.position.x) * 0.35;
      }
      for (const t of torches) {
        const f = t.group?.getObjectByName('flame');
        if (f && t.lit) { const s = 1 + Math.sin(tNow * 9 + t.x) * 0.18; f.scale.set(s, 1 + Math.sin(tNow * 7 + t.z) * 0.25, s); }
      }
    }
  }
  renderer.render(scene, camera);
  frame++;
}
loop();

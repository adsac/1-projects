// ============================================================
// main.js — Modi'in City Simulator entry point.
// ============================================================
import * as THREE from 'three';
import {
  TRAFFIC_COUNT, STREETS,
  SKY_DAY, SKY_DUSK, SKY_NIGHT, FOG_DAY, FOG_NIGHT,
} from './config.js';
import {
  buildTerrain, buildRoads, buildBuildings,
  buildLandmarks, buildProps, buildSky,
  lookupLocation, terrainHeight,
} from './city.js';
import { Player, ChaseCamera, InputState, makeCar } from './player.js';
import { HUD } from './hud.js';

// ---------- Renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = SKY_DAY.clone();
scene.fog = new THREE.Fog(FOG_DAY.clone(), 400, 2200);

const camera = new THREE.PerspectiveCamera(
  65, window.innerWidth / window.innerHeight, 0.5, 4000
);
camera.position.set(0, 30, 60);

// ---------- Lights ----------
const hemi = new THREE.HemisphereLight(0xcfe7ff, 0x8a7e5a, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3d6, 1.6);
sun.position.set(400, 700, 200);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -400;
sun.shadow.camera.right = 400;
sun.shadow.camera.top = 400;
sun.shadow.camera.bottom = -400;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 2000;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

// ---------- Build world ----------
const loadingEl = document.getElementById('loading');
const loaderFill = document.querySelector('.loader-fill');
const loaderHint = document.querySelector('.loader-hint');

function setLoader(pct, hint) {
  loaderFill.style.width = pct + '%';
  if (hint) loaderHint.textContent = hint;
}

const labels = [];
const sky = buildSky(scene);
await nextFrame();

setLoader(15, 'Sculpting terrain…');
buildTerrain(scene);
await nextFrame();

setLoader(30, 'Paving ring roads…');
buildRoads(scene);
await nextFrame();

setLoader(55, 'Raising apartments…');
buildBuildings(scene);
await nextFrame();

setLoader(75, 'Placing landmarks & Anabe Park…');
buildLandmarks(scene, labels);
await nextFrame();

setLoader(90, 'Planting trees…');
const { lamps } = buildProps(scene);
await nextFrame();

// ---------- Player ----------
setLoader(95, 'Starting engine…');
const player = new Player(scene);
const chaseCam = new ChaseCamera(camera);
const input = new InputState();

// ---------- NPC traffic (drive along street polylines) ----------
const traffic = [];
function pathTotalLen(p) {
  let s = 0;
  for (let i = 0; i < p.length - 1; i++) s += Math.hypot(p[i+1][0]-p[i][0], p[i+1][1]-p[i][1]);
  return s;
}
function sampleStreet(path, dist) {
  let rem = dist;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (rem <= L) {
      const t = rem / L;
      return {
        x: ax + (bx - ax) * t,
        z: az + (bz - az) * t,
        tx: (bx - ax) / L,
        tz: (bz - az) / L,
      };
    }
    rem -= L;
  }
  const last = path[path.length - 1];
  return { x: last[0], z: last[1], tx: 1, tz: 0 };
}
// Pre-compute lengths per drivable street.
const driveStreets = STREETS
  .filter(s => s.type !== 'highway' || Math.random() < 0.5)
  .map(s => ({ street: s, length: pathTotalLen(s.path) }));

function spawnTraffic() {
  const palette = [0x2b78b0, 0x2d8b55, 0xe1a227, 0xc44545, 0x8a61c6, 0x3c3c3c, 0xd4c9b8, 0xeaeaea];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const ds = driveStreets[Math.floor(Math.random() * driveStreets.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const dist = Math.random() * ds.length;
    const lateral = (Math.random() < 0.5 ? -1 : 1) * ds.street.width * 0.22;
    const speed = (ds.street.type === 'highway' ? 18 : ds.street.type === 'spine' ? 12 : 8) + Math.random() * 4;
    const car = makeCar(palette[i % palette.length]);
    const s = sampleStreet(ds.street.path, dist);
    const nx = -s.tz, nz = s.tx;
    car.position.set(s.x + nx * lateral, Math.max(0, terrainHeight(s.x, s.z)), s.z + nz * lateral);
    car.userData.ai = { ds, dir, dist, speed, lateral };
    scene.add(car);
    traffic.push(car);
  }
}
spawnTraffic();

function updateTraffic(dt) {
  for (const car of traffic) {
    const ai = car.userData.ai;
    ai.dist += ai.speed * ai.dir * dt;
    // Bounce at ends
    if (ai.dist < 0)           { ai.dist = 0; ai.dir = 1; car.rotation.y += Math.PI; }
    else if (ai.dist > ai.ds.length) { ai.dist = ai.ds.length; ai.dir = -1; car.rotation.y += Math.PI; }
    const s = sampleStreet(ai.ds.street.path, ai.dist);
    const nx = -s.tz, nz = s.tx;
    const x = s.x + nx * ai.lateral;
    const z = s.z + nz * ai.lateral;
    car.position.set(x, Math.max(0, terrainHeight(x, z)), z);
    const tx = s.tx * ai.dir, tz = s.tz * ai.dir;
    car.rotation.y = Math.atan2(tx, tz);
  }
}

// ---------- HUD ----------
const hud = new HUD();

// ---------- Day / Night ----------
let timeOfDay = 9.5;       // hours, 0..24
let dayPaused = false;
let nightOverride = null;  // forced night toggle

const sunOffset = new THREE.Vector3(400, 700, 200);

function updateDayNight(dt) {
  if (!dayPaused) timeOfDay = (timeOfDay + dt * (24 / 300)) % 24; // full day every 5 min
  const t = nightOverride !== null ? nightOverride : timeOfDay;

  // Sun angle (stored as an offset from the player; applied in the loop)
  const sunT = ((t - 6) / 12) * Math.PI;          // sunrise 6, sunset 18
  sunOffset.set(Math.cos(sunT) * 800, Math.sin(sunT) * 800, 200);

  const isDay = t > 6 && t < 18;
  const isDusk = (t >= 18 && t < 19.5) || (t >= 5 && t < 6.5);

  let sunInt = 0, hemiInt = 0.12;
  let skyCol, fogCol;

  if (isDay) {
    const mid = Math.sin(((t - 6) / 12) * Math.PI);
    sunInt = 0.6 + mid * 1.2;
    hemiInt = 0.35 + mid * 0.3;
    skyCol = SKY_DAY.clone().lerp(SKY_DUSK, (1 - mid) * 0.4);
    fogCol = FOG_DAY;
  } else if (isDusk) {
    sunInt = 0.4;
    hemiInt = 0.22;
    skyCol = SKY_DUSK.clone();
    fogCol = SKY_DUSK.clone().lerp(FOG_NIGHT, 0.4);
  } else {
    sunInt = 0.05;
    hemiInt = 0.12;
    skyCol = SKY_NIGHT.clone();
    fogCol = FOG_NIGHT.clone();
  }
  sun.intensity = sunInt;
  hemi.intensity = hemiInt;

  sky.material.color.copy(skyCol);
  scene.background.copy(skyCol);
  scene.fog.color.copy(fogCol);

  // Street-lamp glow
  const lampOn = !isDay && !isDusk;
  const emiss = lampOn ? 1.6 : 0;
  for (const l of lamps.children) {
    const bulb = l.userData.bulb;
    if (bulb) bulb.material.emissiveIntensity = emiss;
  }

  // Player headlights auto
  player.setHeadlights(!isDay);

  // Clock + label
  let tod = 'Day';
  if (!isDay && !isDusk) tod = 'Night';
  else if (isDusk) tod = t < 12 ? 'Dawn' : 'Dusk';
  hud.setClock(t, tod);
}

// ---------- Camera controls ----------
let pendingCameraCycle = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') pendingCameraCycle = true;
  if (e.code === 'KeyH') {
    hud.triggerHorn();
    playHorn();
  }
  if (e.code === 'KeyN') {
    nightOverride = nightOverride === null ? 0 : null;
    hud.showNotice(nightOverride !== null ? '🌙 Night mode' : '☀️ Day cycle resumed');
  }
  if (e.code === 'KeyR') {
    player.respawn();
    hud.showNotice('↺ Respawned at Azrieli Mall');
  }
  if (e.code === 'KeyM') {
    minimapVisible = !minimapVisible;
    hud.setMinimapVisible(minimapVisible);
  }
  if (e.code === 'KeyP') dayPaused = !dayPaused;
});
let minimapVisible = true;

// ---------- Horn (WebAudio) ----------
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function playHorn() {
  ensureAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(330, now + 0.25);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.32);
}

// Engine sound (continuous) — simple pitch-by-speed sawtooth.
let engineOsc = null, engineGain = null;
function startEngine() {
  ensureAudio();
  engineOsc = audioCtx.createOscillator();
  engineGain = audioCtx.createGain();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 60;
  engineGain.gain.value = 0.0;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  engineOsc.connect(filter).connect(engineGain).connect(audioCtx.destination);
  engineOsc.start();
}
function updateEngine() {
  if (!engineOsc) return;
  const speed = Math.abs(player.velocity);
  const target = 55 + speed * 6;
  engineOsc.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.12);
  engineGain.gain.setTargetAtTime(0.025 + Math.min(0.05, speed * 0.003), audioCtx.currentTime, 0.2);
}
// Start engine on first interaction
window.addEventListener('keydown', () => { if (!engineOsc) startEngine(); }, { once: true });
window.addEventListener('click', () => { if (!engineOsc) startEngine(); }, { once: true });

// ---------- Label billboards ----------
function updateLabels(dt) {
  const camPos = camera.position;
  for (const l of labels) {
    const d = camPos.distanceTo(l.pos);
    // Fade out when far, bob slightly
    l.sprite.position.y = l.baseY + Math.sin(performance.now() * 0.001 + l.pos.x) * 0.35;
    l.sprite.material.opacity = d < 300 ? Math.min(1, (300 - d) / 80) : 0;
    l.sprite.visible = d < 320;
  }
}

// ---------- Main loop ----------
let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (pendingCameraCycle) {
    player.cameraMode = (player.cameraMode + 1) % 4;
    pendingCameraCycle = false;
    const modes = ['Chase', 'Cockpit', 'Top-down', 'Hood'];
    hud.showNotice(`📷 ${modes[player.cameraMode]} camera`);
  }

  player.update(dt, input);
  updateTraffic(dt);
  chaseCam.update(dt, player);
  updateDayNight(dt);

  // Keep the directional light's shadow frustum centered on the player.
  const px = player.object.position.x;
  const pz = player.object.position.z;
  sun.position.set(px + sunOffset.x, sunOffset.y, pz + sunOffset.z);
  sun.target.position.set(px, 0, pz);
  sun.target.updateMatrixWorld();
  updateLabels(dt);
  updateEngine();

  const info = lookupLocation(player.object.position.x, player.object.position.z);
  hud.setLocation(info);
  hud.setSpeed(player.speedKmh, player.isReverse);
  hud.setCompass(player.heading);
  hud.tick(dt);
  hud.drawMinimap(player.object.position.x, player.object.position.z, player.heading, traffic);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Kick off ----------
setLoader(100, 'Welcome to Modi\'in!');
await sleep(400);
loadingEl.classList.add('hidden');
hud.reveal();
hud.showNotice('ברוכים הבאים למודיעין! · Welcome to Modi\'in!\nDrive with WASD — explore the city.');
last = performance.now();
requestAnimationFrame(loop);

function nextFrame() { return new Promise(r => requestAnimationFrame(() => r())); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

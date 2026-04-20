// ============================================================
// main.js — Modi'in City Simulator entry point.
// ============================================================
import * as THREE from 'three';
import {
  TRAFFIC_COUNT, STREETS, LANDMARKS,
  SKY_DAY, SKY_DUSK, SKY_NIGHT, FOG_DAY, FOG_NIGHT,
} from './config.js';
import {
  buildTerrain, buildRoads, buildBuildings,
  buildLandmarks, buildProps, buildSky, buildHorizon,
  lookupLocation, terrainHeight,
} from './city.js';
import {
  loadOSM, buildOSMStreets, buildOSMBuildings,
  buildOSMAreas, buildOSMRails, findByName,
} from './osm.js';
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
scene.fog = new THREE.Fog(FOG_DAY.clone(), 250, 1400);

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
sun.shadow.mapSize.set(1024, 1024);                // was 2048 — quarter the pixels
sun.shadow.camera.left = -220;
sun.shadow.camera.right = 220;
sun.shadow.camera.top = 220;
sun.shadow.camera.bottom = -220;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 1500;
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
const horizon = buildHorizon(scene);

// Starfield (visible only at night via opacity).
const starGeo = new THREE.BufferGeometry();
const starPositions = new Float32Array(2400 * 3);
for (let i = 0; i < 2400; i++) {
  const phi = Math.random() * Math.PI * 2;
  const theta = Math.acos(1 - Math.random() * 0.9);           // upper hemisphere
  const r = 2800;
  starPositions[i * 3    ] = r * Math.sin(theta) * Math.cos(phi);
  starPositions[i * 3 + 1] = r * Math.cos(theta);
  starPositions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({
  color: 0xffffff, size: 3.5, sizeAttenuation: true, transparent: true, opacity: 0,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

await nextFrame();

setLoader(10, 'Loading OpenStreetMap…');
const osm = await loadOSM('data/osm.json');
await nextFrame();

setLoader(20, 'Sculpting terrain…');
buildTerrain(scene);
await nextFrame();

const waterMeshes = [];
let lamps;
if (osm) {
  setLoader(35, 'Drawing OSM parks & water…');
  buildOSMAreas(scene, osm);
  await nextFrame();

  setLoader(50, 'Paving OSM streets…');
  buildOSMStreets(scene, osm);
  await nextFrame();

  setLoader(65, 'Laying railway…');
  buildOSMRails(scene, osm);
  await nextFrame();

  setLoader(80, 'Raising OSM buildings…');
  buildOSMBuildings(scene, osm);
  await nextFrame();

  setLoader(88, 'Placing labeled landmarks…');
  // Labels only — the building geometry is already from OSM.
  buildLandmarks(scene, labels, waterMeshes, { labelsOnly: true, locateFromOSM: osm });
  await nextFrame();

  setLoader(93, 'Planting trees…');
  ({ lamps } = buildProps(scene, { skipStreetProps: true }));
} else {
  setLoader(30, 'Paving procedural streets…');
  buildRoads(scene);
  await nextFrame();

  setLoader(55, 'Raising apartments…');
  buildBuildings(scene);
  await nextFrame();

  setLoader(75, 'Placing landmarks & Anabe Park…');
  buildLandmarks(scene, labels, waterMeshes);
  await nextFrame();

  setLoader(90, 'Planting trees…');
  ({ lamps } = buildProps(scene));
}
await nextFrame();

// ---------- Player ----------
setLoader(95, 'Starting engine…');
const player = new Player(scene);
const chaseCam = new ChaseCamera(camera);
const input = new InputState();

// Respawn near "Dam HaMaccabim" if OSM data has it.
if (osm) {
  const spawnSpot = findByName(osm, "המכבים", "Maccabim Blvd", "Dam HaMaccabim", "דרך המכבים");
  if (spawnSpot) {
    player.object.position.set(spawnSpot.x, 0, spawnSpot.z);
    player.heading = Math.PI / 2;
    player.object.rotation.y = player.heading;
    console.log('[spawn] snapped to Dam HaMaccabim:', spawnSpot);
  }
}

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
// Use OSM streets as the traffic network if available.
const streetSource = osm ? osm.streets : STREETS;
const driveStreets = streetSource
  .filter(s => s.path && s.path.length >= 2)
  .filter(s => !['highway','service'].includes(s.type) || Math.random() < 0.3)
  .filter(s => pathTotalLen(s.path) > 40)
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

// ---------- Tour: visit every landmark to complete ----------
const TOUR_TARGETS = LANDMARKS.filter(
  lm => lm.type !== 'distant' && lm.type !== 'suburb' && lm.type !== 'gateway'
);
const visited = new Set();
hud.setTour(0, TOUR_TARGETS.length);

function checkTour() {
  const p = player.object.position;
  for (const lm of TOUR_TARGETS) {
    if (visited.has(lm.key)) continue;
    const d = Math.hypot(p.x - lm.pos[0], p.z - lm.pos[1]);
    const radius = Math.max(lm.size[0], lm.size[1]) * 0.5 + 30;
    if (d < radius) {
      visited.add(lm.key);
      hud.setTour(visited.size, TOUR_TARGETS.length);
      playChime();
      if (visited.size === TOUR_TARGETS.length) {
        hud.showNotice(`🏆 Tour complete! You've seen every landmark in Modi'in.`);
      } else {
        hud.showNotice(`★ ${lm.name} visited (${visited.size}/${TOUR_TARGETS.length})`);
      }
    }
  }
}

function playChime() {
  ensureAudio();
  const t = audioCtx.currentTime;
  [880, 1320].forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t + i * 0.14);
    g.gain.setValueAtTime(0.0001, t + i * 0.14);
    g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.14 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.4);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t + i * 0.14);
    osc.stop(t + i * 0.14 + 0.45);
  });
}

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

  // Stars fade in on the way to night.
  starMat.opacity = isDay ? 0 : isDusk ? 0.25 : 0.95;
  stars.position.set(player.object.position.x, 0, player.object.position.z);
  horizon.position.set(player.object.position.x, 0, player.object.position.z);

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
let pendingAerialToggle = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') pendingCameraCycle = true;
  if (e.code === 'KeyV') pendingAerialToggle = true;
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
    player.cameraMode = (player.cameraMode + 1) % 5;
    pendingCameraCycle = false;
    const modes = ['Chase', 'Cockpit', 'Top-down', 'Hood', 'Aerial'];
    hud.showNotice(`📷 ${modes[player.cameraMode]} camera`);
  }
  if (pendingAerialToggle) {
    pendingAerialToggle = false;
    player.cameraMode = player.cameraMode === 4 ? 0 : 4;
    const modes = ['Chase', 'Cockpit', 'Top-down', 'Hood', 'Aerial'];
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
  updateWater();

  const info = lookupLocation(player.object.position.x, player.object.position.z);
  hud.setLocation(info);
  hud.setSpeed(player.speedKmh, player.isReverse);
  hud.setCompass(player.heading);
  hud.tick(dt);
  hud.drawMinimap(player.object.position.x, player.object.position.z, player.heading, traffic);
  checkTour();

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

function updateWater() {
  const t = performance.now() * 0.001;
  for (const m of waterMeshes) {
    const pos = m.geometry.attributes.position;
    const base = m.userData.basePos;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3    ];
      const y = base[i * 3 + 1];
      // Z of the geometry lies along the Y axis after rotateX - use base values.
      pos.setZ(i, Math.sin(x * 0.06 + t * 1.6) * 0.12 + Math.cos(y * 0.05 - t * 1.1) * 0.12);
    }
    pos.needsUpdate = true;
  }
}

function nextFrame() { return new Promise(r => requestAnimationFrame(() => r())); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

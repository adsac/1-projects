// ============================================================
// hud.js — Minimap, compass, clock, neighborhood & landmark UI.
// ============================================================
import { RINGS, RADIAL_COUNT, LANDMARKS, CITY_RADIUS, RAD_TO_DEG } from './config.js';

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class HUD {
  constructor() {
    this.elements = {
      neighborhood:  document.getElementById('neighborhood'),
      street:        document.getElementById('street'),
      landmark:      document.getElementById('landmark-near'),
      clock:         document.getElementById('clock'),
      timeOfDay:     document.getElementById('time-of-day'),
      speed:         document.getElementById('speed-value'),
      gear:          document.getElementById('gear-indicator'),
      compassDial:   document.getElementById('compass-dial'),
      compassLabel:  document.getElementById('compass-label'),
      notice:        document.getElementById('notice'),
      horn:          document.getElementById('horn-indicator'),
      minimap:       document.getElementById('minimap'),
      minimapWrap:   document.getElementById('minimap-wrap'),
      hudRoot:       document.getElementById('hud'),
    };
    this.mmCtx = this.elements.minimap.getContext('2d');
    this.mmSize = this.elements.minimap.width;
    this.mmScale = (this.mmSize * 0.47) / CITY_RADIUS; // fit city within minimap
    this.lastLandmarkKey = null;
    this.noticeTimer = 0;
    this.hornTimer = 0;

    this._lastMinimapDraw = 0;
    this._mmBg = null;
    this._buildMinimapBackground();
  }

  reveal() {
    this.elements.hudRoot.classList.remove('hidden');
  }

  // Bake the static parts of the minimap (roads, landmarks) once.
  _buildMinimapBackground() {
    const c = document.createElement('canvas');
    c.width = this.mmSize; c.height = this.mmSize;
    const ctx = c.getContext('2d');

    // Background
    const grd = ctx.createRadialGradient(
      this.mmSize / 2, this.mmSize / 2, 10,
      this.mmSize / 2, this.mmSize / 2, this.mmSize / 2
    );
    grd.addColorStop(0, '#1a2338');
    grd.addColorStop(1, '#0d1323');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.mmSize, this.mmSize);

    // City footprint hint
    ctx.strokeStyle = 'rgba(255,210,119,0.12)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(this.mmSize / 2, this.mmSize / 2, CITY_RADIUS * this.mmScale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ring roads
    ctx.strokeStyle = '#5a6b88';
    ctx.lineWidth = 1.4;
    for (const ring of RINGS) {
      ctx.beginPath();
      ctx.arc(this.mmSize / 2, this.mmSize / 2, ring.r * this.mmScale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Radial roads
    ctx.strokeStyle = '#4a5878';
    ctx.lineWidth = 1;
    for (let i = 0; i < RADIAL_COUNT; i++) {
      const a = (i / RADIAL_COUNT) * Math.PI * 2;
      const rOuter = RINGS[RINGS.length - 1].r * this.mmScale;
      ctx.beginPath();
      ctx.moveTo(this.mmSize / 2, this.mmSize / 2);
      ctx.lineTo(this.mmSize / 2 + Math.cos(a) * rOuter, this.mmSize / 2 + Math.sin(a) * rOuter);
      ctx.stroke();
    }

    // Landmarks
    for (const lm of LANDMARKS) {
      const mx = this.mmSize / 2 + lm.pos[0] * this.mmScale;
      const my = this.mmSize / 2 + lm.pos[1] * this.mmScale;

      if (lm.type === 'park' || lm.type === 'forest') {
        ctx.fillStyle = '#2d5a2e';
      } else if (lm.type === 'station') {
        ctx.fillStyle = '#3a78c4';
      } else if (lm.type === 'mall') {
        ctx.fillStyle = '#e4c063';
      } else {
        ctx.fillStyle = '#c8a26f';
      }
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    this._mmBg = c;
  }

  setSpeed(kmh, reverse) {
    this.elements.speed.textContent = Math.round(kmh);
    this.elements.gear.textContent = reverse ? 'R' : 'D';
  }

  setLocation(info) {
    this.elements.neighborhood.textContent = info.neighborhood;
    this.elements.street.textContent = info.street;

    if (info.nearest && info.nearest.d < 120) {
      const lm = info.nearest.lm;
      this.elements.landmark.textContent = `▶ ${lm.name} · ${Math.round(info.nearest.d)} m`;
      if (info.nearest.d < 55 && this.lastLandmarkKey !== lm.key) {
        this.showNotice(`📍 ${lm.name}\n${lm.description}`);
        this.lastLandmarkKey = lm.key;
      } else if (info.nearest.d > 120) {
        this.lastLandmarkKey = null;
      }
    } else {
      this.elements.landmark.textContent = '';
      this.lastLandmarkKey = null;
    }
  }

  setClock(hours, tod) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    this.elements.clock.textContent =
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.elements.timeOfDay.textContent = tod;
  }

  setCompass(headingRad) {
    // Heading: 0 = +X (east). Convert to compass where 0 = N.
    // In this game, heading uses yaw around Y with sin/cos(x,z). Forward = (sin h, cos h).
    // Compass bearing from north (positive z) clockwise.
    let deg = (headingRad * RAD_TO_DEG) % 360;
    if (deg < 0) deg += 360;
    this.elements.compassDial.style.transform = `rotate(${-deg}deg)`;
    const idx = Math.round(deg / 45) % 8;
    this.elements.compassLabel.textContent = COMPASS_POINTS[idx];
  }

  showNotice(text) {
    this.elements.notice.innerHTML = text.replace('\n', '<br>');
    this.elements.notice.classList.add('show');
    this.noticeTimer = 4;
  }

  triggerHorn() {
    this.elements.horn.classList.add('show');
    this.hornTimer = 0.3;
  }

  tick(dt) {
    if (this.noticeTimer > 0) {
      this.noticeTimer -= dt;
      if (this.noticeTimer <= 0) this.elements.notice.classList.remove('show');
    }
    if (this.hornTimer > 0) {
      this.hornTimer -= dt;
      if (this.hornTimer <= 0) this.elements.horn.classList.remove('show');
    }
  }

  drawMinimap(playerX, playerZ, playerHeading, traffic) {
    const ctx = this.mmCtx;
    ctx.drawImage(this._mmBg, 0, 0);

    // Traffic dots
    ctx.fillStyle = '#8ed0ff';
    for (const t of traffic) {
      const mx = this.mmSize / 2 + t.position.x * this.mmScale;
      const my = this.mmSize / 2 + t.position.z * this.mmScale;
      if (mx < 0 || mx > this.mmSize || my < 0 || my > this.mmSize) continue;
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }

    // Player marker (triangle pointing in heading direction).
    // Clamp to the canvas edge so the player doesn't disappear off-map.
    const pad = 8;
    const px = Math.max(pad, Math.min(this.mmSize - pad, this.mmSize / 2 + playerX * this.mmScale));
    const py = Math.max(pad, Math.min(this.mmSize - pad, this.mmSize / 2 + playerZ * this.mmScale));
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(playerHeading);
    ctx.fillStyle = '#ff5c5c';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // Rim accent
    ctx.strokeStyle = 'rgba(255,210,119,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, this.mmSize - 2, this.mmSize - 2);
  }

  setMinimapVisible(v) {
    this.elements.minimapWrap.style.display = v ? 'block' : 'none';
  }
}

// ============================================================
// hud.js — Minimap, compass, clock, neighborhood & landmark UI.
// ============================================================
import { STREETS, LANDMARKS, NEIGHBORHOODS, CITY_BOUNDS, RAD_TO_DEG } from './config.js';

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class HUD {
  constructor() {
    this.elements = {
      neighborhood:  document.getElementById('neighborhood'),
      street:        document.getElementById('street'),
      landmark:      document.getElementById('landmark-near'),
      clock:         document.getElementById('clock'),
      timeOfDay:     document.getElementById('time-of-day'),
      tourProgress:  document.getElementById('tour-progress'),
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
    // Fit the city's longest half-extent inside the minimap.
    const halfMax = Math.max(
      Math.max(-CITY_BOUNDS.minX, CITY_BOUNDS.maxX),
      Math.max(-CITY_BOUNDS.minZ, CITY_BOUNDS.maxZ)
    );
    this.mmScale = (this.mmSize * 0.46) / halfMax;
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

    // Neighborhood fills (very subtle warm tint)
    ctx.fillStyle = 'rgba(255, 210, 119, 0.05)';
    for (const n of NEIGHBORHOODS) {
      const [x0, z0, x1, z1] = n.aabb;
      ctx.fillRect(
        this.mmSize / 2 + x0 * this.mmScale,
        this.mmSize / 2 + z0 * this.mmScale,
        (x1 - x0) * this.mmScale,
        (z1 - z0) * this.mmScale,
      );
    }

    // City footprint hint
    ctx.strokeStyle = 'rgba(255,210,119,0.12)';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(
      this.mmSize / 2 + CITY_BOUNDS.minX * this.mmScale,
      this.mmSize / 2 + CITY_BOUNDS.minZ * this.mmScale,
      (CITY_BOUNDS.maxX - CITY_BOUNDS.minX) * this.mmScale,
      (CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ) * this.mmScale,
    );
    ctx.setLineDash([]);

    // Streets (highways bolder, spine brightest)
    for (const s of STREETS) {
      if (s.type === 'highway')   { ctx.strokeStyle = '#6c7e9f'; ctx.lineWidth = 2.2; }
      else if (s.type === 'spine'){ ctx.strokeStyle = '#ffd277'; ctx.lineWidth = 1.8; }
      else if (s.type === 'arterial') { ctx.strokeStyle = '#7a8ba8'; ctx.lineWidth = 1.5; }
      else                        { ctx.strokeStyle = '#4a5878'; ctx.lineWidth = 1; }
      ctx.beginPath();
      for (let i = 0; i < s.path.length; i++) {
        const [x, z] = s.path[i];
        const mx = this.mmSize / 2 + x * this.mmScale;
        const my = this.mmSize / 2 + z * this.mmScale;
        if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
      }
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

  setTour(visited, total) {
    this.elements.tourProgress.textContent = visited === total
      ? `★ Tour complete! ${visited}/${total}`
      : `Tour: ${visited}/${total}`;
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

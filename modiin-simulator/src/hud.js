// HUD: compass, real-network minimap & city map, plaque cards with quizzes,
// torch tracker, toasts, district banners.
import { WORLD } from './loader.js';
import { DISTRICTS, LANDMARKS } from './data/cityinfo.js';

const $ = id => document.getElementById(id);

const ROAD_MAP_STYLE = {   // cls → [color, width@2048px, minWidth]
  0: ['#8f8f96', 5.5], 1: ['#8f8f96', 5], 2: ['#ffffff', 4], 3: ['#ffffff', 3.4],
  4: ['#ffffff', 2.6], 5: ['#e9e4d8', 1.6], 6: ['#e9e4d8', 1.5], 7: ['#ded8ca', 0.9],
  8: ['#cfc4a8', 0.6], 9: ['#cfc4a8', 0.6], 10: ['#c9a294', 0.7], 11: ['#c2b493', 0.8],
};

export class Hud {
  constructor(cityData) {
    this.data = cityData;
    this.torchesLit = 0;
    this.torchesTotal = 8;
    this.visited = new Set();
    this._district = null;
    this._buildCompass();
    this._minimap = $('minimap').getContext('2d');
    this._prerender();
    $('bigmap-wrap').addEventListener('click', () => this.hideMap());
    this.updateTorches();
  }

  // draw the whole real city once to offscreen canvases (dark + light themes)
  _prerender() {
    const make = (dark) => {
      const T = 2048;
      const c = document.createElement('canvas');
      c.width = T; c.height = Math.round(T * WORLD.sizeZ / WORLD.sizeX);
      const g = c.getContext('2d');
      const sx = T / WORLD.sizeX, sz = c.height / WORLD.sizeZ;
      const X = x => (x + WORLD.sizeX / 2) * sx;
      const Z = z => (z + WORLD.sizeZ / 2) * sz;
      g.fillStyle = dark ? '#232b1e' : '#e9e2cd';
      g.fillRect(0, 0, c.width, c.height);
      // areas
      for (const a of this.data.areas) {
        let col = null;
        if (a.kind === 1) col = dark ? '#2e4423' : '#b5cd92';
        else if (a.kind === 2) col = dark ? '#25381d' : '#9dbd7e';
        else if (a.kind === 3) col = dark ? '#2e4a28' : '#a7cd8e';
        else if (a.kind === 8 || a.kind === 9) col = dark ? '#2c2c20' : '#ded3ab';
        else if (a.kind === 0) col = dark ? '#1d4056' : '#7fb2cc';
        if (!col) continue;
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(X(a.pts[0]), Z(a.pts[1]));
        for (let i = 1; i < a.pts.length / 2; i++) g.lineTo(X(a.pts[i * 2]), Z(a.pts[i * 2 + 1]));
        g.closePath(); g.fill();
      }
      // buildings faint
      g.fillStyle = dark ? 'rgba(180,170,150,0.16)' : 'rgba(120,105,80,0.22)';
      for (const b of this.data.buildings) {
        g.beginPath();
        g.moveTo(X(b.pts[0]), Z(b.pts[1]));
        for (let i = 1; i < b.pts.length / 2; i++) g.lineTo(X(b.pts[i * 2]), Z(b.pts[i * 2 + 1]));
        g.closePath(); g.fill();
      }
      // roads, minor first
      const order = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 12];
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const cls of order) {
        for (const r of this.data.roads) {
          if (r.cls !== cls) continue;
          if (cls === 12) { g.strokeStyle = dark ? '#6b655a' : '#8a8375'; g.lineWidth = 1.4; g.setLineDash([7, 5]); }
          else {
            const st = ROAD_MAP_STYLE[cls];
            if (!st) continue;
            g.strokeStyle = dark ? (cls <= 4 ? '#a09a8c' : '#5c6152') : st[0];
            g.lineWidth = st[1];
            g.setLineDash([]);
          }
          g.beginPath();
          g.moveTo(X(r.pts[0]), Z(r.pts[1]));
          for (let i = 1; i < r.pts.length / 2; i++) g.lineTo(X(r.pts[i * 2]), Z(r.pts[i * 2 + 1]));
          g.stroke();
        }
      }
      g.setLineDash([]);
      return c;
    };
    this._mapDark = make(true);
    this._mapLight = make(false);
    this._pxPerM = 2048 / WORLD.sizeX;
  }

  _buildCompass() {
    const strip = $('compass-strip');
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    let html = '';
    for (let rep = 0; rep < 3; rep++) {
      for (let i = 0; i < 8; i++) html += `<span class="${i % 2 === 0 ? 'card-dir' : ''}">${dirs[i]}</span>`;
    }
    strip.innerHTML = html;
  }

  updateCompass(headingDeg) {
    const stripW = 60 * 8;
    const px = (headingDeg / 360) * stripW;
    const center = $('compass').clientWidth / 2;
    $('compass-strip').style.transform = `translateX(${center - stripW - px - 30}px)`;
  }

  updateDistrict(x, z) {
    let found = null, best = 1e9;
    for (const d of DISTRICTS) {
      const norm = Math.hypot(x - d.x, z - d.z) / d.r;
      if (norm < 1 && norm < best) { best = norm; found = d; }
    }
    const name = found ? found.name : null;
    if (name !== this._district) {
      this._district = name;
      if (found) {
        $('location-name').textContent = found.name;
        $('location-sub').textContent = (found.theme ? found.theme + ' · ' : '') + found.heb;
        const b = $('location-banner');
        b.classList.remove('hidden');
        b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
        clearTimeout(this._bannerTimer);
        this._bannerTimer = setTimeout(() => b.classList.add('hidden'), 4200);
      }
    }
  }

  showPrompt(text) {
    $('prompt-text').textContent = text;
    $('prompt').classList.remove('hidden');
    $('touch-action').classList.toggle('hidden', !document.body.classList.contains('touch'));
  }
  hidePrompt() { $('prompt').classList.add('hidden'); $('touch-action').classList.add('hidden'); }

  showCard(lm, onClose) {
    this._onCardClose = onClose;
    $('card-kicker').textContent = lm.kicker || "Modi'in";
    $('card-title').textContent = lm.name;
    $('card-heb').textContent = lm.heb || '';
    $('card-text').innerHTML = lm.info;
    const quizBox = $('card-quiz');
    if (lm.quiz && !this.visited.has(lm.id)) {
      quizBox.classList.remove('hidden');
      $('quiz-q').textContent = lm.quiz.q;
      const ans = $('quiz-answers');
      ans.innerHTML = '';
      $('quiz-result').classList.add('hidden');
      lm.quiz.a.forEach((txt, i) => {
        const b = document.createElement('button');
        b.textContent = txt;
        b.onclick = () => {
          [...ans.children].forEach((c, j) => {
            c.disabled = true;
            if (j === lm.quiz.correct) c.classList.add('correct');
          });
          if (i !== lm.quiz.correct) b.classList.add('wrong');
          const r = $('quiz-result');
          r.textContent = (i === lm.quiz.correct ? '✔ Right! ' : '✘ Not quite — ') + lm.quiz.explain;
          r.style.color = i === lm.quiz.correct ? '#2c7a22' : '#a34a38';
          r.classList.remove('hidden');
        };
        ans.appendChild(b);
      });
    } else quizBox.classList.add('hidden');
    this.visited.add(lm.id);
    $('card').classList.remove('hidden');
  }
  hideCard() {
    $('card').classList.add('hidden');
    this._onCardClose?.();
    this._onCardClose = null;
  }
  get cardOpen() { return !$('card').classList.contains('hidden'); }

  updateTorches() {
    let flames = '';
    for (let i = 0; i < this.torchesTotal; i++) flames += i < this.torchesLit ? '🔥' : '·';
    $('torch-flames').textContent = flames;
    $('torch-count').textContent = `${this.torchesLit}/${this.torchesTotal} torches`;
  }

  toast(html, ms = 4200) {
    const t = $('toast');
    t.innerHTML = html;
    t.classList.remove('hidden');
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  // ── rotating minimap from the prerender ──
  drawMinimap(px, pz, headingDeg, torches) {
    const ctx = this._minimap;
    const Wc = ctx.canvas.width, Hc = ctx.canvas.height;
    const R = 430;                       // metres shown from centre to edge
    const img = this._mapDark;
    const s = this._pxPerM;
    const zoom = (Wc / 2) / (R * s);
    ctx.clearRect(0, 0, Wc, Hc);
    ctx.save();
    ctx.beginPath(); ctx.arc(Wc / 2, Hc / 2, Wc / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#232b1e'; ctx.fillRect(0, 0, Wc, Hc);
    ctx.translate(Wc / 2, Hc / 2);
    ctx.rotate(-headingDeg * Math.PI / 180);
    ctx.scale(zoom, zoom);
    ctx.translate(-(px + WORLD.sizeX / 2) * s, -(pz + WORLD.sizeZ / 2) * s);
    ctx.drawImage(img, 0, 0);
    // dots in map space
    const dot = (x, z, col, r) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc((x + WORLD.sizeX / 2) * s, (z + WORLD.sizeZ / 2) * s, r / zoom, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const lm of LANDMARKS) {
      if (lm.hideOnMap) continue;
      dot(lm.x, lm.z, this.visited.has(lm.id) ? '#d9cda8' : '#f2b632', 3.6);
    }
    if (torches) for (const t of torches) if (!t.lit) dot(t.x, t.z, '#ff7b3a', 3.2);
    ctx.restore();

    // player arrow
    ctx.save();
    ctx.translate(Wc / 2, Hc / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6, 7);
    ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.rotate(-headingDeg * Math.PI / 180);
    ctx.fillStyle = '#ffd769'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', 0, -Wc / 2 + 16);
    ctx.restore();
  }

  // ── full map ──
  showMap(px, pz) {
    const ctx = $('bigmap').getContext('2d');
    const img = this._mapLight;
    const Wc = 940;
    const Hc = Math.round(Wc * img.height / img.width);
    ctx.canvas.width = Wc; ctx.canvas.height = Hc;
    ctx.drawImage(img, 0, 0, Wc, Hc);
    const X = x => (x + WORLD.sizeX / 2) / WORLD.sizeX * Wc;
    const Z = z => (z + WORLD.sizeZ / 2) / WORLD.sizeZ * Hc;
    // district names
    ctx.textAlign = 'center';
    ctx.font = '600 12px sans-serif';
    for (const d of DISTRICTS) {
      ctx.fillStyle = 'rgba(90,75,45,0.85)';
      ctx.fillText(d.name, X(d.x), Z(d.z));
    }
    // landmarks
    ctx.font = '600 11px sans-serif';
    for (const lm of LANDMARKS) {
      if (lm.hideOnMap) continue;
      ctx.fillStyle = '#c8930f';
      ctx.beginPath(); ctx.arc(X(lm.x), Z(lm.z), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#4a3d1f'; ctx.textAlign = 'left';
      ctx.fillText(lm.name, X(lm.x) + 7, Z(lm.z) + 4);
    }
    // player
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(X(px), Z(pz), 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#4a3d1f'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('N ↑', 14, 22);
    $('bigmap-wrap').classList.remove('hidden');
  }
  hideMap() { $('bigmap-wrap').classList.add('hidden'); }
  get mapOpen() { return !$('bigmap-wrap').classList.contains('hidden'); }
}

// HUD: compass, minimap, location banner, plaque cards with quizzes,
// torch quest tracker, toasts, full map.
import { WORLD, ROADS, PARKS, DISTRICTS, LANDMARKS } from './data/city-data.js';

const $ = id => document.getElementById(id);

export class Hud {
  constructor() {
    this.torchesLit = 0;
    this.torchesTotal = 8;
    this.visited = new Set();
    this._toastTimer = null;
    this._district = null;
    this._buildCompass();
    this._minimap = $('minimap').getContext('2d');
    this._bigmapDrawn = false;
    $('bigmap-wrap').addEventListener('click', () => this.hideMap());
    this.updateTorches();
  }

  _buildCompass() {
    const strip = $('compass-strip');
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    let html = '';
    for (let rep = 0; rep < 3; rep++) {
      for (let i = 0; i < 8; i++) {
        const main = i % 2 === 0;
        html += `<span class="${main ? 'card-dir' : ''}">${dirs[i]}</span>`;
      }
    }
    strip.innerHTML = html;
  }

  updateCompass(headingDeg) {
    // strip: 24 spans of 60px covering 3×360°. Center span index = heading/45.
    const stripW = 60 * 8;
    const px = (headingDeg / 360) * stripW;
    const center = document.getElementById('compass').clientWidth / 2;
    $('compass-strip').style.transform = `translateX(${center - stripW - px - 30}px)`;
  }

  // ── location banner ──
  updateDistrict(x, z) {
    let found = null, best = 1e9;
    for (const d of DISTRICTS) {
      const dx = (x - d.x) / (d.sx || 1), dz = (z - d.z) / (d.sz || 1);
      const norm = Math.hypot(dx, dz) / (d.r * 1.15);   // nearest district wins
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

  // ── prompt ──
  showPrompt(text) { $('prompt-text').textContent = text; $('prompt').classList.remove('hidden'); $('touch-action').classList.toggle('hidden', !document.body.classList.contains('touch')); }
  hidePrompt() { $('prompt').classList.add('hidden'); $('touch-action').classList.add('hidden'); }

  // ── plaque cards ──
  showCard(lm, onClose) {
    this._onCardClose = onClose;
    $('card-kicker').textContent = lm.kicker || 'Modi\'in';
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

  // ── torch quest ──
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

  // ── minimap (rotating, centred on player) ──
  drawMinimap(px, pz, headingDeg, torches) {
    const ctx = this._minimap;
    const Wc = ctx.canvas.width, Hc = ctx.canvas.height;
    const R = 470;              // metres of world shown across the minimap
    const s = Wc / (R * 2);
    ctx.clearRect(0, 0, Wc, Hc);
    ctx.save();
    ctx.beginPath(); ctx.arc(Wc / 2, Hc / 2, Wc / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#33402c'; ctx.fillRect(0, 0, Wc, Hc);
    ctx.translate(Wc / 2, Hc / 2);
    ctx.rotate(-headingDeg * Math.PI / 180);
    ctx.translate(-px * s, -pz * s);

    // parks
    for (const p of PARKS) {
      ctx.fillStyle = '#41682f';
      ctx.beginPath(); ctx.arc(p.x * s, p.z * s, p.r * s, 0, Math.PI * 2); ctx.fill();
      if (p.lake) {
        ctx.fillStyle = '#2f6f95';
        ctx.beginPath(); ctx.arc((p.x + (p.lake.dx || 0)) * s, (p.z + (p.lake.dz || 0)) * s, p.lake.r * s, 0, Math.PI * 2); ctx.fill();
      }
    }
    // roads
    for (const r of ROADS) {
      ctx.strokeStyle = r.kind === 'rail' ? '#8a8578' : (r.kind === 'boulevard' ? '#c9c2b2' : '#9a948a');
      ctx.lineWidth = Math.max(1.5, r.width * s * 0.9);
      if (r.kind === 'rail') ctx.setLineDash([6, 4]); else ctx.setLineDash([]);
      ctx.beginPath();
      r.pts.forEach(([x, z], i) => i ? ctx.lineTo(x * s, z * s) : ctx.moveTo(x * s, z * s));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // landmarks
    for (const lm of LANDMARKS) {
      if (lm.hideOnMap) continue;
      ctx.fillStyle = this.visited.has(lm.id) ? '#e8dcbb' : '#f2b632';
      ctx.beginPath(); ctx.arc(lm.x * s, lm.z * s, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    // torches not yet lit
    if (torches) for (const t of torches) {
      if (t.lit) continue;
      ctx.fillStyle = '#ff7b3a';
      ctx.beginPath(); ctx.arc(t.x * s, t.z * s, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // player arrow (always centre, pointing up)
    ctx.save();
    ctx.translate(Wc / 2, Hc / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6, 7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // N marker
    ctx.save();
    ctx.translate(Wc / 2, Hc / 2);
    ctx.rotate(-headingDeg * Math.PI / 180);
    ctx.fillStyle = '#ffd769'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', 0, -Wc / 2 + 16);
    ctx.restore();
  }

  // ── big map ──
  showMap(px, pz) {
    const ctx = $('bigmap').getContext('2d');
    const Wc = ctx.canvas.width, Hc = ctx.canvas.height;
    const S = WORLD.size, s = Math.min(Wc, Hc) / S;
    ctx.fillStyle = '#e5dcc4'; ctx.fillRect(0, 0, Wc, Hc);
    ctx.save();
    ctx.translate(Wc / 2, Hc / 2);
    for (const p of PARKS) {
      ctx.fillStyle = '#a8c68b';
      ctx.beginPath(); ctx.arc(p.x * s, p.z * s, p.r * s, 0, Math.PI * 2); ctx.fill();
      if (p.lake) {
        ctx.fillStyle = '#6fa7c4';
        ctx.beginPath(); ctx.arc((p.x + (p.lake.dx || 0)) * s, (p.z + (p.lake.dz || 0)) * s, p.lake.r * s, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const d of DISTRICTS) {
      ctx.fillStyle = 'rgba(160,140,100,0.16)';
      ctx.beginPath();
      ctx.ellipse(d.x * s, d.z * s, d.r * (d.sx || 1) * s, d.r * (d.sz || 1) * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b5c3c'; ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.name, d.x * s, d.z * s - d.r * (d.sz || 1) * s * 0.4);
    }
    for (const r of ROADS) {
      ctx.strokeStyle = r.kind === 'rail' ? '#7d7568' : '#ffffff';
      ctx.lineWidth = r.kind === 'boulevard' ? 5 : 2.5;
      if (r.kind === 'rail') { ctx.setLineDash([7, 5]); ctx.lineWidth = 2; }
      ctx.beginPath();
      r.pts.forEach(([x, z], i) => i ? ctx.lineTo(x * s, z * s) : ctx.moveTo(x * s, z * s));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.font = '600 11px sans-serif';
    for (const lm of LANDMARKS) {
      if (lm.hideOnMap) continue;
      ctx.fillStyle = '#c8930f';
      ctx.beginPath(); ctx.arc(lm.x * s, lm.z * s, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a3d1f'; ctx.textAlign = 'left';
      ctx.fillText(lm.name, lm.x * s + 7, lm.z * s + 4);
    }
    // player
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(px * s, pz * s, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    // compass rose
    ctx.fillStyle = '#4a3d1f'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N ↑', -Wc / 2 + 30, -Hc / 2 + 26);
    ctx.restore();
    $('bigmap-wrap').classList.remove('hidden');
  }
  hideMap() { $('bigmap-wrap').classList.add('hidden'); }
  get mapOpen() { return !$('bigmap-wrap').classList.contains('hidden'); }
}

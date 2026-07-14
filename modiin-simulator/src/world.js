// Terrain from the real DEM + baked aerial ground texture, sky, sun, day/night.
import * as THREE from 'three';
import { WORLD } from './loader.js';

export class World {
  constructor(scene, heightAt) {
    this.scene = scene;
    this.heightAt = heightAt;
    this.night = false;
    this._buildGround();
    this._buildSky();
    this._buildLights();
    this.setNight(false, true);
  }

  _buildGround() {
    const N = 300, M = 298;
    const geo = new THREE.PlaneGeometry(WORLD.sizeX, WORLD.sizeZ, N, M);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      pos.setY(k, this.heightAt(pos.getX(k), pos.getZ(k)));
    }
    geo.computeVertexNormals();
    const tex = new THREE.TextureLoader().load('data/ground.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // apron beyond the data edge so the horizon never shows void
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.sizeX * 5, WORLD.sizeZ * 5),
      new THREE.MeshLambertMaterial({ color: '#b3a678' }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = 60;   // roughly the coastal-plain edge height
    this.apron = apron;
    this.scene.add(apron);
    apron.renderOrder = -1;
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(16000, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#3f7fd4') },
        botColor: { value: new THREE.Color('#dfeaf2') },
        offset: { value: 1200 }, exponent: { value: 0.7 },
      },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 topColor,botColor; uniform float offset,exponent; varying vec3 vp;
        void main(){ float h = normalize(vp + vec3(0,offset,0)).y;
        gl_FragColor = vec4(mix(botColor, topColor, max(pow(max(h,0.0), exponent), 0.0)), 1.0); }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);

    const starGeo = new THREE.BufferGeometry();
    const n = 1100, sp = new Float32Array(n * 3);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const t = rnd() * Math.PI * 2, p = Math.acos(rnd() * 0.92);
      const r = 15000;
      sp[i * 3] = r * Math.sin(p) * Math.cos(t);
      sp[i * 3 + 1] = r * Math.cos(p) + 400;
      sp[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo,
      new THREE.PointsMaterial({ color: '#ffffff', size: 18, transparent: true, opacity: 0 }));
    this.scene.add(this.stars);
  }

  _buildLights() {
    this.sun = new THREE.DirectionalLight('#fff4dd', 2.15);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.near = 100; s.camera.far = 3000;
    s.camera.left = s.camera.bottom = -650; s.camera.right = s.camera.top = 650;
    s.bias = -0.0007;
    this.scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight('#cfe4ff', '#8f8460', 0.72);
    this.moon = new THREE.DirectionalLight('#9db6e8', 0);
    this.moon.position.set(2000, 3000, -1500);
    this.scene.add(this.hemi, this.moon);
  }

  setNight(night, instant = false) {
    this.night = night;
    this._targets = night
      ? { top: '#0b1230', bot: '#1c2a4a', fog: '#141c34', sun: 0, moon: 0.45, hemi: 0.16, stars: 0.95, ground: 0.32 }
      : { top: '#3f7fd4', bot: '#e6ecf0', fog: '#dde5e8', sun: 2.15, moon: 0, hemi: 0.72, stars: 0, ground: 1 };
    if (!this.scene.fog) this.scene.fog = new THREE.Fog('#dde5e8', 700, 4200);
    if (instant) this._applyLerp(1);
  }

  _applyLerp(k) {
    const t = this._targets; if (!t) return;
    const u = this.sky.material.uniforms;
    u.topColor.value.lerp(new THREE.Color(t.top), k);
    u.botColor.value.lerp(new THREE.Color(t.bot), k);
    this.scene.fog.color.lerp(new THREE.Color(t.fog), k);
    this.sun.intensity += (t.sun - this.sun.intensity) * k;
    this.moon.intensity += (t.moon - this.moon.intensity) * k;
    this.hemi.intensity += (t.hemi - this.hemi.intensity) * k;
    this.stars.material.opacity += (t.stars - this.stars.material.opacity) * k;
  }

  update(dt, playerPos) {
    this._applyLerp(Math.min(1, dt * 1.6));
    this.sun.position.set(playerPos.x - 500, 950, playerPos.z + 320);
    this.sun.target.position.set(playerPos.x, 0, playerPos.z);
    this.sky.position.set(playerPos.x, 0, playerPos.z);
  }
}

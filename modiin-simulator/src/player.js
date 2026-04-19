// ============================================================
// player.js — Car model, arcade physics, chase camera.
// ============================================================
import * as THREE from 'three';
import { CAR } from './config.js';
import { terrainHeight } from './city.js';

export function makeCar(bodyColor = 0xd94c3a) {
  const g = new THREE.Group();

  // Chassis
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(CAR.width, 0.55, CAR.length),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.3 })
  );
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  g.add(chassis);

  // Cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(CAR.width - 0.25, 0.7, CAR.length * 0.55),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.35 })
  );
  cabin.position.set(0, 1.15, -0.1);
  cabin.castShadow = true;
  g.add(cabin);

  // Windows (one slab mesh on the top of the cabin)
  const windows = new THREE.Mesh(
    new THREE.BoxGeometry(CAR.width - 0.35, 0.6, CAR.length * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1a2330, roughness: 0.25, metalness: 0.9, transparent: true, opacity: 0.85 })
  );
  windows.position.set(0, 1.2, -0.1);
  g.add(windows);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const offsets = [
    [ CAR.width / 2, 0.35,  CAR.length / 2 - 0.7],
    [-CAR.width / 2, 0.35,  CAR.length / 2 - 0.7],
    [ CAR.width / 2, 0.35, -CAR.length / 2 + 0.7],
    [-CAR.width / 2, 0.35, -CAR.length / 2 + 0.7],
  ];
  const wheels = [];
  for (const [x, y, z] of offsets) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, y, z);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }

  // Headlights (emissive + actual SpotLights)
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c4, emissive: 0xfff2c4, emissiveIntensity: 1.2,
  });
  const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.1), headMat);
  const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.1), headMat);
  hl1.position.set( CAR.width / 2 - 0.35, 0.7,  CAR.length / 2 - 0.05);
  hl2.position.set(-CAR.width / 2 + 0.35, 0.7,  CAR.length / 2 - 0.05);
  g.add(hl1); g.add(hl2);

  // Tail lights
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x551111, emissive: 0xff2020, emissiveIntensity: 0.6,
  });
  const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), tailMat);
  const tl2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), tailMat);
  tl1.position.set( CAR.width / 2 - 0.35, 0.75, -CAR.length / 2 + 0.05);
  tl2.position.set(-CAR.width / 2 + 0.35, 0.75, -CAR.length / 2 + 0.05);
  g.add(tl1); g.add(tl2);

  // SpotLights for headlights
  const leftLight = new THREE.SpotLight(0xfff0c0, 0, 60, Math.PI / 6, 0.4, 1.3);
  leftLight.position.set(-CAR.width / 2 + 0.35, 0.8, CAR.length / 2);
  leftLight.target.position.set(-CAR.width / 2 + 0.35, 0, CAR.length / 2 + 10);
  g.add(leftLight); g.add(leftLight.target);

  const rightLight = new THREE.SpotLight(0xfff0c0, 0, 60, Math.PI / 6, 0.4, 1.3);
  rightLight.position.set(CAR.width / 2 - 0.35, 0.8, CAR.length / 2);
  rightLight.target.position.set(CAR.width / 2 - 0.35, 0, CAR.length / 2 + 10);
  g.add(rightLight); g.add(rightLight.target);

  g.userData = {
    wheels,
    headlights: [leftLight, rightLight],
    headlightMeshes: [hl1, hl2],
    taillights: [tl1, tl2],
    tailMat,
    headMat,
  };

  return g;
}

export class Player {
  constructor(scene) {
    this.object = makeCar(0xd94c3a);
    scene.add(this.object);

    // Start on Dam HaMaccabim just east of the Azrieli Mall, facing east.
    this.object.position.set(-1600, 0, -10);
    this.object.rotation.order = 'YXZ';        // yaw-pitch-roll feels natural
    this.object.rotation.y = Math.PI / 2;

    this.velocity = 0;           // forward speed (m/s, can be negative)
    this.heading = Math.PI / 2;  // yaw (facing +X = east)
    this.steerAngle = 0;         // current front-wheel steer
    this.handbrake = false;

    this.cameraMode = 0;         // 0 = chase, 1 = cockpit, 2 = top-down, 3 = hood
    this.hornActive = false;
    this.headlightsOn = false;
  }

  setHeadlights(on) {
    this.headlightsOn = on;
    const i = on ? 2.2 : 0;
    for (const l of this.object.userData.headlights) l.intensity = i;
    const emiss = on ? 1.8 : 0.2;
    this.object.userData.headMat.emissiveIntensity = emiss;
  }

  update(dt, input) {
    const throttle = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.handbrake = !!input.brake;

    // Acceleration / braking
    if (throttle > 0) {
      this.velocity += CAR.accel * dt;
    } else if (throttle < 0) {
      if (this.velocity > 0.5) this.velocity -= CAR.brake * dt;
      else this.velocity -= CAR.accel * 0.6 * dt;
    } else {
      // Roll-off friction
      if (this.velocity > 0) this.velocity = Math.max(0, this.velocity - CAR.friction * dt);
      else if (this.velocity < 0) this.velocity = Math.min(0, this.velocity + CAR.friction * dt);
    }
    if (this.handbrake) {
      if (this.velocity > 0) this.velocity = Math.max(0, this.velocity - CAR.brake * 1.4 * dt);
      else this.velocity = Math.min(0, this.velocity + CAR.brake * 1.4 * dt);
    }

    // Clamp speeds
    this.velocity = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, this.velocity));

    // Steering responsiveness reduces with speed (more realistic)
    const speedRatio = Math.min(1, Math.abs(this.velocity) / CAR.maxSpeed);
    const steerMag = CAR.steerRate * (1 - speedRatio * CAR.steerSpeedDamp);
    const targetSteer = steerInput * 0.55;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 8);

    // Apply yaw based on velocity * steering (bicycle model-ish)
    const wheelBase = CAR.length * 0.72;
    if (Math.abs(this.velocity) > 0.05) {
      const turn = (this.velocity / wheelBase) * Math.tan(this.steerAngle) * dt;
      this.heading += turn;
    }

    // Move forward
    const dx = Math.sin(this.heading) * this.velocity * dt;
    const dz = Math.cos(this.heading) * this.velocity * dt;
    this.object.position.x += dx;
    this.object.position.z += dz;
    this.object.rotation.y = this.heading;

    // Terrain follow with a 4-wheel sample for pitch and roll.
    const hx = Math.sin(this.heading), hz = Math.cos(this.heading);
    const px = -hz, pz = hx;                   // right-perp
    const half = CAR.length * 0.45;
    const hw = CAR.width * 0.5;
    const cx = this.object.position.x, cz = this.object.position.z;
    const yFL = terrainHeight(cx + hx * half - px * hw, cz + hz * half - pz * hw);
    const yFR = terrainHeight(cx + hx * half + px * hw, cz + hz * half + pz * hw);
    const yRL = terrainHeight(cx - hx * half - px * hw, cz - hz * half - pz * hw);
    const yRR = terrainHeight(cx - hx * half + px * hw, cz - hz * half + pz * hw);
    const front = (yFL + yFR) * 0.5;
    const rear  = (yRL + yRR) * 0.5;
    const left  = (yFL + yRL) * 0.5;
    const right = (yFR + yRR) * 0.5;
    const avg = (yFL + yFR + yRL + yRR) * 0.25;
    this.object.position.y = avg;
    // Body pitch (nose-up on accel, nose-down on brake) + terrain pitch.
    const targetPitch = Math.atan2(rear - front, CAR.length) - Math.sign(this.velocity) * 0.01 - (throttle > 0 ? 0.015 : 0) + (throttle < 0 && this.velocity > 1 ? 0.025 : 0);
    const targetRoll  = Math.atan2(left - right, CAR.width);
    this._pitch = (this._pitch || 0) * 0.85 + targetPitch * 0.15;
    this._roll  = (this._roll  || 0) * 0.85 + targetRoll  * 0.15;
    this.object.rotation.x = this._pitch;
    this.object.rotation.z = this._roll;

    // Wheel spin (visual)
    const wheels = this.object.userData.wheels;
    const rotSpeed = this.velocity / 0.35;
    wheels[0].rotation.x -= rotSpeed * dt;
    wheels[1].rotation.x -= rotSpeed * dt;
    wheels[2].rotation.x -= rotSpeed * dt;
    wheels[3].rotation.x -= rotSpeed * dt;
    wheels[0].rotation.y = this.steerAngle;
    wheels[1].rotation.y = this.steerAngle;

    // Brake-light intensity pulses with braking
    const braking = (throttle < 0 && this.velocity > 0) || this.handbrake;
    this.object.userData.tailMat.emissiveIntensity = braking ? 1.4 : 0.5;

    // World bounds (soft)
    const max = 1700;
    this.object.position.x = Math.max(-max, Math.min(max, this.object.position.x));
    this.object.position.z = Math.max(-max, Math.min(max, this.object.position.z));
  }

  respawn() {
    this.object.position.set(-1600, 0, -10);
    this.heading = Math.PI / 2;
    this.velocity = 0;
  }

  get speedKmh() {
    return Math.abs(this.velocity) * 3.6;
  }
  get isReverse() {
    return this.velocity < -0.2;
  }
}

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.current = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.curLook = new THREE.Vector3();
  }
  update(dt, player) {
    const mode = player.cameraMode;
    const p = player.object.position;
    const h = player.heading;
    const back = -Math.sin(h), backZ = -Math.cos(h);

    if (mode === 0) {
      // Chase
      this.target.set(p.x + back * 10, p.y + 4.2, p.z + backZ * 10);
      this.look.set(p.x, p.y + 1.5, p.z);
    } else if (mode === 1) {
      // Cockpit
      this.target.set(
        p.x - Math.sin(h) * 0.2,
        p.y + 1.3,
        p.z - Math.cos(h) * 0.2
      );
      this.look.set(p.x + Math.sin(h) * 10, p.y + 1.3, p.z + Math.cos(h) * 10);
    } else if (mode === 2) {
      // Top-down
      this.target.set(p.x, p.y + 55, p.z + 0.01);
      this.look.set(p.x, p.y, p.z);
    } else if (mode === 3) {
      // Hood cam
      this.target.set(
        p.x + Math.sin(h) * 1.5,
        p.y + 1.6,
        p.z + Math.cos(h) * 1.5
      );
      this.look.set(p.x + Math.sin(h) * 12, p.y + 1.4, p.z + Math.cos(h) * 12);
    }

    const lerp = mode === 2 ? 0.15 : 0.12;
    this.current.lerp(this.target, lerp);
    this.curLook.lerp(this.look, lerp);
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.curLook);
  }
}

export class InputState {
  constructor() {
    this.forward = false;
    this.back = false;
    this.left = false;
    this.right = false;
    this.brake = false;
    this.attach();
  }
  attach() {
    window.addEventListener('keydown', (e) => this.set(e.code, true));
    window.addEventListener('keyup', (e) => this.set(e.code, false));
  }
  set(code, v) {
    switch (code) {
      case 'KeyW': case 'ArrowUp':    this.forward = v; break;
      case 'KeyS': case 'ArrowDown':  this.back = v; break;
      case 'KeyA': case 'ArrowLeft':  this.left = v; break;
      case 'KeyD': case 'ArrowRight': this.right = v; break;
      case 'Space': this.brake = v; break;
    }
  }
}

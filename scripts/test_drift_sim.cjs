// Test 110 frames accel + 45 frames drift from X = 1.5
const dt = 1/60;

class VehicleSim {
  constructor() {
    this.x = 1.5;
    this.z = 0;
    this.yawAngle = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.yawRate = 0;
    this.steeringAngle = 0;
    this.speedScale = 0.75;
    this.config = {
      maxSpeed: 38.0,
      acceleration: 17.0,
      brakeForce: 28.0,
      steerSpeed: 3.8,
      maxSteerAngle: 0.58,
      steerReturnSpeed: 5.5,
      normalLateralGrip: 8.5,
      driftSlipGrip: 1.8,
      handbrakeGripMultiplier: 0.16,
      lateralDamping: 2.2,
      yawResponse: 4.8,
      yawDamping: 3.6,
      counterSteerAssist: 1.6,
      aerodynamicDrag: 0.002
    };
  }

  update(dt, input) {
    if (input.steerLeft) {
      this.steeringAngle = Math.max(-this.config.maxSteerAngle, this.steeringAngle - this.config.steerSpeed * dt);
    } else if (input.steerRight) {
      this.steeringAngle = Math.min(this.config.maxSteerAngle, this.steeringAngle + this.config.steerSpeed * dt);
    } else {
      if (this.steeringAngle > 0) this.steeringAngle = Math.max(0, this.steeringAngle - this.config.steerReturnSpeed * dt);
      else if (this.steeringAngle < 0) this.steeringAngle = Math.min(0, this.steeringAngle + this.config.steerReturnSpeed * dt);
    }

    if (input.forward) {
      if (this.forwardSpeed < this.config.maxSpeed) {
        const factor = Math.max(0.2, 1.0 - (this.forwardSpeed / this.config.maxSpeed) * 0.75);
        this.forwardSpeed += this.config.acceleration * factor * dt;
      }
    }
    const drag = this.config.aerodynamicDrag * this.forwardSpeed * Math.abs(this.forwardSpeed) * dt;
    this.forwardSpeed -= drag;

    if (input.handbrake && this.forwardSpeed > 0) {
      this.forwardSpeed = Math.max(0, this.forwardSpeed - (this.config.brakeForce * 0.38) * dt);
    }

    const centrifugal = this.yawRate * this.forwardSpeed;
    this.lateralSpeed -= centrifugal * dt;

    let grip = this.config.normalLateralGrip;
    if (input.handbrake) grip *= this.config.handbrakeGripMultiplier;
    else if (Math.abs(this.lateralSpeed) > 1.8) grip = Math.min(grip, this.config.driftSlipGrip);

    this.lateralSpeed -= this.lateralSpeed * grip * dt;
    this.lateralSpeed *= Math.max(0, 1.0 - this.config.lateralDamping * dt * 0.35);

    const turnAuth = Math.min(1.0, Math.abs(this.forwardSpeed) / 1.8);
    let steerTorque = this.steeringAngle * this.config.yawResponse * turnAuth;

    let driftOversteer = 0;
    if (input.handbrake) driftOversteer = -this.lateralSpeed * 0.22;
    else if (Math.abs(this.lateralSpeed) > 1.8) driftOversteer = -this.lateralSpeed * 0.10;

    const isCounterSteering =
      Math.sign(this.steeringAngle) !== 0 &&
      Math.abs(this.yawRate) > 0.35 &&
      Math.sign(this.steeringAngle) !== Math.sign(this.yawRate) &&
      Math.abs(this.lateralSpeed) > 1.0;

    if (isCounterSteering) {
      steerTorque *= this.config.counterSteerAssist;
      this.lateralSpeed *= Math.max(0, 1.0 - dt * 2.8);
    }

    const targetYaw = steerTorque + driftOversteer;
    this.yawRate += (targetYaw - this.yawRate) * 12.0 * dt;
    this.yawRate -= this.yawRate * this.config.yawDamping * dt;
    this.yawAngle += this.yawRate * dt;

    const fwdX = Math.sin(this.yawAngle);
    const fwdZ = Math.cos(this.yawAngle);
    const rightX = Math.cos(this.yawAngle);
    const rightZ = -Math.sin(this.yawAngle);

    const vx = fwdX * (this.forwardSpeed * this.speedScale) + rightX * (this.lateralSpeed * this.speedScale);
    const vz = fwdZ * (this.forwardSpeed * this.speedScale) + rightZ * (this.lateralSpeed * this.speedScale);

    this.x += vx * dt;
    this.z += vz * dt;
  }
}

const sim = new VehicleSim();
// Accel 110 frames (~1.8s)
for (let i = 0; i < 110; i++) {
  sim.update(dt, { forward: true, steerLeft: false, steerRight: false, handbrake: false });
}
console.log(`After 110 frames: Z=${sim.z.toFixed(1)}m, speed=${(sim.forwardSpeed*3.6).toFixed(1)} km/h`);

let pts = 0;
let driftTime = 0;
for (let i = 0; i < 50; i++) {
  const handbrake = i < 14;
  const steerLeft = i < 22;
  const steerRight = false;
  sim.update(dt, { forward: true, steerLeft, steerRight, handbrake });

  const speedKmh = Math.abs(sim.forwardSpeed) * 3.6;
  const slipAngleDeg = (Math.atan2(sim.lateralSpeed, Math.abs(sim.forwardSpeed) + 0.1) * 180) / Math.PI;
  const absSlip = Math.abs(slipAngleDeg);
  const isDrifting = Math.abs(sim.lateralSpeed) > 1.8 && Math.abs(sim.forwardSpeed) > 5.0;
  const validDrift = speedKmh >= 18.0 && (absSlip >= 6.0 || (isDrifting && absSlip >= 4.5)) && absSlip <= 62.0 && Math.abs(sim.yawRate) <= 3.2;

  if (validDrift) {
    driftTime += dt;
    const angleScale = Math.min(2.4, Math.max(0.4, (absSlip - 6.0) / 18.0 + 0.6));
    const speedScale = Math.min(2.2, Math.max(0.5, speedKmh / 36.0));
    pts += 280.0 * angleScale * speedScale * dt;
  }
  if (i % 10 === 0 || i === 49) {
    console.log(`frame ${i}: X=${sim.x.toFixed(2)}, Z=${sim.z.toFixed(1)}, speed=${speedKmh.toFixed(1)}, slip=${slipAngleDeg.toFixed(1)}, yawRate=${sim.yawRate.toFixed(2)}, isDrift=${validDrift}, pts=${Math.round(pts)}`);
  }
}

import { VehicleTelemetry } from '../vehicle/VehicleController';

export interface NetworkTelemetry {
  isHost: boolean;
  pingMs: number;
  racerCount: number;
  tick: number;
}

export class PhysicsDebugOverlay {
  private container: HTMLDivElement | null = null;
  private isVisible: boolean = false;

  // Cached DOM readout elements
  private elVehicle: HTMLElement | null = null;
  private elDrivetrain: HTMLElement | null = null;
  private elSpeed: HTMLElement | null = null;
  private elVelocity: HTMLElement | null = null;
  private elAccel: HTMLElement | null = null;
  private elGForce: HTMLElement | null = null;
  private elSlip: HTMLElement | null = null;
  private elGrip: HTMLElement | null = null;
  private elMass: HTMLElement | null = null;
  private elInputs: HTMLElement | null = null;
  private elNetRow: HTMLElement | null = null;
  private elNet: HTMLElement | null = null;

  constructor() {
    this.createDOM();
    this.setupKeyListeners();
  }

  private createDOM(): void {
    if (document.getElementById('physics-debug-overlay')) {
      this.container = document.getElementById('physics-debug-overlay') as HTMLDivElement;
      return;
    }

    const div = document.createElement('div');
    div.id = 'physics-debug-overlay';
    div.className = 'physics-debug-overlay';
    div.style.display = 'none';

    div.innerHTML = `
      <div class="pdo-header">
        <span class="pdo-title">PHYSICS TELEMETRY [F3]</span>
        <span id="pdo-status-badge" class="pdo-badge">ACTIVE</span>
      </div>
      <div class="pdo-grid">
        <div class="pdo-row"><span class="pdo-label">VEHICLE:</span> <span id="pdo-vehicle" class="pdo-val">--</span></div>
        <div class="pdo-row"><span class="pdo-label">DRIVETRAIN:</span> <span id="pdo-drivetrain" class="pdo-val">--</span></div>
        <div class="pdo-row"><span class="pdo-label">SPEED:</span> <span id="pdo-speed" class="pdo-val">--</span></div>
        <div class="pdo-row"><span class="pdo-label">VELOCITY (F/L):</span> <span id="pdo-velocity" class="pdo-val">--</span></div>
        <div class="pdo-row"><span class="pdo-label">ACCELERATION:</span> <span id="pdo-accel" class="pdo-val">--</span></div>
        <div class="pdo-row"><span class="pdo-label">G-FORCES:</span> <span id="pdo-gforce" class="pdo-val">--</span></div>
        <div class="pdo-row"><span class="pdo-label">SLIP ANGLE:</span> <span id="pdo-slip" class="pdo-val">--</span></div>
        <div class="pdo-row"><span class="pdo-label">TIRE & AERO GRIP:</span> <span id="pdo-grip" class="pdo-val">--</span></div>
        <div class="pdo-row"><span class="pdo-label">MASS & INERTIA:</span> <span id="pdo-mass" class="pdo-val">--</span></div>
        <div class="pdo-row"><span class="pdo-label">DRIVER INPUTS:</span> <span id="pdo-inputs" class="pdo-val">--</span></div>
        <div class="pdo-row" id="pdo-row-net" style="display: none;"><span class="pdo-label">LAN NETWORK:</span> <span id="pdo-net" class="pdo-val">--</span></div>
      </div>
    `;

    document.body.appendChild(div);
    this.container = div;

    this.elVehicle = document.getElementById('pdo-vehicle');
    this.elDrivetrain = document.getElementById('pdo-drivetrain');
    this.elSpeed = document.getElementById('pdo-speed');
    this.elVelocity = document.getElementById('pdo-velocity');
    this.elAccel = document.getElementById('pdo-accel');
    this.elGForce = document.getElementById('pdo-gforce');
    this.elSlip = document.getElementById('pdo-slip');
    this.elGrip = document.getElementById('pdo-grip');
    this.elMass = document.getElementById('pdo-mass');
    this.elInputs = document.getElementById('pdo-inputs');
    this.elNetRow = document.getElementById('pdo-row-net');
    this.elNet = document.getElementById('pdo-net');
  }

  private setupKeyListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Toggle on F3 or Backquote / Tilde (~)
      if (e.code === 'F3' || e.code === 'Backquote') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  public toggle(): boolean {
    this.isVisible = !this.isVisible;
    if (this.container) {
      this.container.style.display = this.isVisible ? 'block' : 'none';
    }
    return this.isVisible;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.container) {
      this.container.style.display = this.isVisible ? 'block' : 'none';
    }
  }

  public get active(): boolean {
    return this.isVisible;
  }

  public update(telemetry: VehicleTelemetry, netInfo?: NetworkTelemetry): void {
    if (!this.isVisible || !this.container) return;

    if (this.elNetRow && this.elNet) {
      if (netInfo) {
        this.elNetRow.style.display = 'flex';
        this.elNet.textContent = `${netInfo.isHost ? '👑 HOST' : 'CLIENT'} | PING: ${netInfo.pingMs}ms | RACERS: ${netInfo.racerCount} | TICK: ${netInfo.tick}`;
      } else {
        this.elNetRow.style.display = 'none';
      }
    }

    if (this.elVehicle) {
      this.elVehicle.textContent = `${telemetry.profileName || 'UNKNOWN'} (Tier ${telemetry.tier || 1})`;
    }

    if (this.elDrivetrain) {
      this.elDrivetrain.textContent = `${telemetry.drivetrain || 'RWD'} | Handling: ${telemetry.handlingRating || 50}/100`;
    }

    if (this.elSpeed) {
      this.elSpeed.textContent = `${telemetry.speedKmh} km/h (Gear: ${telemetry.gear} @ ${telemetry.engineRpm} RPM)`;
    }

    if (this.elVelocity) {
      this.elVelocity.textContent = `F: ${telemetry.forwardSpeed.toFixed(1)} m/s | L: ${telemetry.lateralSpeed.toFixed(1)} m/s`;
    }

    if (this.elAccel) {
      const fwdA = telemetry.forwardAcceleration || 0;
      this.elAccel.textContent = `${fwdA >= 0 ? '+' : ''}${fwdA.toFixed(2)} m/s²`;
    }

    if (this.elGForce) {
      const fwdG = ((telemetry.forwardAcceleration || 0) / 9.81).toFixed(2);
      const latG = ((telemetry.lateralAcceleration || 0) / 9.81).toFixed(2);
      this.elGForce.textContent = `Long: ${fwdG}G | Lat: ${latG}G`;
    }

    if (this.elSlip) {
      const isDrift = telemetry.isDrifting ? ' [DRIFT]' : '';
      this.elSlip.textContent = `${telemetry.slipAngleDeg.toFixed(1)}°${isDrift}`;
      this.elSlip.style.color = telemetry.isDrifting ? '#ff3b30' : '#4cd964';
    }

    if (this.elGrip) {
      const eff = telemetry.effectiveGrip?.toFixed(2) || '0.00';
      const base = telemetry.baseGrip?.toFixed(1) || '0.0';
      const aero = telemetry.aeroGripBonus ? `+${telemetry.aeroGripBonus.toFixed(1)} aero` : '+0.0';
      this.elGrip.textContent = `${eff} (${base} base, ${aero})`;
    }

    if (this.elMass) {
      const mass = telemetry.weightKg || 1350;
      const inertia = telemetry.rotationalInertia?.toFixed(2) || '1.00';
      const downforce = telemetry.downforceRating || 50;
      this.elMass.textContent = `${mass} kg | Inertia: ${inertia}x | DF: ${downforce}`;
    }

    if (this.elInputs) {
      const th = telemetry.throttleInput ? 'ON' : 'off';
      const br = telemetry.brakeInput ? 'ON' : 'off';
      const hb = telemetry.handbrakeInput ? 'PULL' : 'off';
      const st = telemetry.steeringAngleDeg.toFixed(1);
      this.elInputs.textContent = `THR: ${th} | BRK: ${br} | HB: ${hb} | STR: ${st}°`;
    }
  }

  public dispose(): void {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
      this.container = null;
    }
  }
}

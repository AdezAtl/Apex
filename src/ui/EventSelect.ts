import { RecordManager } from '../records/RecordManager';
import { RaceEventConfig } from '../events/EventConfig';
import { AIDifficulty } from '../ai/AIOpponent';
import { CircuitDefinition } from '../tracks/TrackConfig';
import { ALL_CIRCUITS, getCircuitById, DEFAULT_CIRCUIT_ID } from '../tracks/TrackRegistry';
import { getVehicleById } from '../vehicle/VehicleCatalog';
import { CareerManager } from '../career/CareerManager';

export interface EventSelectCallbacks {
  onStartEvent: (event: RaceEventConfig, difficulty: AIDifficulty, circuit: CircuitDefinition) => void;
  onOpenGarage?: () => void;
  onBack: () => void;
}

export class EventSelect {
  private container: HTMLElement | null = null;
  private callbacks: EventSelectCallbacks;
  private isVisible: boolean = false;
  private isNavigating: boolean = false;
  public selectedCircuitId: string = DEFAULT_CIRCUIT_ID;
  private selectedEventIndex: number = 0;
  private selectedDifficulty: AIDifficulty = 'normal';
  private difficultyCluster: HTMLElement | null = null;
  private diffButtons: HTMLButtonElement[] = [];

  // DOM Elements
  private circuitTabs: HTMLButtonElement[] = [];
  private tabElements: HTMLElement[] = [];
  private typeBadgeElement: HTMLElement | null = null;
  private lapsBadgeElement: HTMLElement | null = null;
  private eventNameElement: HTMLElement | null = null;
  private eventTrackNameElement: HTMLElement | null = null;
  private circuitMapContainer: HTMLElement | null = null;
  private eventDescElement: HTMLElement | null = null;
  private specLengthElement: HTMLElement | null = null;
  private specSectorsElement: HTMLElement | null = null;
  private specSurfaceElement: HTMLElement | null = null;
  private bestTimeElement: HTMLElement | null = null;
  private startButtonTextElement: HTMLElement | null = null;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(callbacks: EventSelectCallbacks) {
    this.callbacks = callbacks;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.createDOM();
  }

  public getSelectedCircuit(): CircuitDefinition {
    return getCircuitById(this.selectedCircuitId);
  }

  public getSelectedEvent(): RaceEventConfig {
    const circuit = this.getSelectedCircuit();
    return circuit.events[this.selectedEventIndex] || circuit.events[0];
  }

  public setSelectedCircuit(circuitId: string): void {
    if (this.selectedCircuitId !== circuitId) {
      this.selectedCircuitId = circuitId;
      const circuit = this.getSelectedCircuit();
      this.selectedEventIndex = Math.min(this.selectedEventIndex, circuit.events.length - 1);
      this.renderSelectedEvent();
    }
  }

  public setSelectedEvent(eventId: string): void {
    const circuit = this.getSelectedCircuit();
    const idx = circuit.events.findIndex((e) => e.id === eventId);
    if (idx !== -1 && idx !== this.selectedEventIndex) {
      this.selectedEventIndex = idx;
      this.renderSelectedEvent();
    }
  }

  private createDOM(): void {
    const existing = document.getElementById('event-select-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'event-select-overlay';
    this.container.className = 'menu-overlay hidden';

    const circuitTabButtonsHtml = ALL_CIRCUITS.map((circ, idx) => `
      <button id="track-tab-${circ.id}" class="circuit-tab ${circ.id === this.selectedCircuitId ? 'active' : ''}" data-track="${circ.id}">
        <div class="circuit-tab-left">
          <span class="circuit-tab-tag">CIRCUIT ${idx + 1}</span>
          <span class="circuit-tab-name">${circ.name}</span>
        </div>
        <span class="circuit-tab-meta">${circ.measuredLengthMeters}M • ${circ.checkpoints.length} GATES</span>
      </button>
    `).join('');

    this.container.innerHTML = `
      <div class="menu-card event-card-container arcade-modal">
        <div class="arcade-modal-header">
          <div class="panel-header">
            <span class="panel-badge">ARCADE MOTORSPORT // FREE PLAY</span>
            <h2 class="panel-title">SELECT CIRCUIT & EVENT</h2>
          </div>
          <div class="panel-header-nav">
            <button id="btn-event-back" class="apex-btn secondary-btn compact-btn" type="button">
              <span class="btn-text">← RETURN TO MENU</span>
            </button>
          </div>
        </div>

        <div class="arcade-modal-body">
          <!-- LEFT COLUMN: Track Selector & Circuit Telemetry -->
          <div class="arcade-col-track">
            <div class="arcade-section-label">01 // SELECT CIRCUIT</div>
            <div class="circuit-selector-bar" role="tablist">
              ${circuitTabButtonsHtml}
            </div>

            <div class="arcade-track-preview-box">
              <div class="arcade-track-map-header">
                <span class="track-map-title">CIRCUIT TELEMETRY // SECTOR OVERVIEW</span>
              </div>
              <div id="circuit-map-container" class="circuit-map-container" title="Circuit Layout">
                <!-- Injected via renderSelectedEvent -->
              </div>

              <div class="event-specs-grid">
                <div class="spec-item">
                  <span class="spec-label">LENGTH</span>
                  <span id="spec-length" class="spec-value">980 M</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">SECTORS</span>
                  <span id="spec-sectors" class="spec-value">10 GATES</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">SURFACE</span>
                  <span id="spec-surface" class="spec-value">ASPHALT</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">PERSONAL BEST</span>
                  <span id="event-select-best-time" class="spec-value highlight">--:--.--</span>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN: Event Mode, Settings & Launch -->
          <div class="arcade-col-event">
            <div class="arcade-section-label">02 // SELECT RACE MODE</div>
            <div class="event-tabs-bar" role="tablist">
              <button id="tab-event-0" class="event-tab active" role="tab" aria-selected="true" type="button">
                <span class="tab-badge">TIME ATTACK</span>
                <span id="tab-title-0" class="tab-title">Time Trial</span>
              </button>
              <button id="tab-event-1" class="event-tab" role="tab" aria-selected="false" type="button">
                <span class="tab-badge">SPRINT RACE</span>
                <span id="tab-title-1" class="tab-title">Sector Sprint</span>
              </button>
              <button id="tab-event-2" class="event-tab" role="tab" aria-selected="false" type="button">
                <span class="tab-badge">DRIFT CHALLENGE</span>
                <span id="tab-title-2" class="tab-title">Drift Arena</span>
              </button>
            </div>

            <div class="arcade-event-panel">
              <div class="event-card-header">
                <span id="event-type-badge" class="event-type-badge">TIME ATTACK</span>
                <span id="event-laps-badge" class="event-laps-badge">1 LAP BENCHMARK</span>
              </div>

              <h3 id="event-name" class="event-name">Apex Circuit Time Trial</h3>
              <div id="event-track-name" class="event-track-name">Forest Valley Circuit • 980m Grand Course</div>

              <p id="event-description" class="event-description">
                Complete a timed lap around the paved circuit with sequential timing gates.
              </p>

              <!-- AI Opponents Difficulty Selection Cluster -->
              <div id="ai-difficulty-cluster" class="ai-difficulty-cluster">
                <span class="difficulty-label">AI OPPONENTS (3 CARS) • GRID LEVEL</span>
                <div class="difficulty-toggle-group">
                  <button type="button" class="diff-btn" data-diff="easy">AMATEUR</button>
                  <button type="button" class="diff-btn active" data-diff="normal">PRO</button>
                  <button type="button" class="diff-btn" data-diff="hard">APEX ELITE</button>
                </div>
              </div>

              <!-- Active Vehicle Integration Bar -->
              <div class="event-selected-vehicle-bar">
                <div class="selected-veh-info">
                  <span class="veh-label">ACTIVE CHASSIS:</span>
                  <span id="event-select-vehicle-name" class="veh-name">--</span>
                  <span id="event-select-vehicle-specs" class="veh-specs">--</span>
                </div>
                <button id="btn-event-open-garage" class="apex-btn secondary-btn compact-btn" type="button">
                  <span class="btn-text">GARAGE / SWITCH</span>
                </button>
              </div>

              <div class="event-card-actions">
                <button id="btn-start-event" class="apex-btn primary-btn full-width" autofocus type="button">
                  <span id="btn-start-text" class="btn-text">START RACE</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="arcade-modal-footer">
          <div class="arcade-footer-hints">
            <span class="hint-item"><span class="keycap">ESC</span> RETURN</span>
            <span class="hint-item"><span class="keycap">ENTER</span> START</span>
            <span class="hint-item"><span class="keycap">←</span> <span class="keycap">→</span> SWITCH MODE</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.container);

    this.circuitTabs = Array.from(this.container.querySelectorAll<HTMLButtonElement>('.circuit-tab'));
    this.circuitTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const trackId = tab.getAttribute('data-track');
        if (trackId && trackId !== this.selectedCircuitId) {
          this.setSelectedCircuit(trackId);
        }
      });
    });

    this.tabElements = [
      document.getElementById('tab-event-0')!,
      document.getElementById('tab-event-1')!,
      document.getElementById('tab-event-2')!,
    ];
    this.typeBadgeElement = document.getElementById('event-type-badge');
    this.lapsBadgeElement = document.getElementById('event-laps-badge');
    this.eventNameElement = document.getElementById('event-name');
    this.eventTrackNameElement = document.getElementById('event-track-name');
    this.circuitMapContainer = document.getElementById('circuit-map-container');
    this.eventDescElement = document.getElementById('event-description');
    this.specLengthElement = document.getElementById('spec-length');
    this.specSectorsElement = document.getElementById('spec-sectors');
    this.specSurfaceElement = document.getElementById('spec-surface');
    this.bestTimeElement = document.getElementById('event-select-best-time');
    this.startButtonTextElement = document.getElementById('btn-start-text');
    this.difficultyCluster = document.getElementById('ai-difficulty-cluster');

    this.diffButtons = Array.from(this.container.querySelectorAll<HTMLButtonElement>('.diff-btn'));
    this.diffButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const diff = btn.getAttribute('data-diff') as AIDifficulty;
        if (diff) {
          this.selectedDifficulty = diff;
          this.diffButtons.forEach((b) => b.classList.toggle('active', b === btn));
        }
      });
    });

    this.tabElements.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        this.selectedEventIndex = index;
        this.renderSelectedEvent();
      });
    });

    document.getElementById('btn-event-open-garage')?.addEventListener('click', () => {
      this.triggerOpenGarage();
    });

    document.getElementById('btn-start-event')?.addEventListener('click', () => {
      this.triggerStartEvent();
    });

    document.getElementById('btn-event-back')?.addEventListener('click', () => {
      this.triggerBack();
    });

    this.renderSelectedEvent();
  }

  private triggerOpenGarage(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    if (this.callbacks.onOpenGarage) {
      this.callbacks.onOpenGarage();
    }
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private renderSelectedEvent(): void {
    const circuit = this.getSelectedCircuit();
    const event = this.getSelectedEvent();

    // Update track tab active states
    this.circuitTabs.forEach((tab) => {
      const isCircActive = tab.getAttribute('data-track') === this.selectedCircuitId;
      tab.classList.toggle('active', isCircActive);
    });

    // Update event mode tab titles based on active circuit
    const tab0Title = document.getElementById('tab-title-0');
    const tab1Title = document.getElementById('tab-title-1');
    const tab2Title = document.getElementById('tab-title-2');
    if (tab0Title && circuit.events[0]) tab0Title.textContent = circuit.events[0].name.replace(' Circuit', '');
    if (tab1Title && circuit.events[1]) tab1Title.textContent = circuit.events[1].name.replace(' Sector', '');
    if (tab2Title && circuit.events[2]) tab2Title.textContent = circuit.events[2].name.replace(' Challenge', '');

    // Update tab active states
    this.tabElements.forEach((tab, index) => {
      const isActive = index === this.selectedEventIndex;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (this.typeBadgeElement) this.typeBadgeElement.textContent = event.badgeText;
    if (this.lapsBadgeElement) this.lapsBadgeElement.textContent = event.lapsBadge;
    if (this.eventNameElement) this.eventNameElement.textContent = event.name;
    if (this.eventTrackNameElement) this.eventTrackNameElement.textContent = event.subtitle;
    if (this.eventDescElement) this.eventDescElement.textContent = event.description;
    if (this.specLengthElement) this.specLengthElement.textContent = event.specs.length;
    if (this.specSectorsElement) this.specSectorsElement.textContent = event.specs.sectors;
    if (this.specSurfaceElement) this.specSurfaceElement.textContent = event.specs.surface;

    if (this.startButtonTextElement) {
      if (event.mode === 'drift') {
        this.startButtonTextElement.textContent = 'START DRIFT CHALLENGE';
      } else if (event.mode === 'sprint') {
        this.startButtonTextElement.textContent = 'START SPRINT RACE';
      } else {
        this.startButtonTextElement.textContent = 'START RACE';
      }
    }

    // Dynamic Circuit Minimap rendering
    if (this.circuitMapContainer) {
      const mm = circuit.minimap;
      const fullPath = mm.fullCircuitSvgPath;
      const sf = mm.startFinishMarker;

      if (event.mapType === 'drift') {
        // Drift Challenge Minimap: Highlights Drift Sweeper Zones in gold/amber
        const driftZonesHtml = mm.driftZones.map((z) => `
          <path d="${z.path}" fill="none" stroke="rgba(245, 158, 11, 0.25)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
          <path d="${z.path}" fill="none" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          <text x="${z.labelPos.x}" y="${z.labelPos.y}" fill="#f59e0b" font-size="4.5" font-weight="800" font-family="sans-serif" text-anchor="middle">${z.label}</text>
        `).join('');

        this.circuitMapContainer.innerHTML = `
          <svg class="circuit-svg" viewBox="${mm.svgViewBox}" xmlns="http://www.w3.org/2000/svg">
            <path d="${fullPath}" fill="none" stroke="#161f2e" stroke-width="6" stroke-linejoin="round" />
            ${driftZonesHtml}
            <line x1="${sf.x - 5}" y1="${sf.y}" x2="${sf.x + 5}" y2="${sf.y}" stroke="#f59e0b" stroke-width="3.5" />
            <circle cx="${sf.x}" cy="${sf.y}" r="2.5" fill="#ffffff" />
            <text x="${sf.labelPos.x}" y="${sf.labelPos.y}" fill="#f59e0b" font-size="5" font-weight="900" font-family="sans-serif" text-anchor="end">START</text>
          </svg>
        `;
      } else if (event.mapType === 'sprint') {
        // Point-to-Point Sprint Minimap
        const sprintPath = mm.sprintSvgPath;
        const spStart = mm.sprintStart;
        const spFinish = mm.sprintFinish;

        this.circuitMapContainer.innerHTML = `
          <svg class="circuit-svg" viewBox="${mm.svgViewBox}" xmlns="http://www.w3.org/2000/svg">
            <path d="${fullPath}" fill="none" stroke="#121822" stroke-width="6" stroke-linejoin="round" />
            <path d="${sprintPath}" fill="none" stroke="rgba(0, 229, 255, 0.25)" stroke-width="12" stroke-linejoin="round" stroke-linecap="round" />
            <path d="${sprintPath}" fill="none" stroke="#00e5ff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />
            <path d="${sprintPath}" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-dasharray="3,3" stroke-linejoin="round" stroke-linecap="round" />
            <line x1="${spStart.x - 5}" y1="${spStart.y}" x2="${spStart.x + 5}" y2="${spStart.y}" stroke="#00e5ff" stroke-width="3.5" />
            <circle cx="${spStart.x}" cy="${spStart.y}" r="2.5" fill="#ffffff" />
            <text x="${spStart.x - 8}" y="${spStart.y + 3}" fill="#00e5ff" font-size="5" font-weight="900" font-family="sans-serif" text-anchor="end">START</text>
            <line x1="${spFinish.x - 5}" y1="${spFinish.y}" x2="${spFinish.x + 5}" y2="${spFinish.y}" stroke="#e10600" stroke-width="3.5" />
            <circle cx="${spFinish.x}" cy="${spFinish.y}" r="3.0" fill="#e10600" />
            <text x="${spFinish.x + 8}" y="${spFinish.y + 2}" fill="#e10600" font-size="5" font-weight="900" font-family="sans-serif">FINISH</text>
          </svg>
        `;
      } else {
        // Full Closed Loop Time Trial
        const gatesHtml = mm.gateMarkers.map((g) => `
          <circle cx="${g.x}" cy="${g.y}" r="2.0" fill="#00d2ff" />
        `).join('');

        this.circuitMapContainer.innerHTML = `
          <svg class="circuit-svg" viewBox="${mm.svgViewBox}" xmlns="http://www.w3.org/2000/svg">
            <path d="${fullPath}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12" stroke-linejoin="round" />
            <path d="${fullPath}" fill="none" stroke="#182030" stroke-width="6" stroke-linejoin="round" />
            <path d="${fullPath}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.2" stroke-dasharray="3,3" stroke-linejoin="round" />
            <line x1="${sf.x - 5}" y1="${sf.y}" x2="${sf.x + 5}" y2="${sf.y}" stroke="#e10600" stroke-width="3.5" />
            <circle cx="${sf.x}" cy="${sf.y}" r="2.5" fill="#ffffff" />
            <text x="${sf.labelPos.x}" y="${sf.labelPos.y}" fill="#e10600" font-size="5" font-weight="900" font-family="sans-serif" text-anchor="end">S/F</text>
            ${gatesHtml}
          </svg>
        `;
      }
    }

    this.updateBestTime();

    if (this.difficultyCluster) {
      if (event.mode === 'drift') {
        this.difficultyCluster.style.display = 'none';
      } else {
        this.difficultyCluster.style.display = '';
      }
    }
  }

  private triggerStartEvent(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onStartEvent(
      this.getSelectedEvent(),
      this.selectedDifficulty,
      this.getSelectedCircuit()
    );
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerBack(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onBack();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      this.triggerStartEvent();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      this.triggerBack();
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
      e.preventDefault();
      const circuit = this.getSelectedCircuit();
      this.selectedEventIndex = (this.selectedEventIndex - 1 + circuit.events.length) % circuit.events.length;
      this.renderSelectedEvent();
    } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
      e.preventDefault();
      const circuit = this.getSelectedCircuit();
      this.selectedEventIndex = (this.selectedEventIndex + 1) % circuit.events.length;
      this.renderSelectedEvent();
    }
  }

  public show(): void {
    if (!this.container) return;
    this.isVisible = true;
    this.isNavigating = false;
    this.renderSelectedEvent();
    this.updateSelectedVehicle();
    this.container.classList.remove('hidden');
    window.addEventListener('keydown', this.boundKeyDown);

    const btnStart = document.getElementById('btn-start-event');
    btnStart?.focus();
  }

  public updateSelectedVehicle(): void {
    const cm = CareerManager.getInstance();
    const vehId = cm.getSelectedVehicleId();
    const v = getVehicleById(vehId);
    if (!v) return;
    const effective = cm.getEffectiveVehicleSpecs(v.id) || v.specs;
    const nameEl = document.getElementById('event-select-vehicle-name');
    const specsEl = document.getElementById('event-select-vehicle-specs');
    if (nameEl) nameEl.textContent = v.name;
    if (specsEl) specsEl.textContent = `T${v.tier} ${v.tier === 5 ? 'PINNACLE' : v.tier === 4 ? 'HYPER' : v.tier === 3 ? 'PRO' : v.tier === 2 ? 'SPORT' : 'STREET'} • ${effective.topSpeedKmH} KM/H • ${v.specs.drivetrain}`;
  }

  public hide(): void {
    if (!this.container) return;
    this.isVisible = false;
    this.container.classList.add('hidden');
    window.removeEventListener('keydown', this.boundKeyDown);
  }

  public updateBestTime(): void {
    if (this.bestTimeElement) {
      const event = this.getSelectedEvent();
      if (event.mode === 'drift') {
        const best = RecordManager.getBestScore(event.id);
        this.bestTimeElement.textContent = RecordManager.formatScore(best);
      } else {
        const best = RecordManager.getBestTime(event.id);
        this.bestTimeElement.textContent = RecordManager.formatTime(best);
      }
    }
  }

  public getIsOpen(): boolean {
    return this.isVisible;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    this.container?.remove();
    this.container = null;
  }
}

/**
 * Project Apex — MultiplayerLobbyUI
 * Interactive interface for hosting and joining LAN races with car selection,
 * room options, player slots, readiness tracking, and IP connection guides.
 */

import { RoomConfig, LobbyPlayer, ServerInfo } from './MultiplayerTypes';
import { VEHICLE_CATALOG } from '../vehicle/VehicleCatalog';

export interface MultiplayerLobbyCallbacks {
  onHost: (
    roomConfig: Partial<RoomConfig>,
    player: { name: string; vehicleId: string; vehicleName: string; paintId: string },
    hostAddress: string
  ) => Promise<void>;
  onJoin: (
    hostAddress: string,
    player: { name: string; vehicleId: string; vehicleName: string; paintId: string }
  ) => Promise<void>;
  onUpdateConfig: (config: Partial<RoomConfig>) => void;
  onUpdatePlayer: (info: { vehicleId?: string; vehicleName?: string; paintId?: string }) => void;
  onToggleReady: (isReady: boolean) => void;
  onStartRace: () => void;
  onLeave: () => void;
}

export class MultiplayerLobbyUI {
  private container: HTMLElement | null = null;
  private callbacks: MultiplayerLobbyCallbacks;
  private isVisible: boolean = false;

  private currentView: 'entry' | 'lobby' = 'entry';
  private entryMode: 'host' | 'join' = 'host';

  private hostRoomConfig: Partial<RoomConfig> = {
    trackId: 'forest_valley',
    trackName: 'Forest Valley Circuit',
    raceMode: 'circuit',
    maxPlayers: 4,
    fillWithAI: true,
    lapCount: 1,
  };

  private selectedVehicleId: string = 'apex_sport_coupe';
  private selectedPaintId: string = 'deep_blue';
  private playerName: string = 'Driver 1';
  private hostAddress: string = 'localhost:5050';

  private activeRoomConfig: RoomConfig | null = null;
  private activePlayers: LobbyPlayer[] = [];
  private serverInfo: ServerInfo | null = null;
  private isLocalHost: boolean = false;
  private isLocalReady: boolean = false;
  private selfPlayerId: string | null = null;

  private statusMessage: string = '';
  private statusType: 'info' | 'error' | 'success' = 'info';

  constructor(callbacks: MultiplayerLobbyCallbacks) {
    this.callbacks = callbacks;
    this.playerName = `Driver_${Math.floor(100 + Math.random() * 900)}`;
    this.createDOM();
  }

  public show(): void {
    this.isVisible = true;
    this.currentView = 'entry';
    this.statusMessage = '';
    this.render();
    if (this.container) {
      this.container.classList.remove('hidden');
    }
  }

  public hide(): void {
    this.isVisible = false;
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  public getIsOpen(): boolean {
    return this.isVisible;
  }

  public setInLobby(
    config: RoomConfig,
    players: LobbyPlayer[],
    selfId: string,
    isHost: boolean,
    serverInfo?: ServerInfo
  ): void {
    this.currentView = 'lobby';
    this.activeRoomConfig = config;
    this.activePlayers = players;
    this.selfPlayerId = selfId;
    this.isLocalHost = isHost;
    if (serverInfo) this.serverInfo = serverInfo;

    const me = players.find(p => p.id === selfId);
    this.isLocalReady = me ? me.isReady : false;

    this.render();
  }

  public updateLobbyState(config: RoomConfig, players: LobbyPlayer[]): void {
    this.activeRoomConfig = config;
    this.activePlayers = players;

    const me = players.find(p => p.id === this.selfPlayerId);
    if (me) {
      this.isLocalReady = me.isReady;
    }

    if (this.currentView === 'lobby') {
      this.render();
    }
  }

  public setStatus(msg: string, type: 'info' | 'error' | 'success' = 'info'): void {
    this.statusMessage = msg;
    this.statusType = type;
    const banner = document.getElementById('mp-status-banner');
    if (banner) {
      banner.textContent = msg;
      banner.className = `mp-status-banner ${type}`;
      banner.style.display = msg ? 'block' : 'none';
    }
  }

  private createDOM(): void {
    const existing = document.getElementById('multiplayer-lobby-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'multiplayer-lobby-overlay';
    this.container.className = 'menu-overlay hidden';
    document.getElementById('ui-overlay')?.appendChild(this.container);
  }

  private render(): void {
    if (!this.container) return;

    if (this.currentView === 'entry') {
      this.renderEntryView();
    } else {
      this.renderLobbyView();
    }
  }

  private renderEntryView(): void {
    if (!this.container) return;

    const cars = VEHICLE_CATALOG.slice(0, 8); // Top available vehicles
    const selectedCar = VEHICLE_CATALOG.find(c => c.id === this.selectedVehicleId) || VEHICLE_CATALOG[0];

    this.container.innerHTML = `
      <div class="menu-card mp-card">
        <div class="panel-header text-center">
          <span class="panel-badge cyan-badge">LOCAL NETWORK MULTIPLAYER // LAN ENGINE</span>
          <h2 class="panel-title large-title">APEX LAN MULTIPLAYER</h2>
          <span class="event-subtitle">Zero-Latency Local Network Racing • Up to 4 Drivers</span>
        </div>

        <div id="mp-status-banner" class="mp-status-banner ${this.statusType}" style="display: ${this.statusMessage ? 'block' : 'none'};">
          ${this.statusMessage}
        </div>

        <div class="mp-tabs-bar">
          <button id="btn-tab-host" class="mp-tab ${this.entryMode === 'host' ? 'active' : ''}">HOST A RACE</button>
          <button id="btn-tab-join" class="mp-tab ${this.entryMode === 'join' ? 'active' : ''}">JOIN A RACE</button>
        </div>

        <div class="mp-entry-body">
          <div class="mp-field-group">
            <label class="mp-field-label">DRIVER DISPLAY NAME</label>
            <input id="input-mp-name" class="mp-input" type="text" maxlength="18" value="${this.playerName}" placeholder="Enter driver callsign..." />
          </div>

          <div class="mp-field-group">
            <label class="mp-field-label">SELECT RACING CHASSIS</label>
            <select id="select-mp-car" class="mp-select">
              ${cars
                .map(
                  c => `
                <option value="${c.id}" ${c.id === this.selectedVehicleId ? 'selected' : ''}>
                  ${c.name} [${c.category}]
                </option>
              `
                )
                .join('')}
            </select>
            <div class="mp-car-preview-spec">
              <span>Top Speed: ${selectedCar.specs.topSpeedKmH} km/h</span>
              <span>• Power: ${selectedCar.specs.powerHp} HP</span>
              <span>• Drivetrain: ${selectedCar.specs.drivetrain}</span>
            </div>
          </div>

          ${
            this.entryMode === 'host'
              ? `
            <div class="mp-field-group">
              <label class="mp-field-label">CIRCUIT TRACK</label>
              <select id="select-host-track" class="mp-select">
                <option value="forest_valley" ${this.hostRoomConfig.trackId === 'forest_valley' ? 'selected' : ''}>
                  Forest Valley Circuit (980m Grand Course • 13m Road)
                </option>
                <option value="azure_coast" ${this.hostRoomConfig.trackId === 'azure_coast' ? 'selected' : ''}>
                  Azure Coast Circuit (940m Ocean Sweepers)
                </option>
              </select>
            </div>

            <div class="mp-grid-row">
              <div class="mp-field-group half">
                <label class="mp-field-label">RACE MODE</label>
                <select id="select-host-mode" class="mp-select">
                  <option value="circuit" ${this.hostRoomConfig.raceMode === 'circuit' ? 'selected' : ''}>Circuit Lap Race</option>
                  <option value="sprint" ${this.hostRoomConfig.raceMode === 'sprint' ? 'selected' : ''}>Sector Sprint (340m)</option>
                </select>
              </div>
              <div class="mp-field-group half">
                <label class="mp-field-label">MAX PLAYERS</label>
                <select id="select-host-max-players" class="mp-select">
                  <option value="2" ${this.hostRoomConfig.maxPlayers === 2 ? 'selected' : ''}>2 Drivers</option>
                  <option value="3" ${this.hostRoomConfig.maxPlayers === 3 ? 'selected' : ''}>3 Drivers</option>
                  <option value="4" ${this.hostRoomConfig.maxPlayers === 4 ? 'selected' : ''}>4 Drivers (Full Grid)</option>
                </select>
              </div>
            </div>

            <div class="mp-checkbox-group">
              <label class="mp-checkbox-label">
                <input id="check-host-ai" type="checkbox" ${this.hostRoomConfig.fillWithAI ? 'checked' : ''} />
                <span>Fill available empty slots with competitive AI opponents</span>
              </label>
            </div>

            <div class="mp-field-group">
              <label class="mp-field-label">SERVER PORT / BINDING</label>
              <input id="input-host-addr" class="mp-input" type="text" value="localhost:5050" placeholder="localhost:5050" />
              <span class="mp-hint">Local host binding. Requires LAN server running on port 5050 (run 'npm run server' or 'node scripts/lan_server.cjs' in terminal).</span>
            </div>
          `
              : `
            <div class="mp-field-group">
              <label class="mp-field-label">HOST LAN IP ADDRESS & PORT</label>
              <input id="input-join-addr" class="mp-input" type="text" value="${this.hostAddress}" placeholder="e.g. 192.168.1.105:5050" />
              <span class="mp-hint">Enter the host computer's local IP address displayed on their lobby screen.</span>
            </div>
          `
          }
        </div>

        <div class="mp-actions-footer">
          <button id="btn-mp-back" class="apex-btn secondary-btn">BACK TO MENU</button>
          <button id="btn-mp-primary-action" class="apex-btn cyan-btn">
            ${this.entryMode === 'host' ? 'CREATE LAN ROOM' : 'CONNECT TO HOST'}
          </button>
        </div>
      </div>
    `;

    this.bindEntryEvents();
  }

  private bindEntryEvents(): void {
    const tabHost = document.getElementById('btn-tab-host');
    const tabJoin = document.getElementById('btn-tab-join');
    const inputName = document.getElementById('input-mp-name') as HTMLInputElement;
    const selectCar = document.getElementById('select-mp-car') as HTMLSelectElement;
    const btnBack = document.getElementById('btn-mp-back');
    const btnAction = document.getElementById('btn-mp-primary-action');

    tabHost?.addEventListener('click', () => {
      this.entryMode = 'host';
      this.render();
    });

    tabJoin?.addEventListener('click', () => {
      this.entryMode = 'join';
      this.render();
    });

    inputName?.addEventListener('input', () => {
      this.playerName = inputName.value;
    });

    selectCar?.addEventListener('change', () => {
      this.selectedVehicleId = selectCar.value;
      const c = VEHICLE_CATALOG.find(x => x.id === this.selectedVehicleId);
      if (c) {
        this.selectedPaintId = 'racing_red';
      }
      this.render();
    });

    btnBack?.addEventListener('click', () => {
      this.callbacks.onLeave();
    });

    btnAction?.addEventListener('click', async () => {
      const selectedCar = VEHICLE_CATALOG.find(c => c.id === this.selectedVehicleId) || VEHICLE_CATALOG[0];
      const playerInfo = {
        name: this.playerName.trim() || 'Driver 1',
        vehicleId: this.selectedVehicleId,
        vehicleName: selectedCar.name,
        paintId: this.selectedPaintId,
      };

      if (this.entryMode === 'host') {
        const trackSelect = document.getElementById('select-host-track') as HTMLSelectElement;
        const modeSelect = document.getElementById('select-host-mode') as HTMLSelectElement;
        const maxSelect = document.getElementById('select-host-max-players') as HTMLSelectElement;
        const aiCheck = document.getElementById('check-host-ai') as HTMLInputElement;
        const addrInput = document.getElementById('input-host-addr') as HTMLInputElement;

        const roomConfig: Partial<RoomConfig> = {
          trackId: trackSelect?.value || 'forest_valley',
          trackName: trackSelect?.value === 'azure_coast' ? 'Azure Coast Circuit' : 'Forest Valley Circuit',
          raceMode: (modeSelect?.value as any) || 'circuit',
          maxPlayers: parseInt(maxSelect?.value || '4', 10),
          fillWithAI: aiCheck ? aiCheck.checked : true,
          lapCount: 1,
        };

        const hostAddr = addrInput?.value.trim() || 'localhost:5050';
        this.setStatus('Starting LAN room on ' + hostAddr + '...', 'info');
        await this.callbacks.onHost(roomConfig, playerInfo, hostAddr);
      } else {
        const joinAddrInput = document.getElementById('input-join-addr') as HTMLInputElement;
        const hostAddr = joinAddrInput?.value.trim() || 'localhost:5050';
        this.hostAddress = hostAddr;
        this.setStatus('Connecting to host at ' + hostAddr + '...', 'info');
        await this.callbacks.onJoin(hostAddr, playerInfo);
      }
    });
  }

  private renderLobbyView(): void {
    if (!this.container || !this.activeRoomConfig) return;

    const cfg = this.activeRoomConfig;
    const players = this.activePlayers;
    const maxSlots = cfg.maxPlayers || 4;

    const hostIp = this.serverInfo ? `${this.serverInfo.localIp}:${this.serverInfo.port}` : 'localhost:5050';
    const allHumansReady = players.every(p => p.isHost || p.isReady);
    const canStart = this.isLocalHost && players.length >= 1 && allHumansReady;

    this.container.innerHTML = `
      <div class="menu-card mp-card mp-lobby-card">
        <div class="panel-header text-center">
          <span class="panel-badge gold-badge">LAN RACE LOBBY // ${cfg.roomId}</span>
          <h2 class="panel-title large-title">${cfg.trackName.toUpperCase()}</h2>
          <span class="event-subtitle">${cfg.raceMode.toUpperCase()} RACE • ${cfg.lapCount} LAP • ${players.length}/${maxSlots} DRIVERS</span>
        </div>

        <div class="mp-ip-banner">
          <div class="mp-ip-col">
            <span class="mp-ip-label">SHARE HOST LAN IP WITH FRIENDS:</span>
            <span class="mp-ip-val">${hostIp}</span>
          </div>
          <div class="mp-status-pill ${this.isLocalHost ? 'host-pill' : 'client-pill'}">
            ${this.isLocalHost ? '👑 ROOM HOST' : 'CONNECTED CLIENT'}
          </div>
        </div>

        <div id="mp-status-banner" class="mp-status-banner ${this.statusType}" style="display: ${this.statusMessage ? 'block' : 'none'};">
          ${this.statusMessage}
        </div>

        <div class="mp-lobby-content">
          <div class="mp-players-grid">
            ${[1, 2, 3, 4]
              .map(slotNum => {
                if (slotNum > maxSlots) return '';
                const p = players.find(x => x.gridSlot === slotNum);
                if (p) {
                  return `
                    <div class="mp-player-card filled ${p.id === this.selfPlayerId ? 'self-card' : ''}">
                      <div class="slot-badge">GRID P${slotNum}</div>
                      <div class="player-info-row">
                        <span class="player-name">${p.name} ${p.isHost ? '<span class="crown-badge">👑 HOST</span>' : ''}</span>
                        <span class="player-ping">${p.pingMs > 0 ? `${p.pingMs}ms` : 'LAN'}</span>
                      </div>
                      <div class="player-car-row">
                        <span class="car-title">${p.vehicleName}</span>
                      </div>
                      <div class="ready-badge-row">
                        <span class="ready-tag ${p.isReady ? 'is-ready' : 'not-ready'}">
                          ${p.isHost ? 'READY (HOST)' : p.isReady ? '✓ READY' : 'WAITING...'}
                        </span>
                      </div>
                    </div>
                  `;
                } else if (cfg.fillWithAI) {
                  return `
                    <div class="mp-player-card ai-slot">
                      <div class="slot-badge">GRID P${slotNum}</div>
                      <div class="player-info-row">
                        <span class="player-name ai-name">AI OPPONENT</span>
                      </div>
                      <div class="player-car-row">
                        <span class="car-title">Competitive APX Fleet</span>
                      </div>
                      <div class="ready-badge-row">
                        <span class="ready-tag is-ready">AUTO-READY</span>
                      </div>
                    </div>
                  `;
                } else {
                  return `
                    <div class="mp-player-card open-slot">
                      <div class="slot-badge">GRID P${slotNum}</div>
                      <span class="open-slot-text">OPEN SLOT (WAITING...)</span>
                    </div>
                  `;
                }
              })
              .join('')}
          </div>

          ${
            this.isLocalHost
              ? `
            <div class="mp-host-controls-panel">
              <span class="panel-section-title">HOST CONTROLS & RACE CONFIGURATION</span>
              <div class="host-controls-grid">
                <div class="control-col">
                  <label>TRACK</label>
                  <select id="lobby-select-track" class="mp-select small">
                    <option value="forest_valley" ${cfg.trackId === 'forest_valley' ? 'selected' : ''}>Forest Valley Circuit (980m)</option>
                    <option value="azure_coast" ${cfg.trackId === 'azure_coast' ? 'selected' : ''}>Azure Coast Circuit (940m)</option>
                  </select>
                </div>
                <div class="control-col">
                  <label>MODE</label>
                  <select id="lobby-select-mode" class="mp-select small">
                    <option value="circuit" ${cfg.raceMode === 'circuit' ? 'selected' : ''}>Circuit Lap</option>
                    <option value="sprint" ${cfg.raceMode === 'sprint' ? 'selected' : ''}>Sector Sprint</option>
                  </select>
                </div>
                <div class="control-col checkbox-col">
                  <label class="mp-checkbox-label">
                    <input id="lobby-check-ai" type="checkbox" ${cfg.fillWithAI ? 'checked' : ''} />
                    <span>Fill Slots with AI</span>
                  </label>
                </div>
              </div>
            </div>
          `
              : ''
          }
        </div>

        <div class="mp-actions-footer">
          <button id="btn-lobby-leave" class="apex-btn secondary-btn">LEAVE LOBBY</button>
          ${
            !this.isLocalHost
              ? `
            <button id="btn-lobby-ready" class="apex-btn ${this.isLocalReady ? 'secondary-btn' : 'primary-btn'}">
              ${this.isLocalReady ? 'CANCEL READY' : 'I AM READY!'}
            </button>
          `
              : `
            <button id="btn-lobby-start" class="apex-btn cyan-btn" ${canStart ? '' : 'disabled'}>
              ${canStart ? '🚀 LAUNCH RACE' : 'WAITING FOR PLAYERS...'}
            </button>
          `
          }
        </div>
      </div>
    `;

    this.bindLobbyEvents();
  }

  private bindLobbyEvents(): void {
    const btnLeave = document.getElementById('btn-lobby-leave');
    const btnReady = document.getElementById('btn-lobby-ready');
    const btnStart = document.getElementById('btn-lobby-start');

    const selectTrack = document.getElementById('lobby-select-track') as HTMLSelectElement;
    const selectMode = document.getElementById('lobby-select-mode') as HTMLSelectElement;
    const checkAI = document.getElementById('lobby-check-ai') as HTMLInputElement;

    btnLeave?.addEventListener('click', () => {
      this.callbacks.onLeave();
    });

    btnReady?.addEventListener('click', () => {
      this.isLocalReady = !this.isLocalReady;
      this.callbacks.onToggleReady(this.isLocalReady);
      this.render();
    });

    btnStart?.addEventListener('click', () => {
      this.setStatus('Launching synchronized countdown for all players...', 'info');
      this.callbacks.onStartRace();
    });

    selectTrack?.addEventListener('change', () => {
      this.callbacks.onUpdateConfig({
        trackId: selectTrack.value,
        trackName: selectTrack.value === 'azure_coast' ? 'Azure Coast Circuit' : 'Forest Valley Circuit',
      });
    });

    selectMode?.addEventListener('change', () => {
      this.callbacks.onUpdateConfig({
        raceMode: selectMode.value as any,
      });
    });

    checkAI?.addEventListener('change', () => {
      this.callbacks.onUpdateConfig({
        fillWithAI: checkAI.checked,
      });
    });
  }
}

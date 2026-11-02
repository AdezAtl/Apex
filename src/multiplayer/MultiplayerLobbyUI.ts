/**
 * Project Apex — MultiplayerLobbyUI
 * Interactive interface for hosting and joining races via:
 * 1. Online Peer-to-Peer WebRTC rooms (zero setup, works on Vercel HTTPS, mobile, and web)
 * 2. Local LAN WebSocket server (port 5050)
 */

import { RoomConfig, LobbyPlayer, ServerInfo } from './MultiplayerTypes';
import { VEHICLE_CATALOG } from '../vehicle/VehicleCatalog';

export interface MultiplayerLobbyCallbacks {
  onHost: (
    roomConfig: Partial<RoomConfig>,
    player: { name: string; vehicleId: string; vehicleName: string; paintId: string },
    hostAddress: string,
    isP2P?: boolean
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
  private connectionType: 'p2p' | 'lan' = 'p2p';

  private hostRoomConfig: Partial<RoomConfig> = {
    trackId: 'forest_valley',
    trackName: 'Forest Valley Circuit',
    raceMode: 'circuit',
    maxPlayers: 4,
    fillWithAI: true,
    lapCount: 1,
  };

  private selectedVehicleId: string = 'mercedes_slc';
  private selectedPaintId: string = 'deep_blue';
  private playerName: string = 'Driver 1';
  private hostAddress: string = `${typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost'}:5050`;
  private p2pRoomCode: string = `APX-${Math.floor(1000 + Math.random() * 9000)}`;
  private joinRoomCode: string = '';

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

    // Default to P2P online on HTTPS (e.g. Vercel)
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      this.connectionType = isHttps ? 'p2p' : 'p2p';

      // Check URL query parameters for invite link (e.g. ?room=APX-5921)
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room') || params.get('join');
      if (roomParam) {
        this.joinRoomCode = roomParam.trim().toUpperCase();
        this.entryMode = 'join';
        this.connectionType = 'p2p';
      }
    }

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

    const me = players.find((p) => p.id === selfId);
    this.isLocalReady = me ? me.isReady : false;

    this.render();
  }

  public updateLobbyState(config: RoomConfig, players: LobbyPlayer[]): void {
    this.activeRoomConfig = config;
    this.activePlayers = players;

    const me = players.find((p) => p.id === this.selfPlayerId);
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

    const cars = VEHICLE_CATALOG;
    const selectedCar = VEHICLE_CATALOG.find((c) => c.id === this.selectedVehicleId) || VEHICLE_CATALOG[0];

    this.container.innerHTML = `
      <div class="menu-card mp-card">
        <div class="panel-header text-center">
          <span class="panel-badge cyan-badge">MULTIPLAYER RACING // ZERO-SETUP ONLINE & LAN</span>
          <h2 class="panel-title large-title">PROJECT APEX MULTIPLAYER</h2>
          <span class="event-subtitle">Cross-Platform Real-Time Racing • Up to 4 Drivers</span>
        </div>

        <!-- Connection Type Selector: Online P2P vs Local LAN -->
        <div class="mp-conn-type-bar" role="tablist">
          <button id="btn-conn-p2p" class="mp-conn-type-btn ${this.connectionType === 'p2p' ? 'active' : ''}">
            🌐 ONLINE ROOM (ROOM CODE)
          </button>
          <button id="btn-conn-lan" class="mp-conn-type-btn ${this.connectionType === 'lan' ? 'active' : ''}">
            🔌 LOCAL LAN SERVER
          </button>
        </div>

        <div id="mp-status-banner" class="mp-status-banner ${this.statusType}" style="display: ${this.statusMessage ? 'block' : 'none'};">
          ${this.statusMessage}
        </div>

        <!-- Mode Tabs: Host vs Join -->
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
                  (c) => `
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

            ${
              this.connectionType === 'p2p'
                ? `
              <div class="mp-field-group">
                <label class="mp-field-label">ROOM CODE (SHARE WITH OTHER RACERS)</label>
                <div class="mp-room-code-display">
                  <input id="input-p2p-code" class="mp-input room-code-input" type="text" maxlength="12" value="${this.p2pRoomCode}" />
                  <button id="btn-regen-code" class="apex-btn secondary-btn btn-sm" title="Generate New Room Code">↻ NEW</button>
                </div>
                <span class="mp-hint">Zero-setup WebRTC room. Share this code with friends on mobile, PC, or anywhere!</span>
              </div>
            `
                : `
              <div class="mp-field-group">
                <label class="mp-field-label">SERVER PORT / BINDING</label>
                <input id="input-host-addr" class="mp-input" type="text" value="localhost:5050" placeholder="localhost:5050" />
                <span class="mp-hint">Requires local LAN server running on port 5050 ('npm run server' in terminal).</span>
              </div>
            `
            }
          `
              : `
            ${
              this.connectionType === 'p2p'
                ? `
              <div class="mp-field-group">
                <label class="mp-field-label">ENTER HOST ROOM CODE</label>
                <input id="input-p2p-join-code" class="mp-input room-code-input" type="text" maxlength="14" value="${this.joinRoomCode}" placeholder="e.g. APX-4821" autofocus />
                <span class="mp-hint">Enter the 6-character Room Code displayed on the Host's lobby screen.</span>
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
          `
          }
        </div>

        <div class="mp-actions-footer">
          <button id="btn-mp-back" class="apex-btn secondary-btn">← BACK TO MENU</button>
          <button id="btn-mp-primary-action" class="apex-btn cyan-btn">
            ${
              this.entryMode === 'host'
                ? this.connectionType === 'p2p'
                  ? '🏁 HOST ONLINE RACE'
                  : 'CREATE LAN ROOM'
                : this.connectionType === 'p2p'
                ? '🚀 JOIN ONLINE RACE'
                : 'CONNECT TO LAN HOST'
            }
          </button>
        </div>
      </div>
    `;

    this.bindEntryEvents();
  }

  private bindEntryEvents(): void {
    const tabHost = document.getElementById('btn-tab-host');
    const tabJoin = document.getElementById('btn-tab-join');
    const btnP2P = document.getElementById('btn-conn-p2p');
    const btnLAN = document.getElementById('btn-conn-lan');
    const btnRegen = document.getElementById('btn-regen-code');
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

    btnP2P?.addEventListener('click', () => {
      if (this.connectionType === 'p2p') return;
      this.connectionType = 'p2p';
      this.render();
    });

    btnLAN?.addEventListener('click', () => {
      if (this.connectionType === 'lan') return;
      this.connectionType = 'lan';
      this.render();
    });

    btnRegen?.addEventListener('click', () => {
      this.p2pRoomCode = `APX-${Math.floor(1000 + Math.random() * 9000)}`;
      const inputCode = document.getElementById('input-p2p-code') as HTMLInputElement;
      if (inputCode) inputCode.value = this.p2pRoomCode;
    });

    inputName?.addEventListener('input', () => {
      this.playerName = inputName.value;
    });

    selectCar?.addEventListener('change', () => {
      this.selectedVehicleId = selectCar.value;
      this.render();
    });

    btnBack?.addEventListener('click', () => {
      this.callbacks.onLeave();
    });

    btnAction?.addEventListener('click', async () => {
      const selectedCar = VEHICLE_CATALOG.find((c) => c.id === this.selectedVehicleId) || VEHICLE_CATALOG[0];
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

        const isP2P = this.connectionType === 'p2p';
        let hostAddr = '';

        if (isP2P) {
          const codeInput = document.getElementById('input-p2p-code') as HTMLInputElement;
          hostAddr = codeInput?.value.trim().toUpperCase() || this.p2pRoomCode;
          this.p2pRoomCode = hostAddr;
        } else {
          const addrInput = document.getElementById('input-host-addr') as HTMLInputElement;
          hostAddr = addrInput?.value.trim() || 'localhost:5050';
        }

        const roomConfig: Partial<RoomConfig> = {
          roomId: hostAddr,
          trackId: trackSelect?.value || 'forest_valley',
          trackName: trackSelect?.value === 'azure_coast' ? 'Azure Coast Circuit' : 'Forest Valley Circuit',
          raceMode: (modeSelect?.value as any) || 'circuit',
          maxPlayers: parseInt(maxSelect?.value || '4', 10),
          fillWithAI: aiCheck ? aiCheck.checked : true,
          lapCount: 1,
        };

        this.setStatus(`Starting ${isP2P ? 'Online P2P Room ' + hostAddr : 'LAN Server on ' + hostAddr}...`, 'info');
        await this.callbacks.onHost(roomConfig, playerInfo, hostAddr, isP2P);
      } else {
        const isP2P = this.connectionType === 'p2p';
        let targetAddr = '';

        if (isP2P) {
          const joinCodeInput = document.getElementById('input-p2p-join-code') as HTMLInputElement;
          targetAddr = joinCodeInput?.value.trim().toUpperCase() || '';
          if (!targetAddr) {
            this.setStatus('Please enter the Host Room Code (e.g. APX-4821)', 'error');
            return;
          }
          this.joinRoomCode = targetAddr;
        } else {
          const joinAddrInput = document.getElementById('input-join-addr') as HTMLInputElement;
          targetAddr = joinAddrInput?.value.trim() || 'localhost:5050';
          this.hostAddress = targetAddr;
        }

        this.setStatus(`Connecting to ${targetAddr}...`, 'info');
        await this.callbacks.onJoin(targetAddr, playerInfo);
      }
    });
  }

  private renderLobbyView(): void {
    if (!this.container || !this.activeRoomConfig) return;

    const cfg = this.activeRoomConfig;
    const players = this.activePlayers;
    const maxSlots = cfg.maxPlayers || 4;

    const isP2P = this.serverInfo?.port === 443 || cfg.roomId.startsWith('APX-');
    const roomDisplay = isP2P ? cfg.roomId : (this.serverInfo ? `${this.serverInfo.localIp}:${this.serverInfo.port}` : 'localhost:5050');

    const allHumansReady = players.every((p) => p.isHost || p.isReady);
    const canStart = this.isLocalHost && players.length >= 1 && allHumansReady;

    this.container.innerHTML = `
      <div class="menu-card mp-card mp-lobby-card">
        <div class="panel-header text-center">
          <span class="panel-badge gold-badge">${isP2P ? 'ONLINE RACE LOBBY' : 'LAN RACE LOBBY'} // ${cfg.roomId}</span>
          <h2 class="panel-title large-title">${cfg.trackName.toUpperCase()}</h2>
          <span class="event-subtitle">${cfg.raceMode.toUpperCase()} RACE • ${cfg.lapCount} LAP • ${players.length}/${maxSlots} DRIVERS</span>
        </div>

        <div class="mp-ip-banner">
          <div class="mp-ip-col">
            <span class="mp-ip-label">${isP2P ? 'SHARE ROOM CODE WITH FRIENDS:' : 'HOST LAN IP ADDRESS:'}</span>
            <div class="mp-code-row">
              <span class="mp-ip-val highlighted-code">${roomDisplay}</span>
              ${isP2P ? `<button id="btn-copy-room-code" class="apex-btn secondary-btn btn-sm">📋 COPY CODE</button>` : ''}
            </div>
          </div>
          <div class="mp-status-pill ${this.isLocalHost ? 'host-pill' : 'client-pill'}">
            ${this.isLocalHost ? '👑 ROOM HOST' : 'CONNECTED RACER'}
          </div>
        </div>

        <div id="mp-status-banner" class="mp-status-banner ${this.statusType}" style="display: ${this.statusMessage ? 'block' : 'none'};">
          ${this.statusMessage}
        </div>

        <div class="mp-lobby-content">
          <div class="mp-players-grid">
            ${[1, 2, 3, 4]
              .map((slotNum) => {
                if (slotNum > maxSlots) return '';
                const p = players.find((x) => x.gridSlot === slotNum);
                if (p) {
                  return `
                    <div class="mp-player-card filled ${p.id === this.selfPlayerId ? 'self-card' : ''}">
                      <div class="slot-badge">GRID P${slotNum}</div>
                      <div class="player-info-row">
                        <span class="player-name">${p.name} ${p.isHost ? '<span class="crown-badge">👑 HOST</span>' : ''}</span>
                        <span class="player-ping">${p.pingMs > 0 ? `${p.pingMs}ms` : 'P2P'}</span>
                      </div>
                      <div class="player-car-row">
                        <span class="car-title">${p.vehicleName}</span>
                      </div>
                      <div class="player-status-badge ${p.isHost ? 'ready' : p.isReady ? 'ready' : 'waiting'}">
                        ${p.isHost ? 'HOST' : p.isReady ? '✓ READY' : 'NOT READY'}
                      </div>
                    </div>
                  `;
                } else {
                  return `
                    <div class="mp-player-card empty">
                      <div class="slot-badge">GRID P${slotNum}</div>
                      <span class="empty-slot-text">${cfg.fillWithAI ? 'AI RIVAL OPPONENT' : 'WAITING FOR RACER...'}</span>
                      <span class="slot-tag-sub">${cfg.fillWithAI ? 'COMPETITIVE SIMULATED CHASSIS' : 'OPEN LOBBY SLOT'}</span>
                    </div>
                  `;
                }
              })
              .join('')}
          </div>
        </div>

        <div class="mp-actions-footer">
          <button id="btn-mp-leave" class="apex-btn secondary-btn">LEAVE LOBBY</button>
          <div class="mp-action-right-group">
            ${
              !this.isLocalHost
                ? `
              <button id="btn-mp-toggle-ready" class="apex-btn ${this.isLocalReady ? 'secondary-btn' : 'cyan-btn'}">
                ${this.isLocalReady ? 'CANCEL READY' : '✓ READY TO RACE'}
              </button>
            `
                : `
              <button id="btn-mp-start" class="apex-btn primary-btn ${!canStart ? 'btn-disabled' : ''}" ${!canStart ? 'disabled' : ''}>
                🏁 START MULTIPLAYER EVENT
              </button>
            `
            }
          </div>
        </div>
      </div>
    `;

    this.bindLobbyEvents();
  }

  private bindLobbyEvents(): void {
    const btnLeave = document.getElementById('btn-mp-leave');
    const btnReady = document.getElementById('btn-mp-toggle-ready');
    const btnStart = document.getElementById('btn-mp-start');
    const btnCopy = document.getElementById('btn-copy-room-code');

    btnLeave?.addEventListener('click', () => {
      this.callbacks.onLeave();
    });

    btnReady?.addEventListener('click', () => {
      this.isLocalReady = !this.isLocalReady;
      this.callbacks.onToggleReady(this.isLocalReady);
      this.render();
    });

    btnStart?.addEventListener('click', () => {
      this.callbacks.onStartRace();
    });

    btnCopy?.addEventListener('click', () => {
      if (this.activeRoomConfig?.roomId) {
        navigator.clipboard?.writeText(this.activeRoomConfig.roomId);
        if (btnCopy) btnCopy.textContent = '✓ COPIED!';
        setTimeout(() => {
          if (btnCopy) btnCopy.textContent = '📋 COPY CODE';
        }, 2000);
      }
    });
  }
}

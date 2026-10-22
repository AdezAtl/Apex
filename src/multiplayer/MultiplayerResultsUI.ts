/**
 * Project Apex — MultiplayerResultsUI
 * Official race results screen displaying finishing order, completion times,
 * gap intervals, and status for human and AI drivers in LAN multiplayer.
 */

import { MultiplayerRacerResult } from './MultiplayerTypes';

export interface MultiplayerResultsCallbacks {
  onReturnToLobby: () => void;
  onReturnToMenu: () => void;
}

export class MultiplayerResultsUI {
  private container: HTMLElement | null = null;
  private callbacks: MultiplayerResultsCallbacks;
  private isVisible: boolean = false;
  private standings: MultiplayerRacerResult[] = [];
  private localPlayerId: string | null = null;

  constructor(callbacks: MultiplayerResultsCallbacks) {
    this.callbacks = callbacks;
    this.createDOM();
  }

  public show(standings: MultiplayerRacerResult[], localPlayerId: string): void {
    this.isVisible = true;
    this.standings = standings;
    this.localPlayerId = localPlayerId;
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

  private createDOM(): void {
    const existing = document.getElementById('multiplayer-results-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'multiplayer-results-overlay';
    this.container.className = 'menu-overlay hidden';
    document.getElementById('ui-overlay')?.appendChild(this.container);
  }

  private render(): void {
    if (!this.container) return;

    const userStanding = this.standings.find(s => s.id === this.localPlayerId);
    const userRank = userStanding ? userStanding.rank : 1;
    const isWinner = userRank === 1;

    this.container.innerHTML = `
      <div class="menu-card mp-card mp-results-card">
        <div class="panel-header text-center">
          <span class="panel-badge ${isWinner ? 'gold-badge' : 'cyan-badge'}">
            ${isWinner ? 'VICTORY // 1ST PLACE CHAMPION' : `RACE CLASSIFICATION // ${this.getRankBadge(userRank)}`}
          </span>
          <h2 class="panel-title large-title">OFFICIAL RACE RESULTS</h2>
          <span class="event-subtitle">Authoritative LAN Classification • Synchronized Host Timing</span>
        </div>

        <div class="mp-standings-table-container">
          <table class="mp-standings-table">
            <thead>
              <tr>
                <th>POS</th>
                <th>DRIVER</th>
                <th>CHASSIS</th>
                <th>TIME</th>
                <th>GAP</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${this.standings
                .map(s => {
                  const isUser = s.id === this.localPlayerId;
                  return `
                  <tr class="standings-row rank-${s.rank} ${isUser ? 'user-row' : ''}">
                    <td class="pos-cell">${this.getRankFormatted(s.rank)}</td>
                    <td class="driver-cell">
                      <span class="driver-name">${s.name} ${isUser ? '<span class="you-tag">YOU</span>' : ''}</span>
                    </td>
                    <td class="car-cell">${s.vehicleName}</td>
                    <td class="time-cell">${s.finishTimeFormatted}</td>
                    <td class="gap-cell">${s.gapFormatted}</td>
                    <td class="status-cell">
                      <span class="status-tag ${s.status.toLowerCase()}">${s.status}</span>
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="mp-actions-footer">
          <button id="btn-mp-results-menu" class="apex-btn secondary-btn">RETURN TO MAIN MENU</button>
          <button id="btn-mp-results-lobby" class="apex-btn cyan-btn">RETURN TO LOBBY</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private getRankFormatted(rank: number): string {
    switch (rank) {
      case 1:
        return '🥇 1ST';
      case 2:
        return '🥈 2ND';
      case 3:
        return '🥉 3RD';
      default:
        return `${rank}TH`;
    }
  }

  private getRankBadge(rank: number): string {
    switch (rank) {
      case 1:
        return '1ST PLACE';
      case 2:
        return '2ND PLACE';
      case 3:
        return '3RD PLACE';
      default:
        return `${rank}TH PLACE`;
    }
  }

  private bindEvents(): void {
    const btnMenu = document.getElementById('btn-mp-results-menu');
    const btnLobby = document.getElementById('btn-mp-results-lobby');

    btnMenu?.addEventListener('click', () => {
      this.callbacks.onReturnToMenu();
    });

    btnLobby?.addEventListener('click', () => {
      this.callbacks.onReturnToLobby();
    });
  }
}

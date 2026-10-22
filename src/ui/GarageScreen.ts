import { PAINT_OPTIONS, PaintOption, getPaintOptionById } from '../vehicle/PaintCustomization';
import { VEHICLE_CATALOG, VehicleCatalogItem, getVehicleById } from '../vehicle/VehicleCatalog';
import { CareerManager } from '../career/CareerManager';
import {
  UPGRADE_CATEGORIES,
  UpgradeCategory,
  getUpgradeDeltaPreview,
} from '../vehicle/VehicleUpgrades';

export interface GarageScreenCallbacks {
  onBack: () => void;
  onProceedToRace: () => void;
  onSelectPaint: (paint: PaintOption) => void;
  onSelectVehicle?: (vehicle: VehicleCatalogItem) => void;
  onUpgradeVehicle?: (vehicle: VehicleCatalogItem) => void;
}

export class GarageScreen {
  private container: HTMLElement | null = null;
  private callbacks: GarageScreenCallbacks;
  private isVisible: boolean = false;
  private isNavigating: boolean = false;
  private activePaintId: string = 'pearl_white';
  private activeVehicleId: string = 'apex01_flagship';
  private activeTierFilter: string = 'all';
  private activeRightTab: 'upgrades' | 'paint' = 'upgrades';
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(
    callbacks: GarageScreenCallbacks,
    initialPaintId: string = 'pearl_white',
    initialVehicleId: string = 'apex01_flagship'
  ) {
    this.callbacks = callbacks;
    this.activePaintId = initialPaintId;
    this.activeVehicleId = initialVehicleId;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.createDOM();
  }

  private createDOM(): void {
    const existing = document.getElementById('garage-screen-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'garage-screen-overlay';
    this.container.className = 'garage-viewport-container hidden';

    const activeVehicle = getVehicleById(this.activeVehicleId) || VEHICLE_CATALOG[9];

    this.container.innerHTML = `
      <!-- Top Motorsport Header Bar -->
      <header class="garage-header-bar">
        <div class="garage-header-left">
          <span class="brand-tag">SHOWROOM & SPECIFICATION // GARAGE</span>
          <h1 class="garage-title">PROJECT APEX <span class="accent-slash">//</span> FLEET SHOWROOM</h1>
        </div>
        <div class="garage-header-right">
          <div class="garage-wallet-badge">
            <span class="wallet-label">CREDITS:</span>
            <span id="garage-credits-val" class="wallet-amount">${CareerManager.getInstance().getCredits().toLocaleString()} CR</span>
          </div>
          <span id="garage-status-badge" class="garage-status-badge">${activeVehicle.name} • ACTIVE SELECTION</span>
        </div>
      </header>

      <!-- Left Vehicle Selector & In-Depth Specifications Dock -->
      <aside class="garage-dock garage-left-dock">
        <div class="dock-panel garage-catalog-panel">
          <div class="panel-header">
            <span class="panel-badge">VEHICLE ROSTER // 18 CHASSIS</span>
            <h2 class="panel-title">SELECT VEHICLE</h2>
            <span class="vehicle-class-tag">FILTER BY PERFORMANCE TIER</span>
          </div>

          <!-- Tier Filter Tabs -->
          <div class="tier-filter-bar">
            <button class="tier-filter-btn active" data-tier="all">ALL (18)</button>
            <button class="tier-filter-btn" data-tier="1">T1</button>
            <button class="tier-filter-btn" data-tier="2">T2</button>
            <button class="tier-filter-btn" data-tier="3">T3</button>
            <button class="tier-filter-btn" data-tier="4">T4</button>
            <button class="tier-filter-btn" data-tier="5">T5</button>
          </div>

          <!-- Scrollable Vehicle Card Selector -->
          <div id="garage-vehicle-selector" class="garage-vehicle-selector">
            ${this.renderVehicleCards()}
          </div>

          <!-- Selected Vehicle In-Depth Specifications Card -->
          <div id="selected-vehicle-specs-card" class="selected-vehicle-specs-card">
            ${this.renderActiveVehicleDetails(activeVehicle)}
          </div>
        </div>
      </aside>

      <!-- Right Tabbed Workshop & Customization Dock -->
      <aside class="garage-dock garage-right-dock">
        <div class="dock-panel garage-right-dock-panel">
          <!-- Dock Navigation Tabs -->
          <div class="garage-right-tabs-bar" role="tablist">
            <button
              id="tab-btn-upgrades"
              class="garage-right-tab-btn ${this.activeRightTab === 'upgrades' ? 'active' : ''}"
              role="tab"
              aria-selected="${this.activeRightTab === 'upgrades'}"
            >
              WORKSHOP
            </button>
            <button
              id="tab-btn-paint"
              class="garage-right-tab-btn ${this.activeRightTab === 'paint' ? 'active' : ''}"
              role="tab"
              aria-selected="${this.activeRightTab === 'paint'}"
            >
              FINISH
            </button>
          </div>

          <!-- Tab Content Container -->
          <div id="garage-right-tab-content" class="garage-right-tab-content">
            ${this.renderRightTabContent(activeVehicle)}
          </div>
        </div>
      </aside>

      <!-- Bottom Action Navigation Bar -->
      <nav class="garage-bottom-bar">
        <button id="btn-garage-back" class="apex-btn secondary-btn">
          <span class="btn-text">← RETURN TO MAIN MENU</span>
        </button>
        <div class="garage-bottom-center">
          <span id="garage-active-name" class="garage-bottom-vehicle-tag">${activeVehicle.name} (${activeVehicle.specs.topSpeedKmH} KM/H • ${activeVehicle.specs.drivetrain})</span>
        </div>
        <button id="btn-garage-proceed" class="apex-btn primary-btn">
          <span class="btn-text">PROCEED TO RACE →</span>
        </button>
      </nav>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.container);

    this.bindEvents();
  }

  private renderRightTabContent(v: VehicleCatalogItem): string {
    if (this.activeRightTab === 'upgrades') {
      return this.renderUpgradesPanel(v);
    } else {
      return this.renderPaintPanel();
    }
  }

  private renderUpgradesPanel(v: VehicleCatalogItem): string {
    const career = CareerManager.getInstance();
    const isOwned = career.isVehicleOwned(v.id);
    const currentUpgrades = career.getVehicleUpgrades(v.id);
    const categories: UpgradeCategory[] = ['engine', 'handling', 'brakes', 'suspension'];

    const cardsHtml = categories.map((cat) => {
      const info = UPGRADE_CATEGORIES[cat];
      const preview = getUpgradeDeltaPreview(v.specs, currentUpgrades, cat, v.tier);
      const lvl = preview.currentLevel;

      // Level Pips: [● ● ○]
      const pipsHtml = [1, 2, 3].map((step) => {
        const isFilled = lvl >= step;
        return `<span class="pip ${isFilled ? 'pip-filled' : 'pip-empty'}"></span>`;
      }).join('');

      let actionBtnText = '';
      let actionBtnDisabled = false;
      let actionBtnClass = 'btn-upgrade-action';

      if (!isOwned) {
        actionBtnText = 'CHASSIS NOT OWNED';
        actionBtnDisabled = true;
        actionBtnClass += ' btn-disabled';
      } else if (preview.isMaxLevel) {
        actionBtnText = 'STAGE 3 MAXIMUM';
        actionBtnDisabled = true;
        actionBtnClass += ' btn-maxed';
      } else {
        const canAfford = career.getCredits() >= preview.cost;
        if (canAfford) {
          actionBtnText = `UPGRADE TO STAGE ${preview.nextLevel} (${preview.cost.toLocaleString()} CR)`;
          actionBtnClass += ' btn-upgrade-available';
        } else {
          actionBtnText = `INSUFFICIENT FUNDS (${preview.cost.toLocaleString()} CR)`;
          actionBtnDisabled = true;
          actionBtnClass += ' btn-disabled';
        }
      }

      const deltasHtml = preview.statDeltas.map((d) => `
        <div class="upgrade-delta-pill">
          <span class="delta-label">${d.label}</span>
          <span class="delta-val">${d.to} <small class="delta-bonus">${d.deltaFormatted}</small></span>
        </div>
      `).join('');

      return `
        <div class="garage-upgrade-card" data-category="${cat}">
          <div class="upgrade-card-header">
            <div class="upgrade-title-group">
              <span class="upgrade-icon">${info.icon}</span>
              <div>
                <h3 class="upgrade-category-name">${info.name}</h3>
                <span class="upgrade-category-sub">${info.subtitle}</span>
              </div>
            </div>
            <div class="upgrade-level-badge">
              <span class="level-pips">${pipsHtml}</span>
              <span class="level-label">STAGE ${lvl}/3</span>
            </div>
          </div>

          <div class="upgrade-stage-info">
            <span class="current-stage-title">${preview.currentLevelName}</span>
            <p class="next-stage-desc">${preview.nextDescription}</p>
          </div>

          ${!preview.isMaxLevel ? `<div class="upgrade-deltas-row">${deltasHtml}</div>` : ''}

          <button
            class="apex-btn ${actionBtnClass}"
            data-category="${cat}"
            ${actionBtnDisabled ? 'disabled' : ''}
          >
            <span class="btn-text">${actionBtnText}</span>
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="upgrades-panel-wrapper">
        <div class="panel-header">
          <span class="panel-badge">PERFORMANCE WORKSHOP</span>
          <h2 class="panel-title">${v.name}</h2>
          <span class="vehicle-class-tag highlight">STAGE TUNING & UPGRADES</span>
        </div>
        <div class="upgrades-card-scroll">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  private renderPaintPanel(): string {
    const currentPaint = getPaintOptionById(this.activePaintId);

    return `
      <div class="paint-panel-wrapper">
        <div class="panel-header">
          <span class="panel-badge">EXTERIOR FINISH</span>
          <h2 id="garage-paint-name" class="panel-title">${currentPaint.name}</h2>
          <span id="garage-paint-finish" class="vehicle-class-tag highlight">${currentPaint.finish}</span>
        </div>

        <p id="garage-paint-desc" class="paint-description">${currentPaint.description}</p>

        <!-- Swatches Grid -->
        <div class="swatches-section">
          <div class="swatches-label-bar">
            <span class="sub-label">FACTORY LACQUER OPTIONS</span>
            <span class="shortcut-hint">[1–5] KEYBOARD</span>
          </div>

          <div class="paint-swatch-grid" role="radiogroup" aria-label="Vehicle Exterior Colors">
            ${PAINT_OPTIONS.map((opt, idx) => `
              <button
                id="swatch-${opt.id}"
                class="paint-swatch-btn ${opt.id === this.activePaintId ? 'active' : ''}"
                data-paint-id="${opt.id}"
                data-index="${idx}"
                title="${opt.name} (${opt.finish})"
                role="radio"
                aria-checked="${opt.id === this.activePaintId}"
              >
                <span class="swatch-color-pill" style="background-color: ${opt.hex};"></span>
                <span class="swatch-number">${idx + 1}</span>
                <span class="swatch-name-text">${opt.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Camera Controls Hint -->
        <div class="showroom-controls-guide">
          <div class="guide-row">
            <span class="guide-key">[MOUSE DRAG]</span>
            <span class="guide-desc">Orbit 360° Turntable</span>
          </div>
          <div class="guide-row">
            <span class="guide-key">[SCROLL]</span>
            <span class="guide-desc">Inspect Bodywork Detail</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderVehicleCards(): string {
    const career = CareerManager.getInstance();
    const vehicles = this.activeTierFilter === 'all'
      ? VEHICLE_CATALOG
      : VEHICLE_CATALOG.filter((v) => v.tier.toString() === this.activeTierFilter);

    return vehicles.map((v) => {
      const isSelected = v.id === this.activeVehicleId;
      const isOwned = career.isVehicleOwned(v.id);
      const isPremium = v.unlock.realMoneyPriceUsd !== undefined;
      const priceTag = isOwned
        ? 'OWNED'
        : isPremium
        ? `$${v.unlock.realMoneyPriceUsd!.toFixed(2)} VIP`
        : v.unlock.creditCost
        ? `${v.unlock.creditCost.toLocaleString()} CR`
        : 'TROPHY';

      const tagClass = isOwned
        ? 'tag-unlocked'
        : isPremium
        ? 'tag-iap'
        : v.unlock.creditCost
        ? 'tag-credits'
        : 'tag-trophy';

      const effectiveSpecs = career.getEffectiveVehicleSpecs(v.id) || v.specs;

      return `
        <div
          class="vehicle-card ${isSelected ? 'active-card' : ''} ${isOwned ? 'owned-card' : ''}"
          data-vehicle-id="${v.id}"
          role="button"
          tabindex="0"
        >
          <div class="card-top-row">
            <span class="tier-badge tier-${v.tier}">T${v.tier} ${v.tier === 5 ? 'PINNACLE' : v.tier === 4 ? 'HYPER' : v.tier === 3 ? 'PRO' : v.tier === 2 ? 'SPORT' : 'STREET'}</span>
            <span class="card-price-tag ${tagClass}">${priceTag}</span>
          </div>
          <div class="card-title-row">
            <h3 class="card-vehicle-name">${v.name}</h3>
            <span class="card-vehicle-sub">${v.subtitle}</span>
          </div>
          <div class="card-stats-mini">
            <div class="mini-stat">
              <span class="mini-stat-label">TOP SPEED</span>
              <span class="mini-stat-val">${effectiveSpecs.topSpeedKmH} <small>KM/H</small></span>
            </div>
            <div class="mini-stat">
              <span class="mini-stat-label">0–100</span>
              <span class="mini-stat-val">${effectiveSpecs.accelerationSec.toFixed(1)} <small>S</small></span>
            </div>
            <div class="mini-stat">
              <span class="mini-stat-label">HANDLING</span>
              <span class="mini-stat-val">${effectiveSpecs.handlingRating} <small>/100</small></span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  private renderActiveVehicleDetails(v: VehicleCatalogItem): string {
    const career = CareerManager.getInstance();
    const isOwned = career.isVehicleOwned(v.id);
    const isPremium = v.unlock.realMoneyPriceUsd !== undefined;
    const effective = career.getEffectiveVehicleSpecs(v.id) || v.specs;

    let unlockStatusHtml = '';
    let btnText = 'SELECT THIS CHASSIS';
    let btnClass = '';
    let btnDisabled = false;

    if (isOwned) {
      unlockStatusHtml = `<span class="unlock-free-badge">✓ OWNED & READY TO RACE</span>`;
      btnText = v.id === this.activeVehicleId ? '✓ ACTIVE CHASSIS SELECTED' : 'SELECT THIS CHASSIS';
      btnClass = v.id === this.activeVehicleId ? 'is-selected' : '';
      btnDisabled = false;
    } else if (isPremium) {
      unlockStatusHtml = `<span class="unlock-iap-badge">RESERVE VIP VEHICLE • $${v.unlock.realMoneyPriceUsd!.toFixed(2)} USD</span>`;
      btnText = `PURCHASE VIP PASS ($${v.unlock.realMoneyPriceUsd!.toFixed(2)})`;
      btnClass = 'btn-buy-vip';
      btnDisabled = false;
    } else if (v.unlock.creditCost !== undefined) {
      const canAfford = career.canAffordVehicle(v.id);
      unlockStatusHtml = `<span class="unlock-req-badge">PRICE: ${v.unlock.creditCost.toLocaleString()} CREDITS</span>`;
      btnText = canAfford
        ? `PURCHASE FOR ${v.unlock.creditCost.toLocaleString()} CR`
        : `INSUFFICIENT FUNDS (NEED ${v.unlock.creditCost.toLocaleString()} CR)`;
      btnClass = canAfford ? 'btn-buy-credits' : 'btn-disabled';
      btnDisabled = !canAfford;
    } else {
      unlockStatusHtml = `<span class="unlock-req-badge">CHAMPIONSHIP REQ: ${v.unlock.trophyRequirement || 'Milestone Trophy'}</span>`;
      btnText = 'LOCKED // CAREER REWARD';
      btnClass = 'btn-disabled';
      btnDisabled = true;
    }

    // Spec calculations for base vs upgraded dual-tone progress bars
    const baseSpeedPct = Math.min(100, Math.round((v.specs.topSpeedKmH / 400) * 100));
    const effSpeedPct = Math.min(100, Math.round((effective.topSpeedKmH / 400) * 100));
    const bonusSpeedPct = Math.max(0, effSpeedPct - baseSpeedPct);

    const baseAccelPct = Math.min(100, Math.round(((10.0 - v.specs.accelerationSec) / 8.5) * 100));
    const effAccelPct = Math.min(100, Math.round(((10.0 - effective.accelerationSec) / 8.5) * 100));
    const bonusAccelPct = Math.max(0, effAccelPct - baseAccelPct);

    const baseHandlingPct = v.specs.handlingRating;
    const effHandlingPct = effective.handlingRating;
    const bonusHandlingPct = Math.max(0, effHandlingPct - baseHandlingPct);

    // Delta indicators
    const speedBonusText = effective.topSpeedKmH > v.specs.topSpeedKmH
      ? ` <span class="spec-bonus-tag">(+${effective.topSpeedKmH - v.specs.topSpeedKmH})</span>`
      : '';
    const accelBonusText = effective.accelerationSec < v.specs.accelerationSec
      ? ` <span class="spec-bonus-tag">(-${(v.specs.accelerationSec - effective.accelerationSec).toFixed(1)}s)</span>`
      : '';
    const handlingBonusText = effective.handlingRating > v.specs.handlingRating
      ? ` <span class="spec-bonus-tag">(+${effective.handlingRating - v.specs.handlingRating})</span>`
      : '';

    return `
      <div class="specs-card-header">
        <div class="specs-card-titles">
          <span class="specs-category">${v.category}</span>
          <h2 class="specs-title">${v.name}</h2>
        </div>
        <div class="specs-unlock-badge-wrap">
          ${unlockStatusHtml}
        </div>
      </div>

      <p class="specs-description">${v.description}</p>

      <!-- Visual Attribute Meters with Dual-Tone Upgrade Bonus -->
      <div class="spec-bars-container">
        <div class="spec-bar-row">
          <div class="bar-label-group">
            <span class="bar-name">TOP SPEED</span>
            <span class="bar-value">${effective.topSpeedKmH} KM/H${speedBonusText}</span>
          </div>
          <div class="progress-track dual-tone">
            <div class="progress-fill fill-speed" style="width: ${baseSpeedPct}%;"></div>
            ${bonusSpeedPct > 0 ? `<div class="progress-fill fill-bonus" style="width: ${bonusSpeedPct}%;"></div>` : ''}
          </div>
        </div>

        <div class="spec-bar-row">
          <div class="bar-label-group">
            <span class="bar-name">0–100 ACCELERATION</span>
            <span class="bar-value">${effective.accelerationSec.toFixed(1)} SECONDS${accelBonusText}</span>
          </div>
          <div class="progress-track dual-tone">
            <div class="progress-fill fill-accel" style="width: ${baseAccelPct}%;"></div>
            ${bonusAccelPct > 0 ? `<div class="progress-fill fill-bonus" style="width: ${bonusAccelPct}%;"></div>` : ''}
          </div>
        </div>

        <div class="spec-bar-row">
          <div class="bar-label-group">
            <span class="bar-name">HANDLING & APEX AUTHORITY</span>
            <span class="bar-value">${effective.handlingRating} / 100${handlingBonusText}</span>
          </div>
          <div class="progress-track dual-tone">
            <div class="progress-fill fill-handling" style="width: ${baseHandlingPct}%;"></div>
            ${bonusHandlingPct > 0 ? `<div class="progress-fill fill-bonus" style="width: ${bonusHandlingPct}%;"></div>` : ''}
          </div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="specs-meta-grid">
        <div class="meta-item">
          <span class="meta-label">WEIGHT</span>
          <span class="meta-val">${effective.weightKg.toLocaleString()} KG${effective.weightKg < v.specs.weightKg ? ' *' : ''}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">POWER</span>
          <span class="meta-val">${effective.powerHp} HP${effective.powerHp > v.specs.powerHp ? ' *' : ''}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">DRIVETRAIN</span>
          <span class="meta-val">${effective.drivetrain}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">BRAKING</span>
          <span class="meta-val">${effective.brakingForce.toFixed(1)} m/s²${effective.brakingForce > v.specs.brakingForce ? ' *' : ''}</span>
        </div>
      </div>

      <!-- Action Select Button -->
      <button id="btn-select-chassis" class="apex-btn primary-btn select-chassis-btn ${btnClass}" ${btnDisabled ? 'disabled' : ''}>
        <span class="btn-text">${btnText}</span>
      </button>
    `;
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Bind Right Dock Tabs
    this.bindRightTabButtons();

    // Bind Right Dock Content Events
    this.bindRightDockEvents();

    // Bind Tier Filter Buttons
    const tierBtns = this.container.querySelectorAll<HTMLButtonElement>('.tier-filter-btn');
    tierBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tierBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTierFilter = btn.getAttribute('data-tier') || 'all';
        this.updateCardList();
      });
    });

    // Bind Vehicle Cards
    this.bindCardClicks();

    // Bind Select Chassis Button
    this.bindSelectButton();

    // Bind Bottom Navigation Buttons
    const btnBack = document.getElementById('btn-garage-back');
    const btnProceed = document.getElementById('btn-garage-proceed');

    btnBack?.addEventListener('click', () => this.triggerBack());
    btnProceed?.addEventListener('click', () => this.triggerProceed());
  }

  private bindRightTabButtons(): void {
    const btnUpgrades = document.getElementById('tab-btn-upgrades');
    const btnPaint = document.getElementById('tab-btn-paint');

    btnUpgrades?.addEventListener('click', () => {
      if (this.activeRightTab === 'upgrades') return;
      this.activeRightTab = 'upgrades';
      btnUpgrades.classList.add('active');
      btnPaint?.classList.remove('active');
      this.updateRightTabContent();
    });

    btnPaint?.addEventListener('click', () => {
      if (this.activeRightTab === 'paint') return;
      this.activeRightTab = 'paint';
      btnPaint.classList.add('active');
      btnUpgrades?.classList.remove('active');
      this.updateRightTabContent();
    });
  }

  private updateRightTabContent(): void {
    const container = document.getElementById('garage-right-tab-content');
    const vehicle = getVehicleById(this.activeVehicleId);
    if (!container || !vehicle) return;

    container.innerHTML = this.renderRightTabContent(vehicle);
    this.bindRightDockEvents();
  }

  private bindRightDockEvents(): void {
    if (this.activeRightTab === 'upgrades') {
      this.bindUpgradeButtons();
    } else {
      this.bindPaintSwatches();
    }
  }

  private bindUpgradeButtons(): void {
    const buttons = this.container?.querySelectorAll<HTMLButtonElement>('.btn-upgrade-action');
    buttons?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-category') as UpgradeCategory;
        if (!cat) return;

        const career = CareerManager.getInstance();
        const purchase = career.purchaseUpgrade(this.activeVehicleId, cat);

        if (purchase.success) {
          const vehicle = getVehicleById(this.activeVehicleId);
          if (vehicle) {
            this.updateCreditsDisplay();
            this.updateCardList();
            this.updateRightTabContent();

            // Refresh specs card
            const specsCard = document.getElementById('selected-vehicle-specs-card');
            if (specsCard) {
              specsCard.innerHTML = this.renderActiveVehicleDetails(vehicle);
              this.bindSelectButton();
            }

            // Notify game of upgrades change
            if (this.callbacks.onUpgradeVehicle) {
              this.callbacks.onUpgradeVehicle(vehicle);
            }
          }
        } else {
          alert(`[UPGRADE FAILED] ${purchase.reason}`);
        }
      });
    });
  }

  private bindPaintSwatches(): void {
    const swatchBtns = this.container?.querySelectorAll<HTMLButtonElement>('.paint-swatch-btn');
    swatchBtns?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const paintId = btn.getAttribute('data-paint-id');
        if (paintId) {
          this.selectPaint(paintId);
        }
      });
    });
  }

  private bindCardClicks(): void {
    if (!this.container) return;
    const cards = this.container.querySelectorAll<HTMLElement>('.vehicle-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const vehicleId = card.getAttribute('data-vehicle-id');
        if (vehicleId) {
          this.selectVehicle(vehicleId);
        }
      });
    });
  }

  private bindSelectButton(): void {
    const btnSelect = document.getElementById('btn-select-chassis');
    btnSelect?.addEventListener('click', () => {
      const v = getVehicleById(this.activeVehicleId);
      if (!v) return;

      const career = CareerManager.getInstance();
      if (career.isVehicleOwned(v.id)) {
        career.setSelectedVehicleId(v.id);
        this.selectVehicle(v.id);
        return;
      }

      if (v.unlock.realMoneyPriceUsd) {
        alert(`[PROJECT APEX STORE] Purchasing ${v.name} for $${v.unlock.realMoneyPriceUsd.toFixed(2)} USD.\nVIP Chassis unlocked for all career championships and events!`);
        career.unlockVehicleReward(v.id);
        career.setSelectedVehicleId(v.id);
        this.updateCreditsDisplay();
        this.updateCardList();
        this.selectVehicle(v.id);
        return;
      }

      if (v.unlock.creditCost !== undefined) {
        const purchase = career.purchaseVehicle(v.id);
        if (purchase.success) {
          career.setSelectedVehicleId(v.id);
          this.updateCreditsDisplay();
          this.updateCardList();
          this.selectVehicle(v.id);
          alert(`[PURCHASE CONFIRMED] You have acquired the ${v.name} for ${v.unlock.creditCost.toLocaleString()} CR!`);
        } else {
          alert(`[PURCHASE FAILED] ${purchase.reason}`);
        }
      }
    });
  }

  public updateCreditsDisplay(): void {
    const el = document.getElementById('garage-credits-val');
    if (el) {
      el.textContent = `${CareerManager.getInstance().getCredits().toLocaleString()} CR`;
    }
  }

  private updateCardList(): void {
    const selector = document.getElementById('garage-vehicle-selector');
    if (selector) {
      selector.innerHTML = this.renderVehicleCards();
      this.bindCardClicks();
    }
  }

  public selectVehicle(vehicleId: string): void {
    const vehicle = getVehicleById(vehicleId);
    if (!vehicle) return;

    this.activeVehicleId = vehicle.id;

    // Load and synchronize per-vehicle saved paint
    const savedPaintId = CareerManager.getInstance().getVehiclePaint(vehicle.id);
    this.selectPaint(savedPaintId, false);

    // Update active highlight on cards
    const cards = this.container?.querySelectorAll<HTMLElement>('.vehicle-card');
    cards?.forEach((c) => {
      c.classList.toggle('active-card', c.getAttribute('data-vehicle-id') === vehicle.id);
    });

    // Update Details panel
    const specsCard = document.getElementById('selected-vehicle-specs-card');
    if (specsCard) {
      specsCard.innerHTML = this.renderActiveVehicleDetails(vehicle);
      this.bindSelectButton();
    }

    // Update Right Dock Panel for new vehicle
    this.updateRightTabContent();

    // Update status bar tags
    const statusBadge = document.getElementById('garage-status-badge');
    if (statusBadge) {
      statusBadge.textContent = `${vehicle.name} • ACTIVE SELECTION`;
    }

    const effective = CareerManager.getInstance().getEffectiveVehicleSpecs(vehicle.id) || vehicle.specs;
    const bottomTag = document.getElementById('garage-active-name');
    if (bottomTag) {
      bottomTag.textContent = `${vehicle.name} (${effective.topSpeedKmH} KM/H • ${vehicle.specs.drivetrain})`;
    }

    // Broadcast to 3D showroom
    if (this.callbacks.onSelectVehicle) {
      this.callbacks.onSelectVehicle(vehicle);
    }
  }

  public selectPaint(paintId: string, persist: boolean = true): void {
    const option = getPaintOptionById(paintId);
    this.activePaintId = option.id;

    if (persist) {
      CareerManager.getInstance().setVehiclePaint(this.activeVehicleId, option.id);
    }

    const swatchBtns = this.container?.querySelectorAll<HTMLButtonElement>('.paint-swatch-btn');
    swatchBtns?.forEach((btn) => {
      const match = btn.getAttribute('data-paint-id') === option.id;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-checked', match ? 'true' : 'false');
    });

    const nameEl = document.getElementById('garage-paint-name');
    const finishEl = document.getElementById('garage-paint-finish');
    const descEl = document.getElementById('garage-paint-desc');

    if (nameEl) nameEl.textContent = option.name;
    if (finishEl) finishEl.textContent = option.finish;
    if (descEl) descEl.textContent = option.description;

    this.callbacks.onSelectPaint(option);
  }

  public getActiveVehicleId(): string {
    return this.activeVehicleId;
  }

  public getActivePaintId(): string {
    return this.activePaintId;
  }

  private triggerBack(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onBack();
    setTimeout(() => {
      this.isNavigating = false;
    }, 300);
  }

  private triggerProceed(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onProceedToRace();
    setTimeout(() => {
      this.isNavigating = false;
    }, 300);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    if (e.code === 'Escape' || e.code === 'KeyB') {
      e.preventDefault();
      this.triggerBack();
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      this.triggerProceed();
    } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
      e.preventDefault();
      const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
      if (idx >= 0 && idx < PAINT_OPTIONS.length) {
        this.selectPaint(PAINT_OPTIONS[idx].id);
      }
    }
  }

  public show(): void {
    if (!this.container) return;
    this.isVisible = true;
    this.isNavigating = false;
    this.container.classList.remove('hidden');
    window.addEventListener('keydown', this.boundKeyDown);

    // Sync active paint, vehicle states and career balance
    this.updateCreditsDisplay();
    this.updateCardList();
    this.selectVehicle(this.activeVehicleId);

    const btnProceed = document.getElementById('btn-garage-proceed');
    btnProceed?.focus();
  }

  public hide(): void {
    if (!this.container) return;
    this.isVisible = false;
    this.container.classList.add('hidden');
    window.removeEventListener('keydown', this.boundKeyDown);
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

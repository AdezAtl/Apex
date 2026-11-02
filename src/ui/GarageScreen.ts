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
  private activeVehicleId: string = 'mercedes_slc';
  private activeTierFilter: string = 'all';
  private activeRightTab: 'specs' | 'workshop' | 'paint' = 'specs';
  private boundKeyDown: (e: KeyboardEvent) => void;
  private gamepadCooldown: number = 0;
  private prevGpButtonA: boolean = false;
  private prevGpButtonB: boolean = false;

  constructor(
    callbacks: GarageScreenCallbacks,
    initialPaintId: string = 'pearl_white',
    initialVehicleId: string = 'mercedes_slc'
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

    const activeVehicle = getVehicleById(this.activeVehicleId) || VEHICLE_CATALOG[0];

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
          <span id="garage-status-badge" class="garage-status-badge">${activeVehicle.name} • ACTIVE</span>
        </div>
      </header>

      <!-- Top Thin Vehicle Selection Ribbon -->
      <section class="garage-top-strip-wrapper">
        <div class="strip-filter-pills">
          <button class="strip-filter-btn active" data-tier="all">ALL (18)</button>
          <button class="strip-filter-btn" data-tier="1">T1</button>
          <button class="strip-filter-btn" data-tier="2">T2</button>
          <button class="strip-filter-btn" data-tier="3">T3</button>
          <button class="strip-filter-btn" data-tier="4">T4</button>
          <button class="strip-filter-btn" data-tier="5">T5</button>
        </div>
        <div id="garage-top-strip" class="garage-top-strip" role="tablist">
          ${this.renderTopStripCards()}
        </div>
      </section>

      <!-- Mobile & Touch Edge Chevrons -->
      <button id="btn-garage-mobile-prev" class="garage-edge-nav-btn nav-left" aria-label="Previous Vehicle" title="Previous Chassis (Left Arrow / D-Pad)">
        <span>◀</span>
      </button>
      <button id="btn-garage-mobile-next" class="garage-edge-nav-btn nav-right" aria-label="Next Vehicle" title="Next Chassis (Right Arrow / D-Pad)">
        <span>▶</span>
      </button>

      <!-- Center-Left Hero Vehicle Identity & Selection CTA Cluster -->
      <div id="garage-hero-cluster" class="garage-hero-cluster">
        ${this.renderHeroCluster(activeVehicle)}
      </div>

      <!-- Right-Hand Sleek Card (Lower Half of Screen) -->
      <aside class="garage-sleek-specs-card">
        <!-- Tab Navigation Bar -->
        <div class="sleek-card-tabs" role="tablist">
          <button
            id="tab-btn-specs"
            class="sleek-tab-btn ${this.activeRightTab === 'specs' ? 'active' : ''}"
            role="tab"
            aria-selected="${this.activeRightTab === 'specs'}"
          >
            SPECS
          </button>
          <button
            id="tab-btn-workshop"
            class="sleek-tab-btn ${this.activeRightTab === 'workshop' ? 'active' : ''}"
            role="tab"
            aria-selected="${this.activeRightTab === 'workshop'}"
          >
            WORKSHOP
          </button>
          <button
            id="tab-btn-paint"
            class="sleek-tab-btn ${this.activeRightTab === 'paint' ? 'active' : ''}"
            role="tab"
            aria-selected="${this.activeRightTab === 'paint'}"
          >
            FINISH
          </button>
        </div>

        <!-- Sleek Card Tab Content -->
        <div id="sleek-tab-content" class="sleek-tab-content">
          ${this.renderRightTabContent(activeVehicle)}
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

  /**
   * Renders the thin horizontal ribbon of all available vehicles along the top
   */
  private renderTopStripCards(): string {
    const career = CareerManager.getInstance();
    const vehicles = this.activeTierFilter === 'all'
      ? VEHICLE_CATALOG
      : VEHICLE_CATALOG.filter((v) => v.tier.toString() === this.activeTierFilter);

    return vehicles.map((v) => {
      const isSelected = v.id === this.activeVehicleId;
      const isOwned = career.isVehicleOwned(v.id);
      const isPremium = v.unlock.realMoneyPriceUsd !== undefined;
      const tagText = isOwned
        ? 'OWNED'
        : isPremium
        ? `$${v.unlock.realMoneyPriceUsd!.toFixed(2)}`
        : v.unlock.creditCost
        ? `${v.unlock.creditCost.toLocaleString()} CR`
        : 'TROPHY';

      const tagClass = isOwned
        ? 'status-owned'
        : isPremium
        ? 'status-vip'
        : v.unlock.creditCost
        ? 'status-credits'
        : 'status-trophy';

      return `
        <div
          class="strip-car-card ${isSelected ? 'active' : ''} ${isOwned ? 'owned' : ''}"
          data-vehicle-id="${v.id}"
          role="button"
          tabindex="0"
          title="${v.name} (Tier ${v.tier})"
        >
          <div class="strip-card-header">
            <span class="strip-tier-tag tier-${v.tier}">T${v.tier}</span>
            <span class="strip-status-tag ${tagClass}">${tagText}</span>
          </div>
          <span class="strip-car-name">${v.name}</span>
          <span class="strip-car-stat">${v.specs.topSpeedKmH} KM/H</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Renders the bold hero name & action CTA cluster positioned directly beneath the 3D car model
   */
  private renderHeroCluster(v: VehicleCatalogItem): string {
    const career = CareerManager.getInstance();
    const isOwned = career.isVehicleOwned(v.id);
    const isSelected = v.id === career.getSelectedVehicleId();
    const isPremium = v.unlock.realMoneyPriceUsd !== undefined;
    const effective = career.getEffectiveVehicleSpecs(v.id) || v.specs;

    let ctaText = 'SELECT THIS CHASSIS';
    let ctaClass = 'btn-hero-select';
    let ctaDisabled = false;

    if (isOwned) {
      if (isSelected) {
        ctaText = '✓ ACTIVE CHASSIS SELECTED';
        ctaClass = 'btn-hero-active';
      } else {
        ctaText = 'SELECT THIS CHASSIS';
        ctaClass = 'btn-hero-select';
      }
    } else if (isPremium) {
      ctaText = `UNLOCK VIP CHASSIS ($${v.unlock.realMoneyPriceUsd!.toFixed(2)})`;
      ctaClass = 'btn-hero-buy-vip';
    } else if (v.unlock.creditCost !== undefined) {
      const canAfford = career.canAffordVehicle(v.id);
      ctaText = canAfford
        ? `PURCHASE CHASSIS (${v.unlock.creditCost.toLocaleString()} CR)`
        : `NEED ${v.unlock.creditCost.toLocaleString()} CR`;
      ctaClass = canAfford ? 'btn-hero-buy-cr' : 'btn-hero-disabled';
      ctaDisabled = !canAfford;
    } else {
      ctaText = `LOCKED // ${v.unlock.trophyRequirement || 'CAREER TROPHY'}`;
      ctaClass = 'btn-hero-disabled';
      ctaDisabled = true;
    }

    return `
      <div class="hero-top-row">
        <span class="hero-tier-tag tier-${v.tier}">TIER ${v.tier} ${v.tier === 5 ? 'PINNACLE' : v.tier === 4 ? 'HYPER' : v.tier === 3 ? 'PRO' : v.tier === 2 ? 'SPORT' : 'STREET'}</span>
        <span class="hero-category-tag">${v.category.toUpperCase()}</span>
      </div>
      <h2 class="hero-vehicle-name">${v.name}</h2>
      <span class="hero-vehicle-subtitle">${v.subtitle}</span>
      <div class="hero-quick-stats">
        <span class="hero-stat-pill"><strong>${effective.topSpeedKmH}</strong> KM/H</span>
        <span class="hero-stat-pill"><strong>${effective.accelerationSec.toFixed(1)}s</strong> 0–100</span>
        <span class="hero-stat-pill"><strong>${effective.drivetrain}</strong></span>
        <span class="hero-stat-pill"><strong>${effective.powerHp}</strong> HP</span>
      </div>
      <button id="btn-hero-primary-action" class="apex-btn ${ctaClass}" ${ctaDisabled ? 'disabled' : ''}>
        <span class="btn-text">${ctaText}</span>
      </button>
    `;
  }

  /**
   * Renders the active tab in the right-hand sleek card
   */
  private renderRightTabContent(v: VehicleCatalogItem): string {
    if (this.activeRightTab === 'specs') {
      return this.renderSpecsPanel(v);
    } else if (this.activeRightTab === 'workshop') {
      return this.renderUpgradesPanel(v);
    } else {
      return this.renderPaintPanel();
    }
  }

  /**
   * Specs Tab: High-precision attribute meters & mechanical specs
   */
  private renderSpecsPanel(v: VehicleCatalogItem): string {
    const career = CareerManager.getInstance();
    const effective = career.getEffectiveVehicleSpecs(v.id) || v.specs;

    const baseSpeedPct = Math.min(100, Math.round((v.specs.topSpeedKmH / 400) * 100));
    const effSpeedPct = Math.min(100, Math.round((effective.topSpeedKmH / 400) * 100));
    const bonusSpeedPct = Math.max(0, effSpeedPct - baseSpeedPct);

    const baseAccelPct = Math.min(100, Math.round(((10.0 - v.specs.accelerationSec) / 8.5) * 100));
    const effAccelPct = Math.min(100, Math.round(((10.0 - effective.accelerationSec) / 8.5) * 100));
    const bonusAccelPct = Math.max(0, effAccelPct - baseAccelPct);

    const baseHandlingPct = v.specs.handlingRating;
    const effHandlingPct = effective.handlingRating;
    const bonusHandlingPct = Math.max(0, effHandlingPct - baseHandlingPct);

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
      <div class="sleek-specs-body">
        <p class="sleek-specs-desc">${v.description}</p>

        <!-- Attribute Progress Meters -->
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
              <span class="bar-name">0–100 ACCEL</span>
              <span class="bar-value">${effective.accelerationSec.toFixed(1)} SEC${accelBonusText}</span>
            </div>
            <div class="progress-track dual-tone">
              <div class="progress-fill fill-accel" style="width: ${baseAccelPct}%;"></div>
              ${bonusAccelPct > 0 ? `<div class="progress-fill fill-bonus" style="width: ${bonusAccelPct}%;"></div>` : ''}
            </div>
          </div>

          <div class="spec-bar-row">
            <div class="bar-label-group">
              <span class="bar-name">HANDLING & APEX</span>
              <span class="bar-value">${effective.handlingRating} / 100${handlingBonusText}</span>
            </div>
            <div class="progress-track dual-tone">
              <div class="progress-fill fill-handling" style="width: ${baseHandlingPct}%;"></div>
              ${bonusHandlingPct > 0 ? `<div class="progress-fill fill-bonus" style="width: ${bonusHandlingPct}%;"></div>` : ''}
            </div>
          </div>
        </div>

        <!-- 4-Grid Mechanical Specifications -->
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
      </div>
    `;
  }

  /**
   * Workshop Tab: 4 Tuning upgrade categories with level pips and actions
   */
  private renderUpgradesPanel(v: VehicleCatalogItem): string {
    const career = CareerManager.getInstance();
    const isOwned = career.isVehicleOwned(v.id);
    const currentUpgrades = career.getVehicleUpgrades(v.id);
    const categories: UpgradeCategory[] = ['engine', 'handling', 'brakes', 'suspension'];

    const cardsHtml = categories.map((cat) => {
      const info = UPGRADE_CATEGORIES[cat];
      const preview = getUpgradeDeltaPreview(v.specs, currentUpgrades, cat, v.tier);
      const lvl = preview.currentLevel;

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
          actionBtnText = `UPGRADE STAGE ${preview.nextLevel} (${preview.cost.toLocaleString()} CR)`;
          actionBtnClass += ' btn-upgrade-available';
        } else {
          actionBtnText = `INSUFFICIENT (${preview.cost.toLocaleString()} CR)`;
          actionBtnDisabled = true;
          actionBtnClass += ' btn-disabled';
        }
      }

      const deltasHtml = preview.statDeltas.map((d) => `
        <div class="upgrade-delta-pill">
          <span class="delta-label">${d.label}:</span>
          <span class="delta-val">${d.to} <small class="delta-bonus">${d.deltaFormatted}</small></span>
        </div>
      `).join('');

      return `
        <div class="garage-upgrade-card" data-category="${cat}">
          <div class="upgrade-card-header">
            <div class="upgrade-title-group">
              <span class="upgrade-icon">${info.icon}</span>
              <div>
                <h4 class="upgrade-category-name">${info.name}</h4>
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
        <div class="upgrades-card-scroll">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Finish Tab: Exterior Lacquer Swatches & Turntable hints
   */
  private renderPaintPanel(): string {
    const currentPaint = getPaintOptionById(this.activePaintId);

    return `
      <div class="paint-panel-wrapper">
        <div class="paint-current-badge">
          <span id="garage-paint-name" class="paint-title">${currentPaint.name}</span>
          <span id="garage-paint-finish" class="paint-finish-tag">${currentPaint.finish}</span>
        </div>
        <p id="garage-paint-desc" class="paint-description">${currentPaint.description}</p>

        <!-- Swatches Grid -->
        <div class="swatches-section">
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

        <!-- Controls Guide Hint -->
        <div class="showroom-controls-guide">
          <div class="guide-row">
            <span class="guide-key">[DESKTOP / KEYS]</span>
            <span class="guide-desc">◀ / ▶ Arrow Keys switch chassis</span>
          </div>
          <div class="guide-row">
            <span class="guide-key">[CONTROLLER]</span>
            <span class="guide-desc">Left Stick / D-Pad switch; Right Stick rotates</span>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Sleek Tabs
    this.bindTabButtons();

    // Tab content events (Upgrades / Paint)
    this.bindTabContentEvents();

    // Top ribbon tier filter pills
    const filterBtns = this.container.querySelectorAll<HTMLButtonElement>('.strip-filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTierFilter = btn.getAttribute('data-tier') || 'all';
        this.updateTopStrip();
      });
    });

    // Top ribbon vehicle cards
    this.bindStripCardClicks();

    // Mobile & Touch Edge Chevrons
    const btnPrev = document.getElementById('btn-garage-mobile-prev');
    const btnNext = document.getElementById('btn-garage-mobile-next');
    btnPrev?.addEventListener('click', () => this.selectPrevVehicle());
    btnNext?.addEventListener('click', () => this.selectNextVehicle());

    // Hero Action Button
    this.bindHeroAction();

    // Bottom Navigation Buttons
    const btnBack = document.getElementById('btn-garage-back');
    const btnProceed = document.getElementById('btn-garage-proceed');
    btnBack?.addEventListener('click', () => this.triggerBack());
    btnProceed?.addEventListener('click', () => this.triggerProceed());
  }

  private bindTabButtons(): void {
    const btnSpecs = document.getElementById('tab-btn-specs');
    const btnWorkshop = document.getElementById('tab-btn-workshop');
    const btnPaint = document.getElementById('tab-btn-paint');

    btnSpecs?.addEventListener('click', () => {
      if (this.activeRightTab === 'specs') return;
      this.activeRightTab = 'specs';
      btnSpecs.classList.add('active');
      btnWorkshop?.classList.remove('active');
      btnPaint?.classList.remove('active');
      this.updateRightTabContent();
    });

    btnWorkshop?.addEventListener('click', () => {
      if (this.activeRightTab === 'workshop') return;
      this.activeRightTab = 'workshop';
      btnWorkshop.classList.add('active');
      btnSpecs?.classList.remove('active');
      btnPaint?.classList.remove('active');
      this.updateRightTabContent();
    });

    btnPaint?.addEventListener('click', () => {
      if (this.activeRightTab === 'paint') return;
      this.activeRightTab = 'paint';
      btnPaint.classList.add('active');
      btnSpecs?.classList.remove('active');
      btnWorkshop?.classList.remove('active');
      this.updateRightTabContent();
    });
  }

  private updateRightTabContent(): void {
    const content = document.getElementById('sleek-tab-content');
    const vehicle = getVehicleById(this.activeVehicleId);
    if (!content || !vehicle) return;

    content.innerHTML = this.renderRightTabContent(vehicle);
    this.bindTabContentEvents();
  }

  private bindTabContentEvents(): void {
    if (this.activeRightTab === 'workshop') {
      this.bindUpgradeButtons();
    } else if (this.activeRightTab === 'paint') {
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
            this.updateHeroCluster(vehicle);
            this.updateRightTabContent();

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

  private bindStripCardClicks(): void {
    if (!this.container) return;
    const cards = this.container.querySelectorAll<HTMLElement>('.strip-car-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const vehicleId = card.getAttribute('data-vehicle-id');
        if (vehicleId) {
          this.selectVehicle(vehicleId);
        }
      });
    });
  }

  private bindHeroAction(): void {
    const btnAction = document.getElementById('btn-hero-primary-action');
    btnAction?.addEventListener('click', () => {
      this.triggerPrimarySelect();
    });
  }

  public triggerPrimarySelect(): void {
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
      this.updateTopStrip();
      this.selectVehicle(v.id);
      return;
    }

    if (v.unlock.creditCost !== undefined) {
      const purchase = career.purchaseVehicle(v.id);
      if (purchase.success) {
        career.setSelectedVehicleId(v.id);
        this.updateCreditsDisplay();
        this.updateTopStrip();
        this.selectVehicle(v.id);
        alert(`[PURCHASE CONFIRMED] You have acquired the ${v.name} for ${v.unlock.creditCost.toLocaleString()} CR!`);
      } else {
        alert(`[PURCHASE FAILED] ${purchase.reason}`);
      }
    }
  }

  public updateCreditsDisplay(): void {
    const el = document.getElementById('garage-credits-val');
    if (el) {
      el.textContent = `${CareerManager.getInstance().getCredits().toLocaleString()} CR`;
    }
  }

  private updateTopStrip(): void {
    const strip = document.getElementById('garage-top-strip');
    if (strip) {
      strip.innerHTML = this.renderTopStripCards();
      this.bindStripCardClicks();
      this.scrollToActiveStripCard();
    }
  }

  private scrollToActiveStripCard(): void {
    const activeCard = this.container?.querySelector<HTMLElement>(`.strip-car-card[data-vehicle-id="${this.activeVehicleId}"]`);
    if (activeCard) {
      activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  private updateHeroCluster(v: VehicleCatalogItem): void {
    const hero = document.getElementById('garage-hero-cluster');
    if (hero) {
      hero.innerHTML = this.renderHeroCluster(v);
      this.bindHeroAction();
    }
  }

  public selectNextVehicle(): void {
    const vehicles = this.activeTierFilter === 'all'
      ? VEHICLE_CATALOG
      : VEHICLE_CATALOG.filter((v) => v.tier.toString() === this.activeTierFilter);

    if (vehicles.length === 0) return;
    const curIdx = vehicles.findIndex((v) => v.id === this.activeVehicleId);
    const nextIdx = (curIdx + 1) % vehicles.length;
    this.selectVehicle(vehicles[nextIdx].id);
  }

  public selectPrevVehicle(): void {
    const vehicles = this.activeTierFilter === 'all'
      ? VEHICLE_CATALOG
      : VEHICLE_CATALOG.filter((v) => v.tier.toString() === this.activeTierFilter);

    if (vehicles.length === 0) return;
    const curIdx = vehicles.findIndex((v) => v.id === this.activeVehicleId);
    const prevIdx = (curIdx - 1 + vehicles.length) % vehicles.length;
    this.selectVehicle(vehicles[prevIdx].id);
  }

  public selectVehicle(vehicleId: string): void {
    const vehicle = getVehicleById(vehicleId);
    if (!vehicle) return;

    this.activeVehicleId = vehicle.id;

    // Load and synchronize per-vehicle saved paint
    const savedPaintId = CareerManager.getInstance().getVehiclePaint(vehicle.id);
    this.selectPaint(savedPaintId, false);

    // Update active highlight on strip cards
    const cards = this.container?.querySelectorAll<HTMLElement>('.strip-car-card');
    cards?.forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-vehicle-id') === vehicle.id);
    });
    this.scrollToActiveStripCard();

    // Update hero cluster beneath 3D model
    this.updateHeroCluster(vehicle);

    // Update Right Sleek Specs Card
    this.updateRightTabContent();

    // Update status bar tags
    const statusBadge = document.getElementById('garage-status-badge');
    if (statusBadge) {
      statusBadge.textContent = `${vehicle.name} • ACTIVE`;
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

  public triggerBack(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onBack();
    setTimeout(() => {
      this.isNavigating = false;
    }, 300);
  }

  public triggerProceed(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onProceedToRace();
    setTimeout(() => {
      this.isNavigating = false;
    }, 300);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      this.selectPrevVehicle();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      this.selectNextVehicle();
    } else if (e.code === 'Escape' || e.code === 'KeyB') {
      e.preventDefault();
      this.triggerBack();
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault();
      this.triggerPrimarySelect();
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
    this.updateTopStrip();
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

  public updateGamepadInput(gp: Gamepad | null, dt: number): void {
    if (!this.isVisible || !gp) return;

    const isPressed = (idx: number) => {
      const b = gp.buttons[idx];
      return typeof b === 'object' ? b.pressed : (b ?? 0) > 0.5;
    };

    const dpadLeft = isPressed(14);
    const dpadRight = isPressed(15);
    const stickX = gp.axes[0] ?? 0;

    const navLeft = dpadLeft || stickX < -0.55;
    const navRight = dpadRight || stickX > 0.55;

    if (this.gamepadCooldown <= 0) {
      if (navLeft) {
        this.selectPrevVehicle();
        this.gamepadCooldown = 0.28;
      } else if (navRight) {
        this.selectNextVehicle();
        this.gamepadCooldown = 0.28;
      }
    } else {
      if (!navLeft && !navRight) {
        this.gamepadCooldown = 0;
      } else {
        this.gamepadCooldown -= dt;
      }
    }

    const btnA = isPressed(0) || isPressed(2);
    if (btnA && !this.prevGpButtonA) {
      this.triggerPrimarySelect();
    }
    this.prevGpButtonA = btnA;

    const btnB = isPressed(1);
    if (btnB && !this.prevGpButtonB) {
      this.triggerBack();
    }
    this.prevGpButtonB = btnB;
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

import {
  CAREER_EVENTS,
  CareerEventDefinition,
  CareerTierInfo,
  getTierInfo,
  getCareerEventById,
  getEventsByTier,
} from './CareerConfig';
import { VEHICLE_CATALOG, VehicleCatalogItem, getVehicleById, VehiclePerformanceSpecs } from '../vehicle/VehicleCatalog';
import {
  VehicleUpgradeLevels,
  UpgradeCategory,
  MAX_UPGRADE_LEVEL,
  DEFAULT_UPGRADE_LEVELS,
  getUpgradeCost,
  calculateEffectiveSpecs,
} from '../vehicle/VehicleUpgrades';

export type CareerMedal = 'gold' | 'silver' | 'bronze' | 'completed';

export interface CompletedEventRecord {
  eventId: string;
  completedAt: number;
  bestResult: number; // Seconds for TT/Sprint, points for Drift
  bestPosition?: number;
  medal: CareerMedal;
  completedObjectives: string[];
  attempts?: number;
  firstCompletionRewardClaimed?: boolean;
}

export interface CareerSaveData {
  version: number;
  credits: number;
  reputation: number;
  currentTier: number;
  ownedVehicleIds: string[];
  selectedVehicleId: string;
  unlockedEventIds: string[];
  completedEvents: Record<string, CompletedEventRecord>;
  vehicleUpgrades: Record<string, VehicleUpgradeLevels>;
  vehiclePaints: Record<string, string>;
  lastRewardSessionToken?: string;
}

export interface PlayerLevelInfo {
  level: number;
  title: string;
  currentRep: number;
  nextThreshold: number;
  progressRatio: number;
}

export interface EventCompletionResult {
  isAlreadyRewarded: boolean;
  medal: CareerMedal;
  baseCredits: number;
  bonusCredits: number;
  totalCredits: number;
  reputationEarned: number;
  isReplay: boolean;
  originalReputationReward: number;
  completedObjectives: { id: string; description: string; bonusCredits: number }[];
  newUnlockedEvents: string[];
  newUnlockedTier?: CareerTierInfo;
  newUnlockedVehicles: string[];
}

export class CareerManager {
  private static readonly STORAGE_KEY = 'project_apex_career_v1';
  private static instance: CareerManager | null = null;

  private data: CareerSaveData;

  public static getInstance(): CareerManager {
    if (!CareerManager.instance) {
      CareerManager.instance = new CareerManager();
    }
    return CareerManager.instance;
  }

  constructor() {
    this.data = this.loadData();
    this.ensureIntegrity();
  }

  private getDefaultData(): CareerSaveData {
    return {
      version: 1,
      credits: 5000,
      reputation: 0,
      currentTier: 1,
      ownedVehicleIds: ['detective_cruiser', 'apex01_flagship'],
      selectedVehicleId: 'detective_cruiser',
      unlockedEventIds: ['rookie_sprint_1'],
      completedEvents: {},
      vehicleUpgrades: {},
      vehiclePaints: {
        detective_cruiser: 'gloss_black',
        apex01_flagship: 'pearl_white',
      },
    };
  }

  private loadData(): CareerSaveData {
    const defaults = this.getDefaultData();
    try {
      const raw = localStorage.getItem(CareerManager.STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === 'object') {
        // Parse and validate vehicle upgrades mapping
        const vehicleUpgrades: Record<string, VehicleUpgradeLevels> = {};
        if (parsed.vehicleUpgrades && typeof parsed.vehicleUpgrades === 'object') {
          for (const [vehId, upg] of Object.entries(parsed.vehicleUpgrades)) {
            if (upg && typeof upg === 'object') {
              const u = upg as Record<string, unknown>;
              vehicleUpgrades[vehId] = {
                engine: typeof u.engine === 'number' ? Math.max(0, Math.min(MAX_UPGRADE_LEVEL, u.engine)) : 0,
                handling: typeof u.handling === 'number' ? Math.max(0, Math.min(MAX_UPGRADE_LEVEL, u.handling)) : 0,
                brakes: typeof u.brakes === 'number' ? Math.max(0, Math.min(MAX_UPGRADE_LEVEL, u.brakes)) : 0,
                suspension: typeof u.suspension === 'number' ? Math.max(0, Math.min(MAX_UPGRADE_LEVEL, u.suspension)) : 0,
              };
            }
          }
        }

        // Parse and validate vehicle paints mapping
        const vehiclePaints: Record<string, string> = { ...defaults.vehiclePaints };
        if (parsed.vehiclePaints && typeof parsed.vehiclePaints === 'object') {
          for (const [vehId, pId] of Object.entries(parsed.vehiclePaints)) {
            if (typeof pId === 'string' && pId.length > 0) {
              vehiclePaints[vehId] = pId;
            }
          }
        }

        return {
          version: typeof parsed.version === 'number' ? parsed.version : defaults.version,
          credits: typeof parsed.credits === 'number' && !isNaN(parsed.credits) ? Math.max(0, parsed.credits) : defaults.credits,
          reputation: typeof parsed.reputation === 'number' && !isNaN(parsed.reputation) ? Math.max(0, parsed.reputation) : defaults.reputation,
          currentTier: typeof parsed.currentTier === 'number' ? Math.max(1, Math.min(5, parsed.currentTier)) : defaults.currentTier,
          ownedVehicleIds: Array.isArray(parsed.ownedVehicleIds) && parsed.ownedVehicleIds.length > 0
            ? Array.from(new Set(['detective_cruiser', 'apex01_flagship', ...parsed.ownedVehicleIds]))
            : defaults.ownedVehicleIds,
          selectedVehicleId: typeof parsed.selectedVehicleId === 'string' && parsed.selectedVehicleId.length > 0
            ? parsed.selectedVehicleId
            : defaults.selectedVehicleId,
          unlockedEventIds: Array.isArray(parsed.unlockedEventIds) && parsed.unlockedEventIds.length > 0
            ? Array.from(new Set(['rookie_sprint_1', ...parsed.unlockedEventIds]))
            : defaults.unlockedEventIds,
          completedEvents: parsed.completedEvents && typeof parsed.completedEvents === 'object'
            ? parsed.completedEvents
            : {},
          vehicleUpgrades,
          vehiclePaints,
          lastRewardSessionToken: parsed.lastRewardSessionToken,
        };
      }
      return defaults;
    } catch (err) {
      console.warn('[CareerManager] Failed to parse career save data, using defaults:', err);
      return defaults;
    }
  }

  public save(): void {
    try {
      localStorage.setItem(CareerManager.STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.error('[CareerManager] Failed to persist career save data:', err);
    }
  }

  private ensureIntegrity(): void {
    // Ensure starting cars are owned
    if (!this.data.ownedVehicleIds.includes('detective_cruiser')) {
      this.data.ownedVehicleIds.push('detective_cruiser');
    }
    if (!this.data.ownedVehicleIds.includes('apex01_flagship')) {
      this.data.ownedVehicleIds.push('apex01_flagship');
    }

    // Ensure first event is unlocked
    if (!this.data.unlockedEventIds.includes('rookie_sprint_1')) {
      this.data.unlockedEventIds.push('rookie_sprint_1');
    }

    // Refresh unlocked events based on reputation and completed event prerequisites
    this.refreshUnlocks();
    this.save();
  }

  public refreshUnlocks(): void {
    const rep = this.data.reputation;

    for (const event of CAREER_EVENTS) {
      if (this.data.unlockedEventIds.includes(event.id)) continue;

      let canUnlock = true;
      if (event.unlockRequirement.requiredReputation && rep < event.unlockRequirement.requiredReputation) {
        canUnlock = false;
      }
      if (event.unlockRequirement.previousEventId && !this.data.completedEvents[event.unlockRequirement.previousEventId]) {
        canUnlock = false;
      }

      if (canUnlock) {
        this.data.unlockedEventIds.push(event.id);
      }
    }

    // Update current tier if higher tier requirements are satisfied
    for (let t = 5; t >= 1; t--) {
      const tierInfo = getTierInfo(t);
      if (rep >= tierInfo.requiredReputation) {
        this.data.currentTier = Math.max(this.data.currentTier, t);
        break;
      }
    }
  }

  // ==========================================
  // CURRENCY & REPUTATION ACCESSORS
  // ==========================================

  public getCredits(): number {
    return this.data.credits;
  }

  public addCredits(amount: number): number {
    this.data.credits += Math.max(0, Math.round(amount));
    this.save();
    return this.data.credits;
  }

  public deductCredits(amount: number): boolean {
    if (this.data.credits < amount) return false;
    this.data.credits -= Math.max(0, Math.round(amount));
    this.save();
    return true;
  }

  public getReputation(): number {
    return this.data.reputation;
  }

  public getCurrentTier(): number {
    return this.data.currentTier;
  }

  public getPlayerLevel(): PlayerLevelInfo {
    const rep = this.data.reputation;
    const MILESTONES: [number, string][] = [
      [0, 'Rookie Driver'],
      [450, 'Street Novice'],
      [1100, 'Club Pro'],
      [2200, 'Supercar Specialist'],
      [3800, 'Apex Elite Legend'],
      [5500, 'Hall of Fame Champion'],
    ];

    let level = 1;
    let title = MILESTONES[0][1];
    let nextThreshold = MILESTONES[1][0];
    let prevThreshold = 0;

    for (let i = 0; i < MILESTONES.length; i++) {
      if (rep >= MILESTONES[i][0]) {
        level = i + 1;
        title = MILESTONES[i][1];
        prevThreshold = MILESTONES[i][0];
        nextThreshold = i + 1 < MILESTONES.length ? MILESTONES[i + 1][0] : MILESTONES[i][0] + 2000;
      } else {
        break;
      }
    }

    const progressRatio = Math.max(0, Math.min(1.0, (rep - prevThreshold) / Math.max(1, nextThreshold - prevThreshold)));

    return {
      level,
      title,
      currentRep: rep,
      nextThreshold,
      progressRatio,
    };
  }

  // ==========================================
  // VEHICLE OWNERSHIP & PURCHASING
  // ==========================================

  public isVehicleOwned(vehicleId: string): boolean {
    return this.data.ownedVehicleIds.includes(vehicleId);
  }

  public getOwnedVehicleIds(): string[] {
    return [...this.data.ownedVehicleIds];
  }

  public canAffordVehicle(vehicleId: string): boolean {
    const v = getVehicleById(vehicleId);
    if (!v || !v.unlock.creditCost) return false;
    return this.data.credits >= v.unlock.creditCost;
  }

  public purchaseVehicle(vehicleId: string): { success: boolean; reason?: string } {
    if (this.isVehicleOwned(vehicleId)) {
      return { success: false, reason: 'Vehicle is already owned.' };
    }

    const vehicle = getVehicleById(vehicleId);
    if (!vehicle) {
      return { success: false, reason: 'Vehicle does not exist in catalog.' };
    }

    if (vehicle.unlock.method === 'starter') {
      this.data.ownedVehicleIds.push(vehicleId);
      this.save();
      return { success: true };
    }

    const cost = vehicle.unlock.creditCost;
    if (cost === undefined) {
      return { success: false, reason: 'This vehicle cannot be purchased with credits.' };
    }

    if (this.data.credits < cost) {
      return {
        success: false,
        reason: `Insufficient credits. Requires ${cost.toLocaleString()} CR (Current balance: ${this.data.credits.toLocaleString()} CR).`,
      };
    }

    this.data.credits -= cost;
    this.data.ownedVehicleIds.push(vehicleId);
    this.save();
    return { success: true };
  }

  public unlockVehicleReward(vehicleId: string): void {
    if (!this.data.ownedVehicleIds.includes(vehicleId)) {
      this.data.ownedVehicleIds.push(vehicleId);
      this.save();
    }
  }

  public setSelectedVehicleId(vehicleId: string): void {
    this.data.selectedVehicleId = vehicleId;
    this.save();
  }

  public getSelectedVehicleId(): string {
    return this.data.selectedVehicleId;
  }

  // ==========================================
  // PERFORMANCE UPGRADES & PAINT CUSTOMIZATION
  // ==========================================

  public getVehicleUpgrades(vehicleId: string): VehicleUpgradeLevels {
    const existing = this.data.vehicleUpgrades[vehicleId];
    if (!existing) {
      return { ...DEFAULT_UPGRADE_LEVELS };
    }
    return {
      engine: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, existing.engine ?? 0)),
      handling: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, existing.handling ?? 0)),
      brakes: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, existing.brakes ?? 0)),
      suspension: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, existing.suspension ?? 0)),
    };
  }

  public getVehicleUpgradeStage(vehicleId: string, category: UpgradeCategory): number {
    return this.getVehicleUpgrades(vehicleId)[category] ?? 0;
  }

  public getEffectiveVehicleSpecs(vehicleId: string): VehiclePerformanceSpecs | undefined {
    const v = getVehicleById(vehicleId);
    if (!v) return undefined;
    const upgrades = this.getVehicleUpgrades(vehicleId);
    return calculateEffectiveSpecs(v.specs, upgrades);
  }

  public resetVehicleUpgrades(vehicleId: string): void {
    delete this.data.vehicleUpgrades[vehicleId];
    this.save();
  }

  public purchaseUpgrade(
    vehicleId: string,
    category: UpgradeCategory
  ): { success: boolean; reason?: string; newLevel?: number; newStage?: number; newBalance?: number } {
    // 1. Verify vehicle existence and ownership
    const vehicle = getVehicleById(vehicleId);
    if (!vehicle) {
      return { success: false, reason: 'Vehicle does not exist in catalog.' };
    }
    if (!this.isVehicleOwned(vehicleId)) {
      return { success: false, reason: 'You must own this chassis before purchasing performance upgrades.' };
    }

    // 2. Verify current level
    const currentUpgrades = this.getVehicleUpgrades(vehicleId);
    const currentLevel = currentUpgrades[category];
    if (currentLevel >= MAX_UPGRADE_LEVEL) {
      return { success: false, reason: 'This component has already reached the maximum Stage 3 level.' };
    }

    // 3. Verify price & funds
    const cost = getUpgradeCost(vehicle.tier, category, currentLevel);
    if (this.data.credits < cost) {
      return {
        success: false,
        reason: `Insufficient credits. Upgrade requires ${cost.toLocaleString()} CR (Current balance: ${this.data.credits.toLocaleString()} CR).`,
      };
    }

    // 4. Atomically apply transaction
    this.data.credits -= cost;
    const nextLevel = currentLevel + 1;
    this.data.vehicleUpgrades[vehicleId] = {
      ...currentUpgrades,
      [category]: nextLevel,
    };
    this.save();

    return {
      success: true,
      newLevel: nextLevel,
      newStage: nextLevel,
      newBalance: this.data.credits,
    };
  }

  public getVehiclePaint(vehicleId: string): string {
    return this.data.vehiclePaints[vehicleId] || 'pearl_white';
  }

  public setVehiclePaint(vehicleId: string, paintId: string): void {
    this.data.vehiclePaints[vehicleId] = paintId;
    this.save();
  }

  // ==========================================
  // EVENT ELIGIBILITY & UNLOCKS
  // ==========================================

  public isEventUnlocked(eventId: string): boolean {
    return this.data.unlockedEventIds.includes(eventId);
  }

  public getEventsForTier(tierNumber: number): CareerEventDefinition[] {
    return CAREER_EVENTS.filter((e) => e.tier === tierNumber);
  }

  public getAllEvents(): CareerEventDefinition[] {
    return [...CAREER_EVENTS];
  }

  public isEventCompleted(eventId: string): boolean {
    return Boolean(this.data.completedEvents[eventId]);
  }

  public getEventRecord(eventId: string): CompletedEventRecord | undefined {
    return this.data.completedEvents[eventId];
  }

  public isTierUnlocked(tierNumber: number): boolean {
    const tierInfo = getTierInfo(tierNumber);
    return this.data.reputation >= tierInfo.requiredReputation;
  }

  public validateVehicleEligibility(
    event: CareerEventDefinition,
    vehicle: VehicleCatalogItem
  ): { eligible: boolean; reason?: string } {
    // 1. Ownership check
    if (!this.isVehicleOwned(vehicle.id)) {
      return {
        eligible: false,
        reason: `Vehicle Not Owned: You do not own the ${vehicle.name}. Please select an owned vehicle or purchase it in the Garage.`,
      };
    }

    // 2. Tier restriction check
    if (!event.eligibility.allowedTiers.includes(vehicle.tier)) {
      const allowedStr = event.eligibility.allowedTiers.map((t) => `Tier ${t}`).join(', ');
      return {
        eligible: false,
        reason: `Tier Ineligible: ${vehicle.name} (Tier ${vehicle.tier}) is not permitted. ${event.name} requires a ${allowedStr} chassis.`,
      };
    }

    // 3. Minimum handling index
    if (event.eligibility.minHandlingRating && vehicle.specs.handlingRating < event.eligibility.minHandlingRating) {
      return {
        eligible: false,
        reason: `Handling Rating Insufficient: ${vehicle.name} has handling rating ${vehicle.specs.handlingRating}, but this event requires ${event.eligibility.minHandlingRating}+.`,
      };
    }

    return { eligible: true };
  }

  // ==========================================
  // RACE COMPLETION & ATOMIC REWARD PROCESSOR
  // ==========================================

  public completeEvent(params: {
    eventId: string;
    resultValue: number; // Time or score
    positionRank?: number; // 1-4 for Sprint
    wallHits?: number;
    topSpeedKmh?: number;
    maxComboMultiplier?: number;
    sessionToken: string;
  }): EventCompletionResult {
    const { eventId, resultValue, positionRank, wallHits = 0, topSpeedKmh = 0, maxComboMultiplier = 1.0, sessionToken } = params;

    const event = getCareerEventById(eventId);
    if (!event) {
      throw new Error(`Career event ${eventId} not found.`);
    }

    // Exact-Once Guard: Check if this specific session token has already been rewarded
    if (this.data.lastRewardSessionToken === sessionToken) {
      const existing = this.data.completedEvents[eventId];
      return {
        isAlreadyRewarded: true,
        medal: existing?.medal || 'completed',
        baseCredits: 0,
        bonusCredits: 0,
        totalCredits: 0,
        reputationEarned: 0,
        isReplay: Boolean(existing),
        originalReputationReward: event.reputationReward,
        completedObjectives: [],
        newUnlockedEvents: [],
        newUnlockedVehicles: [],
      };
    }
    this.data.lastRewardSessionToken = sessionToken;

    // 1. Determine Medal
    let medal: CareerMedal = 'completed';
    if (event.mode === 'sprint') {
      if (positionRank === 1) medal = 'gold';
      else if (positionRank === 2) medal = 'silver';
      else if (positionRank === 3) medal = 'bronze';
      else medal = 'completed';
    } else if (event.mode === 'time_trial' && event.targetBenchmark) {
      if (resultValue <= event.targetBenchmark.gold) medal = 'gold';
      else if (resultValue <= event.targetBenchmark.silver) medal = 'silver';
      else if (resultValue <= event.targetBenchmark.bronze) medal = 'bronze';
      else medal = 'completed';
    } else if (event.mode === 'drift' && event.targetBenchmark) {
      if (resultValue >= event.targetBenchmark.gold) medal = 'gold';
      else if (resultValue >= event.targetBenchmark.silver) medal = 'silver';
      else if (resultValue >= event.targetBenchmark.bronze) medal = 'bronze';
      else medal = 'completed';
    }

    // 2. Base Credits from Reward Table
    const baseCredits = medal === 'completed' ? event.rewards.completion : event.rewards[medal];

    // 3. Evaluate Bonus Objectives
    const completedObjectives: { id: string; description: string; bonusCredits: number }[] = [];
    let bonusCredits = 0;

    for (const obj of event.objectives) {
      let satisfied = false;
      if (obj.id === 'first_place' && positionRank === 1) satisfied = true;
      else if (obj.id === 'clean_race' && wallHits === 0) satisfied = true;
      else if (obj.id === 'clean_drive' && wallHits === 0) satisfied = true;
      else if (obj.id === 'top_speed' && topSpeedKmh >= 170) satisfied = true;
      else if (obj.id === 'fast_lap' && topSpeedKmh >= 240) satisfied = true;
      else if (obj.id === 'beat_gold' && medal === 'gold') satisfied = true;
      else if (obj.id === 'target_score' && event.targetBenchmark && resultValue >= event.targetBenchmark.gold) satisfied = true;
      else if (obj.id === 'multiplier' && maxComboMultiplier >= 1.5) satisfied = true;
      else if (obj.id === 'combo' && maxComboMultiplier >= 1.8) satisfied = true;

      if (satisfied) {
        completedObjectives.push(obj);
        bonusCredits += obj.bonusCredits;
      }
    }

    const totalCredits = baseCredits + bonusCredits;
    const prevRecord = this.data.completedEvents[eventId];
    const isReplay = Boolean(prevRecord);
    const originalReputationReward = event.reputationReward;

    // 20% Reputation for Replayed Events: floor(original * 0.20)
    const reputationEarned = isReplay
      ? Math.floor(originalReputationReward * 0.20)
      : originalReputationReward;

    // 4. Update Balances
    this.data.credits += totalCredits;
    const previousTier = this.data.currentTier;
    this.data.reputation += reputationEarned;

    // 5. Commit Completed Event Record
    const isBetterResult =
      !prevRecord ||
      (event.mode === 'drift' ? resultValue > prevRecord.bestResult : resultValue < prevRecord.bestResult);

    this.data.completedEvents[eventId] = {
      eventId,
      completedAt: Date.now(),
      bestResult: isBetterResult ? resultValue : prevRecord.bestResult,
      bestPosition: positionRank !== undefined
        ? Math.min(positionRank, prevRecord?.bestPosition ?? positionRank)
        : undefined,
      medal: this.isHigherMedal(medal, prevRecord?.medal) ? medal : (prevRecord?.medal || medal),
      completedObjectives: Array.from(
        new Set([...(prevRecord?.completedObjectives || []), ...completedObjectives.map((o) => o.id)])
      ),
      attempts: (prevRecord?.attempts || 0) + 1,
      firstCompletionRewardClaimed: true,
    };

    // 6. Check New Unlocks
    const prevUnlockedCount = this.data.unlockedEventIds.length;
    this.refreshUnlocks();
    const newUnlockedEvents = this.data.unlockedEventIds.slice(prevUnlockedCount);

    let newUnlockedTier: CareerTierInfo | undefined;
    if (this.data.currentTier > previousTier) {
      newUnlockedTier = getTierInfo(this.data.currentTier);
    }

    // Check if any trophy vehicles are unlocked
    const newUnlockedVehicles: string[] = [];
    for (const v of VEHICLE_CATALOG) {
      if (v.unlock.method === 'career_trophy' && !this.isVehicleOwned(v.id)) {
        if (v.id === 'sanremo_70' && this.isEventCompleted('rookie_sprint_1')) {
          this.unlockVehicleReward(v.id);
          newUnlockedVehicles.push(v.name);
        } else if (v.id === 'apex_sport_coupe' && this.isEventCompleted('perf_sprint_1')) {
          this.unlockVehicleReward(v.id);
          newUnlockedVehicles.push(v.name);
        } else if (v.id === 'm3_gtr_gt2' && this.isEventCompleted('super_sprint_1')) {
          this.unlockVehicleReward(v.id);
          newUnlockedVehicles.push(v.name);
        }
      }
    }

    this.save();

    return {
      isAlreadyRewarded: false,
      medal,
      baseCredits,
      bonusCredits,
      totalCredits,
      reputationEarned,
      isReplay,
      originalReputationReward,
      completedObjectives,
      newUnlockedEvents,
      newUnlockedTier,
      newUnlockedVehicles,
    };
  }

  /**
   * Finds the earliest available, incomplete event in the intended career progression.
   * Scans tiers chronologically 1 through 5, and returns the first unlocked event
   * that has not yet been completed.
   */
  public getNextRecommendedEventId(): string | null {
    for (let t = 1; t <= 5; t++) {
      if (!this.isTierUnlocked(t)) continue;
      const tierEvents = getEventsByTier(t);
      for (const ev of tierEvents) {
        if (this.isEventUnlocked(ev.id) && !this.isEventCompleted(ev.id)) {
          return ev.id;
        }
      }
    }
    return null;
  }

  private isHigherMedal(a: CareerMedal, b?: CareerMedal): boolean {
    const RANK: Record<CareerMedal, number> = {
      gold: 4,
      silver: 3,
      bronze: 2,
      completed: 1,
    };
    return RANK[a] >= (b ? RANK[b] : 0);
  }

  public resetCareer(): void {
    this.data = this.getDefaultData();
    this.save();
  }
}

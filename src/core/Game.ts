import { SceneManager } from './SceneManager';
import { TrackLoader } from '../environment/TrackLoader';
import { Vehicle } from '../vehicle/Vehicle';
import { VehicleController } from '../vehicle/VehicleController';
import { InputManager } from '../input/InputManager';
import { LoadingScreen } from '../ui/LoadingScreen';
import { CheckpointManager } from '../checkpoints/CheckpointManager';
import { TrackCollision } from '../physics/TrackCollision';
import { RacingHUD } from '../ui/RacingHUD';
import { PauseMenu } from '../ui/PauseMenu';
import { MainMenu } from '../ui/MainMenu';
import { EventSelect } from '../ui/EventSelect';
import { GarageScreen } from '../ui/GarageScreen';
import { SettingsMenu } from '../ui/SettingsMenu';
import { FinishScreen } from '../ui/FinishScreen';
import { GameState } from './GameState';
import { SettingsManager } from '../settings/SettingsManager';
import { SoundManager } from '../audio/SoundManager';
import { TireFeedbackManager } from '../vehicle/TireFeedbackManager';
import { Vector3 } from '@babylonjs/core';
import { RaceEventConfig, DEFAULT_EVENT } from '../events/EventConfig';
import { DriftScoringManager } from '../drift/DriftScoringManager';
import { AIManager } from '../ai/AIManager';
import { AIDifficulty } from '../ai/AIOpponent';
import { VehicleCollision } from '../physics/VehicleCollision';
import { ReplayManager } from '../replay/ReplayManager';
import { getVehicleById } from '../vehicle/VehicleCatalog';
import { createHandlingProfile } from '../vehicle/VehicleHandlingProfile';
import { PhysicsDebugOverlay } from '../ui/PhysicsDebugOverlay';
import { CircuitDefinition } from '../tracks/TrackConfig';
import { ForestValleyCircuit } from '../tracks/ForestValleyCircuit';
import { CareerManager } from '../career/CareerManager';
import { CareerHub } from '../ui/CareerHub';
import { CareerResultsScreen } from '../ui/CareerResultsScreen';
import { CareerEventDefinition } from '../career/CareerConfig';
import { getCircuitById } from '../tracks/TrackRegistry';
import { MultiplayerManager } from '../multiplayer/MultiplayerManager';
import { requestFullscreenIfMobile } from '../utils/Fullscreen';
import { MenuNavigationManager } from '../ui/MenuNavigationManager';
import { PursuitManager } from '../events/PursuitManager';
import { AssetCacheManager } from './AssetCacheManager';
import { EliminationManager } from '../events/EliminationManager';
import { SpeedTrapManager } from '../events/SpeedTrapManager';

export class Game {
  public sceneManager: SceneManager;
  public trackLoader: TrackLoader;
  public currentCircuit: CircuitDefinition = ForestValleyCircuit;
  public vehicle: Vehicle;
  public vehicleController: VehicleController | null = null;
  public tireFeedbackManager: TireFeedbackManager | null = null;
  public inputManager: InputManager;
  public loadingScreen: LoadingScreen;
  public checkpointManager: CheckpointManager;
  public trackCollision: TrackCollision;
  public racingHUD: RacingHUD;
  public pauseMenu: PauseMenu;
  public mainMenu: MainMenu;
  public eventSelect: EventSelect;
  public garageScreen: GarageScreen;
  public settingsMenu: SettingsMenu;
  public finishScreen: FinishScreen;
  public settingsManager: SettingsManager;
  public soundManager: SoundManager;
  public driftScoringManager: DriftScoringManager;
  public pursuitManager: PursuitManager;
  public eliminationManager: EliminationManager;
  public speedTrapManager: SpeedTrapManager;
  public aiManager: AIManager;
  public replayManager: ReplayManager;
  public physicsDebugOverlay: PhysicsDebugOverlay;
  public careerManager: CareerManager;
  public careerHub: CareerHub;
  public careerResultsScreen: CareerResultsScreen;
  public multiplayerManager: MultiplayerManager;
  public menuNavigator: MenuNavigationManager;

  // Career Session state
  public isCareerSession: boolean = false;
  public activeCareerEvent: CareerEventDefinition | null = null;
  private careerSessionToken: string = '';
  private careerWallCollisions: number = 0;
  private careerMaxSpeedKmh: number = 0;
  private isReturningFromCareerRace: boolean = false;

  // Active event configuration
  public currentEvent: RaceEventConfig = DEFAULT_EVENT;

  // Race state machine
  public state: GameState = GameState.Loading;
  public raceTimeSeconds: number = 0;
  public isPaused: boolean = false;
  public isRacing: boolean = false;
  private isRunning: boolean = false;
  private countdownTimeouts: number[] = [];

  // Cinematic & Replay state
  private countdownElapsed: number = 0;
  private isGridSweepActive: boolean = false;
  private finishCinematicElapsed: number = 0;
  private isFinishSweepActive: boolean = false;
  private cachedFinishPositionDisplay?: string;
  private cachedFinishRankNumber: number = 1;
  private currentLiveRank: number = 1;
  private currentLiveRankFormatted: string = '1ST';
  private currentLiveTotalRacers: number = 4;
  private cachedResultValue: number = 0;
  private playerClosestWpIndex: number = 0;

  // Debug HUD elements
  private fpsElement: HTMLElement | null = null;
  private carInfoElement: HTMLElement | null = null;
  private cameraModeElement: HTMLElement | null = null;
  private settingsReturnState: GameState = GameState.MainMenu;
  private garageReturnState: GameState = GameState.MainMenu;
  private prevPlayerThrottle: number = 0;

  constructor() {
    this.loadingScreen = new LoadingScreen();
    this.sceneManager = new SceneManager('renderCanvas');
    this.trackLoader = new TrackLoader(this.sceneManager.scene);
    this.vehicle = new Vehicle(this.sceneManager.scene);
    this.inputManager = new InputManager();
    this.checkpointManager = new CheckpointManager(this.sceneManager.scene);
    this.trackCollision = new TrackCollision();
    this.racingHUD = new RacingHUD();
    this.settingsManager = new SettingsManager();
    const settings = this.settingsManager.getSettings();
    this.inputManager.setControlScheme(settings.mobileControlScheme || 'buttons');
    this.inputManager.setTouchScale(settings.touchControlScale ?? 1.0);
    this.soundManager = new SoundManager(
      settings.masterVolume,
      settings.engineVolume,
      settings.effectsVolume,
      settings.isMuted,
      settings.musicVolume
    );
    this.driftScoringManager = new DriftScoringManager();
    this.pursuitManager = new PursuitManager(this.sceneManager.scene, this.soundManager);
    this.eliminationManager = new EliminationManager(this.soundManager);
    this.speedTrapManager = new SpeedTrapManager(this.soundManager);
    this.aiManager = new AIManager(this.sceneManager.scene);
    this.replayManager = new ReplayManager(this.sceneManager.scene, this.soundManager);
    this.physicsDebugOverlay = new PhysicsDebugOverlay();
    this.careerManager = CareerManager.getInstance();

    // Career Results Screen
    this.careerResultsScreen = new CareerResultsScreen({
      onContinue: () => {
        this.soundManager.playUISelect();
        this.openCareerHub(true);
      },
      onRetry: () => {
        this.soundManager.playUISelect();
        if (this.activeCareerEvent) {
          this.startCareerEvent(this.activeCareerEvent);
        } else {
          this.restartRace();
        }
      },
      onWatchReplay: () => {
        this.startReplay();
      },
    });

    // Career Hub
    this.careerHub = new CareerHub({
      onStartEvent: (event) => {
        this.startCareerEvent(event);
      },
      onOpenGarage: () => {
        this.soundManager.playUIClick();
        this.openGarage(GameState.CareerHub);
      },
      onBack: () => {
        this.soundManager.playUIClick();
        this.returnToMenu();
      },
    });

    // LAN Multiplayer Manager
    this.multiplayerManager = new MultiplayerManager(this.sceneManager.scene, {
      onStartRaceCountdown: async (circuit, mode, lapCount) => {
        this.soundManager.playUISelect();
        await this.ensureCircuitLoaded(circuit);
        const myLobbyEntry = this.multiplayerManager.connectedPlayers.find(
          p => p.id === this.multiplayerManager.selfPlayerId
        );
        if (myLobbyEntry) {
          await this.syncSelectedVehicle(myLobbyEntry.vehicleId);
        }

        const mpEvent: RaceEventConfig = {
          id: `mp_${circuit.id}_${mode}`,
          mode: mode === 'sprint' ? 'sprint' : 'time_trial',
          name: `${circuit.name} LAN GP`,
          subtitle: `Multiplayer • ${mode.toUpperCase()} RACE`,
          badgeText: 'LAN MULTIPLAYER',
          lapsBadge: mode === 'sprint' ? 'POINT TO POINT' : `${lapCount} LAP`,
          description: 'Real-time LAN multiplayer racing.',
          specs: {
            length: `${circuit.measuredLengthMeters} M`,
            sectors: `${circuit.checkpoints.length} GATES`,
            surface: circuit.surface,
          },
          startPosition: circuit.startPosition,
          startYaw: circuit.startYaw,
          checkpointIds: circuit.checkpoints.map(c => c.id),
          finishCheckpointId: mode === 'sprint' ? 'CP_4_CAROUSEL_SHOOT' : circuit.checkpoints[0].id,
          mapType: mode === 'sprint' ? 'sprint' : 'loop',
        };

        this.currentEvent = mpEvent;
        this.isCareerSession = false;
        this.activeCareerEvent = null;

        // Position local car at assigned grid slot
        const mySlot = this.multiplayerManager.gridAssignments[this.multiplayerManager.selfPlayerId] || 1;
        const tf = this.multiplayerManager.getGridSlotTransform(mySlot);
        this.vehicleController?.resetTo(tf.position, tf.yaw);
        this.sceneManager.resetCameras(tf.position, tf.yaw);

        this.startCountdown(mpEvent, 'normal');
      },
      onRaceFinished: () => {
        this.setGameState(GameState.MultiplayerResults);
      },
      onReturnToMainMenu: () => {
        this.returnToMenu();
      },
      triggerSound: (s) => {
        if (s === 'select') this.soundManager.playUISelect();
        else if (s === 'click') this.soundManager.playUIClick();
        else if (s === 'finish') this.soundManager.playFinishCelebration();
      },
    });

    // Pause Menu (Strict 4-tier hierarchy)
    this.pauseMenu = new PauseMenu({
      onResume: () => {
        this.soundManager.playResume();
        this.resume();
      },
      onRestart: () => {
        if (this.multiplayerManager?.isActive) return;
        this.soundManager.playUISelect();
        this.restartRace();
      },
      onSettings: () => {
        this.soundManager.playUIClick();
        this.settingsReturnState = GameState.Paused;
        this.openSettings();
      },
      onReturnToMenu: () => {
        this.soundManager.playUIClick();
        this.returnToMenu();
      },
      onReturnToStart: () => {
        if (this.multiplayerManager?.isActive) return;
        this.soundManager.playUISelect();
        this.returnToStartLine();
      },
    });

    // Main Menu
    this.mainMenu = new MainMenu({
      onCareer: () => {
        this.soundManager.playUISelect();
        this.openCareerHub();
      },
      onPlay: () => {
        this.soundManager.playUISelect();
        this.openEventSelect();
      },
      onMultiplayer: () => {
        this.soundManager.playUISelect();
        this.openMultiplayer();
      },
      onGarage: () => {
        this.soundManager.playUIClick();
        this.openGarage(GameState.MainMenu);
      },
      onSettings: () => {
        this.soundManager.playUIClick();
        this.settingsReturnState = GameState.MainMenu;
        this.openSettings();
      },
      onExit: () => this.exitGame(),
    });

    // Garage Screen (Full-Screen Showroom & Customization)
    this.garageScreen = new GarageScreen(
      {
        onBack: () => {
          this.soundManager.playUIClick();
          if (this.isCareerSession || this.garageReturnState === GameState.CareerHub) {
            this.openCareerHub();
          } else if (this.garageReturnState === GameState.EventSelect) {
            this.openEventSelect();
          } else {
            this.returnToMenu();
          }
        },
        onProceedToRace: () => {
          this.soundManager.playUISelect();
          if (this.isCareerSession) {
            this.openCareerHub();
          } else {
            this.openEventSelect();
          }
        },
        onSelectPaint: (paint) => {
          this.soundManager.playUISelect();
          this.vehicle.applyPaint(paint);
          this.settingsManager.setVehiclePaintId(paint.id);
        },
        onSelectVehicle: async (vehicleItem) => {
          this.soundManager.playUISelect();
          this.settingsManager.setSelectedVehicleId(vehicleItem.id);
          this.careerManager.setSelectedVehicleId(vehicleItem.id);
          await this.syncSelectedVehicle(vehicleItem.id);
        },
        onUpgradeVehicle: (vehicleItem) => {
          this.soundManager.playUISelect();
          if (this.vehicleController && this.settingsManager.getSelectedVehicleId() === vehicleItem.id) {
            const effectiveSpecs = this.careerManager.getEffectiveVehicleSpecs(vehicleItem.id) || vehicleItem.specs;
            const profile = createHandlingProfile(effectiveSpecs, vehicleItem.id, vehicleItem.name, vehicleItem.tier);
            this.vehicleController.applyHandlingProfile(profile);
          }
        },
      },
      this.settingsManager.getVehiclePaintId(),
      this.settingsManager.getSelectedVehicleId()
    );

    // Event Select
    this.eventSelect = new EventSelect({
      onStartEvent: async (event, difficulty, circuit) => {
        this.soundManager.playUISelect();
        this.isCareerSession = false;
        this.activeCareerEvent = null;
        this.currentEvent = event;
        await this.ensureCircuitLoaded(circuit);
        this.startCountdown(event, difficulty);
      },
      onBack: () => {
        this.soundManager.playUIClick();
        this.returnToMenu();
      },
      onOpenGarage: () => {
        this.soundManager.playUIClick();
        this.openGarage(GameState.EventSelect);
      },
      onSelectVehicle: async (vehicleId) => {
        this.soundManager.playUISelect();
        this.settingsManager.setSelectedVehicleId(vehicleId);
        this.careerManager.setSelectedVehicleId(vehicleId);
        await this.syncSelectedVehicle(vehicleId);
      },
    });

    // Settings Menu
    this.settingsMenu = new SettingsMenu(this.settingsManager, {
      onQualityChange: (quality) => {
        this.soundManager.playUISelect();
        this.settingsManager.setGraphicsQuality(quality);
        this.sceneManager.applyGraphicsQuality(quality);
      },
      onVolumeChange: (vol) => {
        this.settingsManager.setMasterVolume(vol);
        this.soundManager.setMasterVolume(vol);
      },
      onEngineVolumeChange: (vol) => {
        this.settingsManager.setEngineVolume(vol);
        this.soundManager.setEngineVolume(vol);
      },
      onEffectsVolumeChange: (vol) => {
        this.settingsManager.setEffectsVolume(vol);
        this.soundManager.setEffectsVolume(vol);
      },
      onMusicVolumeChange: (vol) => {
        this.settingsManager.setMusicVolume(vol);
        this.soundManager.setMusicVolume(vol);
      },
      onMuteToggle: (isMuted) => {
        this.settingsManager.setMuted(isMuted);
        this.soundManager.setMuted(isMuted);
      },
      onControlSchemeChange: (scheme) => {
        this.soundManager.playUISelect();
        this.settingsManager.setMobileControlScheme(scheme);
        this.inputManager.setControlScheme(scheme);
      },
      onTouchScaleChange: (scale) => {
        this.settingsManager.setTouchControlScale(scale);
        this.inputManager.setTouchScale(scale);
      },
      onBack: () => {
        this.soundManager.playUIClick();
        this.setGameState(this.settingsReturnState);
      },
    });

    // Finish Screen
    this.finishScreen = new FinishScreen({
      onRetry: () => this.restartRace(),
      onWatchReplay: () => this.startReplay(),
      onEventSelect: () => this.openEventSelect(),
      onReturnToMenu: () => this.returnToMenu(),
    });

    // Checkpoint completion handlers
    this.checkpointManager.onCheckpointCrossed = (cp) => {
      if (this.state === GameState.Racing && this.vehicleController) {
        if (this.currentEvent.mode === 'speed_trap') {
          const speedKmh = Math.abs(this.vehicleController.forwardSpeed * 3.6);
          this.speedTrapManager.onCheckpointCrossed(cp.id, speedKmh);
        }
      }
    };

    this.checkpointManager.onLapCompleted = (completedLap: number) => {
      if (this.state === GameState.Racing) {
        const targetLaps = this.getTargetLapsForEvent(this.currentEvent);
        if (completedLap >= targetLaps) {
          if (this.currentEvent.mode === 'time_trial') {
            const finalRank = this.aiManager.notifyRacerFinished('player', this.raceTimeSeconds, true);
            this.cachedFinishRankNumber = finalRank;
            const rankSuffixes = ['1ST', '2ND', '3RD', '4TH'];
            const suffix = rankSuffixes[finalRank - 1] || `${finalRank}TH`;
            const totalRacers = this.aiManager.opponents.length + 1;
            this.cachedFinishPositionDisplay = `${suffix} PLACE / ${totalRacers} DRIVERS`;
            this.finishRace();
          } else if (this.currentEvent.mode === 'speed_trap') {
            this.finishRace(this.speedTrapManager.getAggregateSpeed());
          }
        }
      }
    };

    this.checkpointManager.onSprintCompleted = () => {
      if (this.state === GameState.Racing && this.currentEvent.mode === 'sprint') {
        const finalRank = this.aiManager.notifyRacerFinished('player', this.raceTimeSeconds, true);
        this.cachedFinishRankNumber = finalRank;
        const rankSuffixes = ['1ST', '2ND', '3RD', '4TH'];
        const suffix = rankSuffixes[finalRank - 1] || `${finalRank}TH`;
        const totalRacers = this.aiManager.opponents.length + 1;
        this.cachedFinishPositionDisplay = `${suffix} PLACE / ${totalRacers} DRIVERS`;
        this.finishRace();
      }
    };

    this.driftScoringManager.onSessionCompleted = (finalScore) => {
      if (this.state === GameState.Racing && this.currentEvent.mode === 'drift') {
        this.finishRace(finalScore);
      }
    };

    this.fpsElement = document.getElementById('fps-counter');
    this.carInfoElement = document.getElementById('car-info');
    this.cameraModeElement = document.getElementById('camera-mode');

    // Universal controller & keyboard menu navigation manager
    this.menuNavigator = new MenuNavigationManager(this.soundManager);

    // Apply saved graphics quality
    this.sceneManager.applyGraphicsQuality(this.settingsManager.getSettings().graphicsQuality);
  }

  public async start(): Promise<void> {
    try {
      this.setGameState(GameState.Loading);
      this.currentCircuit = ForestValleyCircuit;
      this.loadingScreen.setProgress(10, `Assembling ${this.currentCircuit.name}...`);
      await this.trackLoader.loadCircuit(this.currentCircuit, (progress) => {
        this.loadingScreen.setProgress(10 + progress * 45, `Loading track sections... ${Math.round(progress * 100)}%`);
      });

      this.sceneManager.applyTrackEnvironment(this.currentCircuit.environment);
      this.checkpointManager.registerCheckpoints(this.trackLoader.checkpoints);
      this.aiManager.setCircuit(this.currentCircuit);
      this.trackCollision.setCircuit(this.currentCircuit);

      const selectedId = this.settingsManager.getSelectedVehicleId();
      const catalogItem = getVehicleById(selectedId);
      const vehicleFile = catalogItem ? catalogItem.fileName : 'APX01.glb';
      this.loadingScreen.setProgress(60, `Loading vehicle ${catalogItem ? catalogItem.name : 'APX-01'}...`);
      const carStartPos = this.trackLoader.startPosition;
      const initialYaw = 0; // Forward along +Z down main straight

      const savedPaint = catalogItem ? this.careerManager.getVehiclePaint(catalogItem.id) : this.settingsManager.getVehiclePaintId();
      const metadata = await this.vehicle.load(
        vehicleFile,
        carStartPos,
        initialYaw,
        savedPaint,
        catalogItem?.yawOffset || 0
      );
      this.sceneManager.addShadowCaster(this.vehicle.modelContainer);

      this.loadingScreen.setProgress(75, 'Deploying AI racing fleet...');
      await this.aiManager.loadOpponents();
      this.aiManager.setCircuit(this.currentCircuit);
      for (const opp of this.aiManager.opponents) {
        if (opp.vehicle && opp.vehicle.modelContainer) {
          this.sceneManager.addShadowCaster(opp.vehicle.modelContainer);
        }
      }
      this.aiManager.hideOpponents();

      // Preload Fairheaven police interceptor cruiser for pursuit events
      await this.pursuitManager.loadCopCruiser();

      this.vehicleController = new VehicleController(carStartPos, initialYaw);
      if (catalogItem) {
        const effectiveSpecs = this.careerManager.getEffectiveVehicleSpecs(catalogItem.id) || catalogItem.specs;
        const profile = createHandlingProfile(effectiveSpecs, catalogItem.id, catalogItem.name, catalogItem.tier);
        this.vehicleController.applyHandlingProfile(profile);
      }
      this.vehicleController.roadSurfaceY = this.trackLoader.roadSurfaceY;
      this.trackCollision.roadSurfaceY = this.trackLoader.roadSurfaceY;

      this.sceneManager.initChaseCamera(carStartPos, initialYaw);
      const initialPrefCam = this.settingsManager.getSettings().preferredCameraMode || 'chase';
      this.sceneManager.setCameraMode(initialPrefCam);
      this.tireFeedbackManager = new TireFeedbackManager(
        this.sceneManager.scene,
        this.trackLoader.roadSurfaceY
      );

      this.loadingScreen.setProgress(90, 'Setting up cameras & motorsport HUD...');

      if (this.carInfoElement) {
        const specsText = catalogItem
          ? `${catalogItem.specs.drivetrain} • ${catalogItem.specs.powerHp}HP • ${catalogItem.specs.weightKg}kg • Hand: ${catalogItem.specs.handlingRating}`
          : '';
        this.carInfoElement.innerHTML = `
          Vehicle: <strong>${catalogItem ? catalogItem.name : metadata.fileName} (${specsText})</strong> |
          Course: <strong>${this.currentCircuit.name} (${this.currentCircuit.measuredLengthMeters}m, ${this.currentCircuit.tileCount} Tiles)</strong> |
          Triangles: <strong>${metadata.totalTriangles.toLocaleString()}</strong>
        `;
      }

      if (this.cameraModeElement) {
        this.cameraModeElement.textContent = `Camera: ${initialPrefCam.toUpperCase()} VIEW`;
      }

      this.loadingScreen.setProgress(100, 'Ready');
      setTimeout(() => {
        this.loadingScreen.hide();
        // Transition to Main Menu upon boot
        this.setGameState(GameState.MainMenu);
        // Persist 3D assets, textures, and models to local browser cache storage for instant subsequent loads
        AssetCacheManager.getInstance().preloadAssetsInBackground();
      }, 300);

      // Window-level user gesture unlock for Web Audio & Mobile Fullscreen
      const unlockAudio = () => {
        this.soundManager.initContext();
        requestFullscreenIfMobile();
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });

      this.isRunning = true;
      let frameCount = 0;
      let lastFpsUpdate = performance.now();

      this.sceneManager.engine.runRenderLoop(() => {
        if (!this.isRunning || !this.vehicleController) return;

        const dt = this.sceneManager.engine.getDeltaTime() / 1000.0;

        // Input handling & pause check
        if (this.inputManager.consumePause()) {
          this.togglePause();
        }

        // Camera mode toggle via C (cycles angles during replay, presets during gameplay)
        if (this.inputManager.consumeToggleCamera()) {
          if (this.state === GameState.Replay) {
            this.replayManager.cycleCamera();
          } else {
            const newMode = this.sceneManager.cycleGameplayCamera();
            this.settingsManager.setPreferredCameraMode(newMode);
            this.soundManager.playCameraSwitch();
            if (this.cameraModeElement) {
              this.cameraModeElement.textContent = `Camera: ${newMode.toUpperCase()} VIEW`;
            }
          }
        }

        const activeGamepad = this.inputManager.gamepadManager.getActiveGamepad();

        // Universal Menu Navigation update across all menu overlays
        if (this.state !== GameState.Racing && this.state !== GameState.Countdown) {
          this.menuNavigator.update(dt, activeGamepad);
        }

        // State Machine Execution
        switch (this.state) {
          case GameState.MainMenu:
          case GameState.EventSelect:
          case GameState.Settings:
            // Silence engine during menu screens
            this.soundManager.updateEngine(0, 0, 0, false);
            this.soundManager.updateTires(0, 0, 0, false);
            this.sceneManager.updateMenuCamera(this.vehicleController.position, dt);
            break;

          case GameState.Garage:
          case GameState.CareerHub: {
            // Silence engine in showroom & career hub turntable
            this.soundManager.updateEngine(0, 0, 0, false);
            this.soundManager.updateTires(0, 0, 0, false);
            const rightStickX = activeGamepad ? (activeGamepad.axes[2] ?? 0) : 0;
            this.sceneManager.updateGarageCamera(dt, rightStickX);
            if (activeGamepad && this.state === GameState.Garage) {
              this.garageScreen.updateGamepadInput(activeGamepad, dt);
            }
            break;
          }

          case GameState.Countdown:
            this.countdownElapsed += dt;
            const sweepProgress = Math.min(1.0, this.countdownElapsed / 3.0);

            // Check if user pressed any driving key to skip sweep early
            if (this.isGridSweepActive && this.inputManager.hasDrivingInput()) {
              this.isGridSweepActive = false;
              const pref = this.settingsManager.getSettings().preferredCameraMode || 'chase';
              this.sceneManager.restoreGameplayCamera(pref);
            }

            if (this.isGridSweepActive) {
              this.sceneManager.updateGridSweep(
                sweepProgress,
                this.vehicleController.position,
                this.vehicleController.yawAngle
              );
            } else {
              this.sceneManager.updateChaseCamera(
                this.vehicleController.position,
                this.vehicleController.yawAngle,
                0,
                0,
                0,
                dt
              );
            }

            // Vehicle inputs are strictly locked; engine idles on grid
            this.soundManager.updateEngine(1050, 0, 0, true);
            this.soundManager.updateTires(0, 0, 0, false);
            this.vehicle.applyTransform(this.vehicleController.position, this.vehicleController.yawAngle);
            this.vehicle.resetBodyMotion();
            this.tireFeedbackManager?.reset();
            this.aiManager.update(dt, false, this.isPaused, this.vehicleController);

            if (this.multiplayerManager?.isActive) {
              this.multiplayerManager.update(dt, this.vehicleController, {
                forward: false,
                backward: false,
                steerLeft: false,
                steerRight: false,
                handbrake: false,
                boost: false,
                reset: false,
                toggleCamera: false,
                pause: false,
              });
            }
            break;

          case GameState.Racing: {
            const inputState = this.inputManager.getState();
            this.raceTimeSeconds += dt;

            // Handle manual car reset (R)
            if (this.inputManager.consumeReset()) {
              const resetTarget = this.checkpointManager.getLatestResetTransform();
              this.vehicleController.resetTo(resetTarget.position, resetTarget.yaw);
              this.sceneManager.resetCameras(this.vehicleController.position, this.vehicleController.yawAngle);
              this.vehicle.resetBodyMotion();
              this.tireFeedbackManager?.reset();
              if (this.currentEvent.mode === 'drift') {
                this.driftScoringManager.onOutOfBoundsReset();
              }
            }

            const prevPos = this.vehicleController.position.clone();

            // Vehicle physics update
            this.vehicleController.update(dt, inputState);

            // Controller rumble feedback for nitro boost & extreme drift slip
            if (this.vehicleController.isBoosting) {
              this.inputManager.triggerHaptic(0.35, 0.15, 60);
            } else if (Math.abs(this.vehicleController.lateralSpeed) > 3.2) {
              this.inputManager.triggerHaptic(0.2, 0.05, 50);
            }

            // AI Opponents update
            this.aiManager.update(
              dt,
              true,
              this.isPaused,
              this.vehicleController
            );

            // Record frame for replay system
            this.replayManager.recordFrame(dt, this.vehicleController, this.aiManager.opponents);

            // Multiplayer network update & remote vehicle interpolation & solid body collision
            if (this.multiplayerManager?.isActive) {
              this.multiplayerManager.update(dt, this.vehicleController, inputState, true, (impactSpeed) => {
                this.soundManager.playCollisionImpact(impactSpeed);
                this.sceneManager.triggerCameraShake(Math.min(0.9, impactSpeed * 0.12));
                this.inputManager.triggerHaptic(0.4, Math.min(1.0, impactSpeed * 0.15), 180);
              });
            }

            // Solid body vehicle-to-vehicle collision resolution (player vs AI and AI vs AI)
            if (this.aiManager.isEnabled) {
              VehicleCollision.resolveAll(
                this.vehicleController,
                this.aiManager.opponents,
                (hit) => {
                  this.soundManager.playCollisionImpact(hit.impactSpeed);
                  this.sceneManager.triggerCameraShake(Math.min(0.9, hit.impactSpeed * 0.12));
                  this.inputManager.triggerHaptic(0.4, Math.min(1.0, hit.impactSpeed * 0.15), 180);
                  if (this.currentEvent.mode === 'drift') {
                    this.driftScoringManager.onCollision(hit.impactSpeed);
                  }
                }
              );
            }

            // Track collision & barrier response
            const collisionResult = this.trackCollision.resolveCollision(this.vehicleController);
            if (collisionResult.deflectionApplied) {
              this.sceneManager.triggerCameraShake(0.85);
              this.inputManager.triggerHaptic(0.45, 0.75, 200);
              if (this.isCareerSession) {
                this.careerWallCollisions++;
              }
              if (this.currentEvent.mode === 'drift') {
                this.driftScoringManager.onCollision(2.0);
              }
            }

            // Career metrics update
            if (this.isCareerSession && this.vehicleController) {
              const speedKmh = Math.abs(this.vehicleController.forwardSpeed * 3.6);
              if (speedKmh > this.careerMaxSpeedKmh) {
                this.careerMaxSpeedKmh = speedKmh;
              }
            }

            // Out-of-bounds auto recovery
            if (collisionResult.isOutOfBounds) {
              const resetTarget = this.checkpointManager.getLatestResetTransform();
              this.vehicleController.resetTo(resetTarget.position, resetTarget.yaw);
              this.sceneManager.resetCameras(this.vehicleController.position, this.vehicleController.yawAngle);
              this.vehicle.resetBodyMotion();
              this.tireFeedbackManager?.reset();
              if (this.currentEvent.mode === 'drift') {
                this.driftScoringManager.onOutOfBoundsReset();
              }
            }

            // Checkpoint crossing check
            this.checkpointManager.update(prevPos, this.vehicleController.position);

            // Drift Challenge scoring update
            if (this.currentEvent.mode === 'drift') {
              this.driftScoringManager.update(
                dt,
                this.vehicleController.getTelemetry(),
                this.vehicleController.yawRate
              );
            }

            // Apply transforms, wheel animations & visual suspension body motion
            this.vehicle.applyTransform(this.vehicleController.position, this.vehicleController.yawAngle);
            this.vehicle.updateWheels(
              this.vehicleController.wheelSpinAngle,
              this.vehicleController.steeringAngle
            );
            this.vehicle.updateBodyMotion(
              dt,
              this.vehicleController.forwardAcceleration,
              this.vehicleController.lateralAcceleration
            );

            // Dynamic tire feedback (smoke particles & skid ribbons)
            this.tireFeedbackManager?.update(dt, this.vehicle, this.vehicleController, true);

            // Chase camera update with steering cornering lead
            this.sceneManager.updateChaseCamera(
              this.vehicleController.position,
              this.vehicleController.yawAngle,
              this.vehicleController.forwardSpeed * this.vehicleController.speedScale,
              this.vehicleController.lateralSpeed * this.vehicleController.speedScale,
              this.vehicleController.steeringAngle,
              dt
            );

            // Real-time procedural engine synthesis & tire audio
            this.soundManager.updateEngine(
              this.vehicleController.engineRpm,
              this.vehicleController.throttleLoad,
              this.vehicleController.forwardSpeed * 3.6,
              true
            );

            this.soundManager.updateTires(
              this.vehicleController.slipAngle,
              this.vehicleController.lateralSpeed,
              this.vehicleController.forwardSpeed,
              true
            );

            // Aerodynamic high-speed wind rush
            this.soundManager.updateWindRush(this.vehicleController.forwardSpeed, true);

            // Turbo Blow-Off Valve (BOV) flutter on high-RPM throttle lift ('stututu')
            const currThrottle = this.vehicleController.throttleLoad;
            const throttleDrop = this.prevPlayerThrottle - currThrottle;
            if (throttleDrop > 0.38 && this.vehicleController.engineRpm > 3600) {
              const boostIntensity = Math.min(1.4, (this.vehicleController.engineRpm - 2800) / 2400);
              this.soundManager.playTurboBlowOff(boostIntensity);
            }
            this.prevPlayerThrottle = currThrottle;

            // Spatial AI Opponent 3D Engine Audio
            if (this.aiManager.isEnabled && this.aiManager.opponents.length > 0) {
              this.soundManager.updateOpponentsAudio(
                {
                  x: this.vehicleController.position.x,
                  z: this.vehicleController.position.z,
                  yaw: this.vehicleController.yawAngle,
                },
                this.aiManager.opponents.map((o) => ({
                  position: { x: o.position.x, z: o.position.z },
                  forwardSpeed: o.forwardSpeed,
                })),
                true
              );
            }

            // Dynamic music intensity scaling with speed
            const speedRatio = Math.min(1.0, (this.vehicleController.forwardSpeed * 3.6) / 260.0);
            this.soundManager.setMusicIntensity(0.4 + speedRatio * 0.6);

            // Gear shift acoustic trigger
            if (this.vehicleController.didShiftThisFrame) {
              this.soundManager.playGearShift(this.vehicleController.currentGear);
            }

            // Compute player progress distance & relative grid ranking
            const playerWp = this.aiManager.waypointManager.findClosestWaypoint(
              this.vehicleController.position,
              this.playerClosestWpIndex
            );
            this.playerClosestWpIndex = playerWp.index;
            let playerProgress = this.aiManager.waypointManager.getProgressDistance(
              this.vehicleController.position,
              this.checkpointManager.lapCount + 1,
              this.playerClosestWpIndex
            );
            // On Lap 1 before crossing CP_1, if player is slightly behind the start line, clamp progress to 0
            if (this.checkpointManager.lapCount === 0 && this.checkpointManager.currentCheckpointIndex === 0) {
              const trackDist = this.aiManager.waypointManager.getTrackDistance(
                this.vehicleController.position,
                this.playerClosestWpIndex
              );
              if (trackDist > this.aiManager.waypointManager.trackLength * 0.80) {
                playerProgress = 0;
              }
            }
            const rankInfo = this.aiManager.getPlayerRank(playerProgress);

            // Mode-specific rules and win/loss resolution
            if (this.currentEvent.mode === 'elimination') {
              const elimResult = this.eliminationManager.update(dt, rankInfo.rank, this.aiManager.opponents);
              if (elimResult.playerEliminated) {
                this.cachedFinishPositionDisplay = `ELIMINATED • FINISHED ${rankInfo.rankFormatted} OF ${this.aiManager.opponents.length + 1}`;
                this.finishRace(this.raceTimeSeconds);
              } else if (elimResult.playerWon) {
                this.cachedFinishPositionDisplay = '1ST PLACE • ELIMINATION CHAMPION!';
                this.finishRace(this.raceTimeSeconds);
              }
            } else if (this.currentEvent.mode === 'pursuit') {
              const pursuitResult = this.pursuitManager.update(dt, this.vehicleController, this.currentCircuit);
              if (pursuitResult.isBusted) {
                this.cachedFinishPositionDisplay = 'BUSTED! VEHICLE IMPOUNDED';
                this.finishRace(this.raceTimeSeconds);
              } else if (pursuitResult.isEscaped) {
                this.cachedFinishPositionDisplay = 'ESCAPED! PATROL LOCK BROKEN';
                this.finishRace(this.raceTimeSeconds);
              }
            } else if (this.currentEvent.mode === 'speed_trap') {
              this.speedTrapManager.update(dt);
              if (this.speedTrapManager.isAllTrapsCompleted() && this.checkpointManager.lapCount >= 1) {
                this.cachedFinishPositionDisplay = `RADAR GATES CLEARED • ${Math.round(this.speedTrapManager.getAggregateSpeed())} KM/H`;
                this.finishRace(this.speedTrapManager.getAggregateSpeed());
              }
            }

            let posRank = rankInfo.rankFormatted;
            let posTotal = `/ ${rankInfo.totalRacers}`;
            if (this.multiplayerManager?.isActive) {
              const totalMpRacers =
                this.multiplayerManager.connectedPlayers.length +
                (this.multiplayerManager.activeRoomConfig?.fillWithAI
                  ? Math.max(0, 4 - this.multiplayerManager.connectedPlayers.length)
                  : 0);
              posRank = this.getMultiplayerRank();
              posTotal = `/ ${totalMpRacers}`;
              this.currentLiveRank = parseInt(posRank) || 1;
              this.currentLiveRankFormatted = posRank;
              this.currentLiveTotalRacers = totalMpRacers;
            } else {
              this.currentLiveRank = rankInfo.rank;
              this.currentLiveRankFormatted = rankInfo.rankFormatted;
              this.currentLiveTotalRacers = rankInfo.totalRacers;
            }

            // HUD update
            this.racingHUD.update({
              telemetry: this.vehicleController.getTelemetry(),
              currentGate: this.checkpointManager.getCurrentGateNumber(),
              totalGates: this.checkpointManager.getTotalGates(),
              lap: this.checkpointManager.lapCount + 1,
              totalLaps: this.getTargetLapsForEvent(this.currentEvent),
              raceTimeSeconds: this.raceTimeSeconds,
              mode: this.currentEvent.mode,
              positionRank: posRank,
              positionTotal: posTotal,
              showPosition: this.aiManager.isEnabled || (this.multiplayerManager?.isActive ?? false),
              driftTelemetry:
                this.currentEvent.mode === 'drift'
                  ? this.driftScoringManager.getTelemetry()
                  : undefined,
              eliminationTelemetry:
                this.currentEvent.mode === 'elimination'
                  ? this.eliminationManager.getTelemetry()
                  : undefined,
              pursuitTelemetry:
                this.currentEvent.mode === 'pursuit'
                  ? this.pursuitManager.getTelemetry(this.vehicleController.position)
                  : undefined,
              speedTrapTelemetry:
                this.currentEvent.mode === 'speed_trap'
                  ? this.speedTrapManager.getTelemetry()
                  : undefined,
            });
            break;
          }

          case GameState.Paused:
            // Simulation is frozen. Suppress audio & tire emission.
            this.soundManager.updateEngine(0, 0, 0, false);
            this.soundManager.updateTires(0, 0, 0, false);
            this.soundManager.updateWindRush(0, false);
            this.soundManager.updateOpponentsAudio({ x: 0, z: 0, yaw: 0 }, [], false);
            this.tireFeedbackManager?.update(dt, this.vehicle, this.vehicleController, false);
            if (this.multiplayerManager?.isActive) {
              this.multiplayerManager.update(dt, this.vehicleController, {
                forward: false,
                backward: false,
                steerLeft: false,
                steerRight: false,
                handbrake: false,
                boost: false,
                reset: false,
                toggleCamera: false,
                pause: true,
              });
            }
            break;

          case GameState.Finished:
            // Vehicle smoothly rolls to a stop with gentle engine idle
            this.soundManager.updateEngine(950, 0, this.vehicleController.forwardSpeed * 3.6, true);
            this.soundManager.updateTires(0, 0, 0, false);
            this.soundManager.updateWindRush(0, false);
            this.soundManager.updateOpponentsAudio({ x: 0, z: 0, yaw: 0 }, [], false);
            if (Math.abs(this.vehicleController.forwardSpeed) > 0.05) {
              this.vehicleController.forwardSpeed *= Math.max(0, 1.0 - 2.5 * dt);
              this.vehicleController.lateralSpeed *= Math.max(0, 1.0 - 4.0 * dt);
              const forwardDir = new Vector3(
                Math.sin(this.vehicleController.yawAngle),
                0,
                Math.cos(this.vehicleController.yawAngle)
              );
              this.vehicleController.position.addInPlace(forwardDir.scale(this.vehicleController.forwardSpeed * dt));
              this.vehicle.applyTransform(this.vehicleController.position, this.vehicleController.yawAngle);
              this.vehicle.updateBodyMotion(dt, 0, 0);
              this.tireFeedbackManager?.update(dt, this.vehicle, this.vehicleController, false);
            }

            // Handle celebratory finish camera sweep (2.5s duration)
            if (this.isFinishSweepActive) {
              this.finishCinematicElapsed += dt;
              const finishProgress = Math.min(1.0, this.finishCinematicElapsed / 2.5);

              // Check if user pressed any key to skip celebration
              if (
                this.finishCinematicElapsed >= 2.5 ||
                this.inputManager.hasDrivingInput() ||
                this.inputManager.consumePause()
              ) {
                this.isFinishSweepActive = false;
                const pref = this.settingsManager.getSettings().preferredCameraMode || 'chase';
                this.sceneManager.restoreGameplayCamera(pref);
                this.showFinishScreen();
              } else {
                this.sceneManager.updateFinishSweep(
                  finishProgress,
                  this.vehicleController.position,
                  this.vehicleController.yawAngle
                );
              }
            } else {
              this.sceneManager.updateChaseCamera(
                this.vehicleController.position,
                this.vehicleController.yawAngle,
                this.vehicleController.forwardSpeed,
                this.vehicleController.lateralSpeed,
                0,
                dt
              );
            }
            break;

          case GameState.Replay:
            this.replayManager.updatePlayback(dt, this.vehicle, this.aiManager.opponents);
            break;
        }

        // Live physics diagnostic telemetry overlay (F3 / ~)
        if (this.vehicleController && this.physicsDebugOverlay.active) {
          const mpDiag = this.multiplayerManager?.isActive
            ? {
                isHost: this.multiplayerManager.isHost,
                pingMs: this.multiplayerManager.getPing(),
                racerCount: this.multiplayerManager.connectedPlayers.length,
                tick: this.multiplayerManager.getCurrentTick(),
              }
            : undefined;
          this.physicsDebugOverlay.update(this.vehicleController.getTelemetry(), mpDiag);
        }

        // Render scene
        this.sceneManager.render();

        // FPS counter update
        frameCount++;
        const now = performance.now();
        if (now - lastFpsUpdate >= 500) {
          const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
          if (this.fpsElement) {
            this.fpsElement.textContent = `FPS: ${fps} (${this.sceneManager.engine.getFps().toFixed(0)} avg)`;
          }
          frameCount = 0;
          lastFpsUpdate = now;
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to start Project Apex:', err);
      this.loadingScreen.showError(errorMsg);
    }
  }

  public setGameState(newState: GameState): void {
    const previousState = this.state;
    this.state = newState;
    this.isPaused = newState === GameState.Paused;
    this.isRacing = newState === GameState.Racing;

    // Coordinate on-screen touch controls: strictly only show during Countdown or Racing
    const isInRace = newState === GameState.Racing || newState === GameState.Countdown;
    this.inputManager.setInRace(isInRace);

    // Coordinate procedural synthwave background music transitions
    if (
      newState === GameState.MainMenu ||
      newState === GameState.EventSelect ||
      newState === GameState.Garage ||
      newState === GameState.CareerHub ||
      newState === GameState.Settings
    ) {
      this.soundManager.startMusic('menu');
      this.soundManager.setMusicPaused(false);
    } else if (newState === GameState.Countdown || newState === GameState.Racing) {
      this.soundManager.startMusic('race');
      this.soundManager.setMusicPaused(false);
    } else if (newState === GameState.Paused) {
      this.soundManager.setMusicPaused(true);
    } else if (newState === GameState.Finished || newState === GameState.CareerResults) {
      this.soundManager.stopMusic(0.8);
    }

    // Clean up showroom when leaving Garage mode or CareerHub
    const wasInShowroom = previousState === GameState.Garage || previousState === GameState.CareerHub;
    const isNowInShowroom = newState === GameState.Garage || newState === GameState.CareerHub;
    if (wasInShowroom && !isNowInShowroom) {
      this.sceneManager.disableGarageShowroom(this.trackLoader.trackRoot, this.checkpointManager.rootNode);
      this.garageScreen.hide();
    }

    // UI visibility coordination
    switch (newState) {
      case GameState.MainMenu:
        this.sceneManager.setCameraMode('orbit');
        this.aiManager.hideOpponents();
        this.mainMenu.show();
        this.eventSelect.hide();
        this.garageScreen.hide();
        this.settingsMenu.hide();
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        this.racingHUD.setVisible(false);
        break;

      case GameState.EventSelect:
        this.sceneManager.setCameraMode('orbit');
        this.aiManager.hideOpponents();
        this.mainMenu.hide();
        this.eventSelect.updateSelectedVehicle();
        this.eventSelect.show();
        this.garageScreen.hide();
        this.settingsMenu.hide();
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        this.racingHUD.setVisible(false);
        break;

      case GameState.Garage:
        if (this.vehicleController) {
          this.sceneManager.enableGarageShowroom(
            this.trackLoader.trackRoot,
            this.checkpointManager.rootNode,
            this.vehicleController.position
          );
        }
        this.aiManager.hideOpponents();
        this.mainMenu.hide();
        this.eventSelect.hide();
        this.settingsMenu.hide();
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        this.racingHUD.setVisible(false);
        this.garageScreen.show();
        break;

      case GameState.Settings:
        if (this.settingsReturnState === GameState.MainMenu) {
          this.sceneManager.setCameraMode('orbit');
        }
        this.mainMenu.hide();
        this.eventSelect.hide();
        this.garageScreen.hide();
        this.settingsMenu.show();
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        this.racingHUD.setVisible(false);
        break;

      case GameState.Countdown:
        this.mainMenu.hide();
        this.eventSelect.hide();
        this.garageScreen.hide();
        this.settingsMenu.hide();
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        this.racingHUD.setVisible(true);
        this.racingHUD.reset(this.currentEvent.mode);
        break;

      case GameState.Racing:
        const prefCam = this.settingsManager.getSettings().preferredCameraMode || 'chase';
        this.sceneManager.restoreGameplayCamera(prefCam);
        this.mainMenu.hide();
        this.eventSelect.hide();
        this.garageScreen.hide();
        this.settingsMenu.hide();
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        this.racingHUD.setVisible(true);
        break;

      case GameState.Paused:
        this.pauseMenu.setMultiplayerMode(this.multiplayerManager?.isActive ?? false);
        this.pauseMenu.show();
        this.settingsMenu.hide();
        this.garageScreen.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        break;

      case GameState.Finished:
        this.pauseMenu.hide();
        this.garageScreen.hide();
        this.careerHub.hide();
        const resultValue =
          this.currentEvent.mode === 'drift'
            ? this.driftScoringManager.totalBankedScore
            : this.currentEvent.mode === 'speed_trap'
            ? this.speedTrapManager.getAggregateSpeed()
            : this.raceTimeSeconds;
        this.cachedResultValue = resultValue;

        if (!this.isFinishSweepActive) {
          this.showFinishScreen();
        }
        break;

      case GameState.Replay:
        this.racingHUD.setVisible(false);
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.mainMenu.hide();
        this.eventSelect.hide();
        this.garageScreen.hide();
        this.settingsMenu.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        break;

      case GameState.CareerHub:
        if (this.vehicleController) {
          const selectedVehicleId = this.careerManager.getSelectedVehicleId();
          this.syncSelectedVehicle(selectedVehicleId);
          this.sceneManager.enableGarageShowroom(
            this.trackLoader.trackRoot,
            this.checkpointManager.rootNode,
            this.vehicleController.position
          );
        }
        this.aiManager.hideOpponents();
        this.mainMenu.hide();
        this.eventSelect.hide();
        this.garageScreen.hide();
        this.settingsMenu.hide();
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.careerResultsScreen.hide();
        this.racingHUD.setVisible(false);
        this.careerHub.show(this.isReturningFromCareerRace);
        this.isReturningFromCareerRace = false;
        break;

      case GameState.CareerResults:
        this.racingHUD.setVisible(false);
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.mainMenu.hide();
        this.eventSelect.hide();
        this.garageScreen.hide();
        this.settingsMenu.hide();
        this.careerHub.hide();
        break;

      case GameState.MultiplayerLobby:
        this.racingHUD.setVisible(false);
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.mainMenu.hide();
        this.eventSelect.hide();
        this.garageScreen.hide();
        this.settingsMenu.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        this.aiManager.hideOpponents();
        this.sceneManager.setCameraMode('orbit');
        this.multiplayerManager.openMultiplayerMenu();
        break;

      case GameState.MultiplayerResults:
        this.racingHUD.setVisible(false);
        this.pauseMenu.hide();
        this.finishScreen.hide();
        this.mainMenu.hide();
        this.eventSelect.hide();
        this.garageScreen.hide();
        this.settingsMenu.hide();
        this.careerHub.hide();
        this.careerResultsScreen.hide();
        break;
    }
  }

  public showFinishScreen(): void {
    if (this.isCareerSession && this.activeCareerEvent) {
      const positionRank = this.cachedFinishRankNumber || 1;

      const completionResult = this.careerManager.completeEvent({
        eventId: this.activeCareerEvent.id,
        resultValue: this.cachedResultValue,
        positionRank,
        wallHits: this.careerWallCollisions,
        topSpeedKmh: this.careerMaxSpeedKmh,
        maxComboMultiplier: this.driftScoringManager.maxMultiplierAchieved,
        sessionToken: this.careerSessionToken,
      });

      this.careerResultsScreen.show(
        this.activeCareerEvent,
        this.cachedResultValue,
        completionResult,
        this.cachedFinishPositionDisplay || `${this.currentLiveRankFormatted} PLACE`,
        this.replayManager.hasRecordedData()
      );
      this.setGameState(GameState.CareerResults);
    } else {
      const finishDisplay =
        this.cachedFinishPositionDisplay ||
        (this.aiManager.isEnabled || (this.multiplayerManager?.isActive ?? false)
          ? `${this.currentLiveRankFormatted} / ${this.currentLiveTotalRacers}`
          : undefined);
      this.finishScreen.show(
        this.cachedResultValue,
        this.currentEvent,
        finishDisplay
      );
    }
  }

  /**
   * Ensures the specified circuit geometry, waypoints, boundaries, and scenery are loaded.
   */
  public async ensureCircuitLoaded(circuit: CircuitDefinition): Promise<void> {
    if (this.currentCircuit && this.currentCircuit.id === circuit.id) {
      return;
    }

    this.setGameState(GameState.Loading);
    this.loadingScreen.show();
    this.loadingScreen.setProgress(15, `Configuring ${circuit.name}...`);

    await this.trackLoader.loadCircuit(circuit, (progress) => {
      this.loadingScreen.setProgress(15 + progress * 75, `Building ${circuit.name}... ${Math.round(progress * 100)}%`);
    });

    this.currentCircuit = circuit;
    this.sceneManager.applyTrackEnvironment(circuit.environment);
    this.checkpointManager.registerCheckpoints(this.trackLoader.checkpoints);
    this.aiManager.setCircuit(circuit);
    this.trackCollision.setCircuit(circuit);

    if (this.vehicleController) {
      this.vehicleController.roadSurfaceY = circuit.roadSurfaceY;
    }
    if (this.tireFeedbackManager) {
      this.tireFeedbackManager.roadSurfaceY = circuit.roadSurfaceY;
    }

    if (this.carInfoElement && this.vehicle?.metadata) {
      this.carInfoElement.innerHTML = `
        Model: <strong>${this.vehicle.metadata.fileName}</strong> |
        Course: <strong>${circuit.name} (${circuit.measuredLengthMeters}m, ${circuit.tileCount} Tiles)</strong> |
        Triangles: <strong>${this.vehicle.metadata.totalTriangles.toLocaleString()}</strong>
      `;
    }

    this.loadingScreen.setProgress(100, 'Ready');
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.loadingScreen.hide();
  }

  public getTargetLapsForEvent(event: RaceEventConfig): number {
    if (event.mode === 'sprint') return 1;
    if (event.lapsBadge) {
      const m = event.lapsBadge.match(/(\d+)\s*LAP/i);
      if (m) return parseInt(m[1], 10);
    }
    return 1;
  }

  public startCountdown(event?: RaceEventConfig, difficulty?: AIDifficulty): void {
    requestFullscreenIfMobile();
    this.clearCountdownTimeouts();
    this.playerClosestWpIndex = 0;

    if (event) {
      this.currentEvent = event;
    }

    if (this.multiplayerManager?.isActive) {
      this.aiManager.isEnabled = false;
      this.aiManager.hideOpponents();
    } else {
      const targetLaps = this.getTargetLapsForEvent(this.currentEvent);
      this.aiManager.setupGrid(this.currentEvent, difficulty, targetLaps);
    }

    // Ensure active vehicle handling profile is synchronized with selected vehicle
    const selectedId = this.settingsManager.getSelectedVehicleId();
    const catalogItem = getVehicleById(selectedId);
    if (catalogItem && this.vehicleController) {
      const effectiveSpecs = this.careerManager.getEffectiveVehicleSpecs(catalogItem.id) || catalogItem.specs;
      const profile = createHandlingProfile(effectiveSpecs, catalogItem.id, catalogItem.name, catalogItem.tier);
      this.vehicleController.applyHandlingProfile(profile);
    }

    // Reset car to event start line (respecting multiplayer grid assignments if active)
    let startPos = this.currentEvent.startPosition;
    let startYaw = this.currentEvent.startYaw;

    if (this.multiplayerManager?.isActive) {
      const mySlot = this.multiplayerManager.gridAssignments[this.multiplayerManager.selfPlayerId] || 1;
      const tf = this.multiplayerManager.getGridSlotTransform(mySlot);
      startPos = tf.position;
      startYaw = tf.yaw;
    }

    this.vehicleController?.resetTo(startPos, startYaw);
    this.sceneManager.resetCameras(startPos, startYaw);
    const pref = this.settingsManager.getSettings().preferredCameraMode || 'chase';
    this.sceneManager.setCameraMode(pref);
    this.vehicle.resetBodyMotion();
    this.tireFeedbackManager?.reset();

    // Reset progress & timers
    this.raceTimeSeconds = 0;
    this.checkpointManager.resetProgress();
    this.countdownElapsed = 0;
    this.isGridSweepActive = true;
    this.cachedFinishPositionDisplay = undefined;
    this.cachedFinishRankNumber = 1;
    this.currentLiveRank = 1;
    this.currentLiveRankFormatted = '1ST';
    this.currentLiveTotalRacers = 4;
    this.driftScoringManager.reset();
    this.pursuitManager.reset();
    this.eliminationManager.reset();
    this.speedTrapManager.reset();
    this.speedTrapManager.setCircuitTraps(this.currentCircuit.id);
    this.replayManager.startRecording();
    this.soundManager.playGridSweepCue();
    this.setGameState(GameState.Countdown);

    const hudBanner = document.getElementById('countdown-banner');
    if (hudBanner) {
      hudBanner.classList.remove('hidden');
      hudBanner.textContent = '3';
      this.soundManager.playCountdownBeep(false);
    }

    const t1 = window.setTimeout(() => {
      if (this.state !== GameState.Countdown) return;
      if (hudBanner) {
        hudBanner.textContent = '2';
        this.soundManager.playCountdownBeep(false);
      }
    }, 1000);

    const t2 = window.setTimeout(() => {
      if (this.state !== GameState.Countdown) return;
      if (hudBanner) {
        hudBanner.textContent = '1';
        this.soundManager.playCountdownBeep(false);
      }
    }, 2000);

    const t3 = window.setTimeout(() => {
      if (this.state !== GameState.Countdown) return;
      if (this.isGridSweepActive) {
        this.isGridSweepActive = false;
        const currentPref = this.settingsManager.getSettings().preferredCameraMode || 'chase';
        this.sceneManager.restoreGameplayCamera(currentPref);
      }
      if (hudBanner) {
        hudBanner.textContent = 'GO!';
        this.soundManager.playCountdownBeep(true);
      }
      if (this.currentEvent.mode === 'drift') {
        this.driftScoringManager.startSession();
      } else if (this.currentEvent.mode === 'pursuit') {
        if (this.vehicleController) {
          this.pursuitManager.start(this.vehicleController.position, this.vehicleController.yawAngle);
        }
      } else if (this.currentEvent.mode === 'elimination') {
        this.eliminationManager.start();
      } else if (this.currentEvent.mode === 'speed_trap') {
        this.speedTrapManager.start();
      }
      this.aiManager.startRace();
      this.setGameState(GameState.Racing);
    }, 3000);

    const t4 = window.setTimeout(() => {
      if (hudBanner) {
        hudBanner.classList.add('hidden');
      }
    }, 3800);

    this.countdownTimeouts.push(t1, t2, t3, t4);
  }

  private clearCountdownTimeouts(): void {
    this.countdownTimeouts.forEach((t) => clearTimeout(t));
    this.countdownTimeouts = [];
    this.isGridSweepActive = false;
    const hudBanner = document.getElementById('countdown-banner');
    if (hudBanner) {
      hudBanner.classList.add('hidden');
      hudBanner.textContent = '';
    }
  }

  public finishRace(finalScoreOverride?: number): void {
    this.replayManager.stopRecording();
    if (this.currentEvent.mode === 'drift') {
      if (finalScoreOverride !== undefined) {
        this.driftScoringManager.totalBankedScore = finalScoreOverride;
      } else if (this.driftScoringManager.activeDriftPoints > 0) {
        this.driftScoringManager.bankPoints();
      }
    }
    this.soundManager.playFinishCelebration();
    this.soundManager.playFinishChime();
    this.isFinishSweepActive = true;
    this.finishCinematicElapsed = 0;

    // Snapshot exact finish position at the moment the finish line is crossed
    const lockedRank = this.aiManager.getFinishRank('player');
    if (lockedRank !== null) {
      this.cachedFinishRankNumber = lockedRank;
      const rankSuffixes = ['1ST', '2ND', '3RD', '4TH'];
      const suffix = rankSuffixes[lockedRank - 1] || `${lockedRank}TH`;
      const totalRacers = this.aiManager.opponents.length + 1;
      this.cachedFinishPositionDisplay = `${suffix} PLACE / ${totalRacers} DRIVERS`;
    } else {
      this.cachedFinishRankNumber = this.currentLiveRank;
      if (!this.cachedFinishPositionDisplay) {
        if (this.currentEvent.mode === 'drift') {
          this.cachedFinishPositionDisplay = `DRIFT SCORE • ${this.driftScoringManager.totalBankedScore.toLocaleString()} PTS`;
        } else if (this.currentEvent.mode === 'speed_trap') {
          this.cachedFinishPositionDisplay = `RADAR TRAPS • ${Math.round(this.speedTrapManager.getAggregateSpeed())} KM/H`;
        } else if (this.aiManager.isEnabled || (this.multiplayerManager?.isActive ?? false)) {
          this.cachedFinishPositionDisplay = `${this.currentLiveRankFormatted} PLACE`;
        }
      }
    }

    this.setGameState(GameState.Finished);
  }

  public togglePause(): void {
    if (this.state === GameState.Racing) {
      this.pause();
    } else if (this.state === GameState.Paused) {
      this.resume();
    } else if (this.state === GameState.Settings) {
      this.setGameState(this.settingsReturnState);
    } else if (this.state === GameState.EventSelect || this.state === GameState.Garage) {
      this.setGameState(GameState.MainMenu);
    } else if (this.state === GameState.CareerHub) {
      this.setGameState(GameState.MainMenu);
    } else if (this.state === GameState.MultiplayerLobby) {
      this.multiplayerManager?.close();
      this.setGameState(GameState.MainMenu);
    }
  }

  public pause(): void {
    if (this.state !== GameState.Racing) return;
    this.setGameState(GameState.Paused);
    this.inputManager.clearAll();
  }

  public resume(): void {
    if (this.state !== GameState.Paused) return;
    this.pauseMenu.hide();
    this.setGameState(GameState.Racing);
    this.inputManager.clearAll();
  }

  public restartRace(): void {
    this.clearCountdownTimeouts();
    this.cachedFinishPositionDisplay = undefined;
    this.cachedFinishRankNumber = 1;
    if (this.isCareerSession && this.activeCareerEvent) {
      this.careerSessionToken = `${this.activeCareerEvent.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.careerWallCollisions = 0;
      this.careerMaxSpeedKmh = 0;
    }
    this.startCountdown(this.currentEvent, this.aiManager.difficulty);
  }

  public returnToStartLine(): void {
    const startPos = this.currentEvent.startPosition;
    const startYaw = this.currentEvent.startYaw;
    this.vehicleController?.resetTo(startPos, startYaw);
    this.sceneManager.resetCameras(startPos, startYaw);
    this.vehicle.resetBodyMotion();
    this.tireFeedbackManager?.reset();
    this.resume();
  }

  public returnToMenu(): void {
    this.clearCountdownTimeouts();
    this.raceTimeSeconds = 0;
    this.checkpointManager.resetProgress();
    this.driftScoringManager.reset();
    this.multiplayerManager?.close();
    this.aiManager.hideOpponents();
    this.isCareerSession = false;
    this.activeCareerEvent = null;
    const startPos = this.trackLoader.startPosition;
    this.vehicleController?.resetTo(startPos, 0);
    this.sceneManager.resetCameras(startPos, 0);
    this.vehicle.resetBodyMotion();
    this.tireFeedbackManager?.reset();
    this.setGameState(GameState.MainMenu);
  }

  public openMultiplayer(): void {
    this.setGameState(GameState.MultiplayerLobby);
  }

  private getMultiplayerRank(): string {
    if (!this.multiplayerManager?.isActive || !this.vehicleController) return '1ST';

    const playerProgress = this.aiManager.waypointManager.getProgressDistance(
      this.vehicleController.position,
      this.checkpointManager.lapCount + 1
    );

    let rank = 1;
    for (const [_, rv] of this.multiplayerManager.remoteVehicles) {
      if (rv.isFinished) {
        rank++;
      } else {
        const rvProgress = this.aiManager.waypointManager.getProgressDistance(rv.position, rv.currentLap);
        if (rvProgress > playerProgress) {
          rank++;
        }
      }
    }

    if (this.multiplayerManager.isHost) {
      for (const [_, ai] of this.multiplayerManager.hostAiOpponents) {
        if (!ai.isLoaded) continue;
        if (ai.isFinished) {
          rank++;
        } else {
          const aiProgress = this.aiManager.waypointManager.getProgressDistance(ai.position, ai.lapCount);
          if (aiProgress > playerProgress) {
            rank++;
          }
        }
      }
    }

    switch (rank) {
      case 1:
        return '1ST';
      case 2:
        return '2ND';
      case 3:
        return '3RD';
      default:
        return `${rank}TH`;
    }
  }

  public openCareerHub(isReturningFromRace: boolean = false): void {
    this.isReturningFromCareerRace = isReturningFromRace;
    this.setGameState(GameState.CareerHub);
  }

  public async syncSelectedVehicle(vehicleId?: string): Promise<void> {
    const selectedId = vehicleId || this.careerManager.getSelectedVehicleId();
    this.settingsManager.setSelectedVehicleId(selectedId);
    const catalogItem = getVehicleById(selectedId);
    if (!catalogItem || !this.vehicleController) return;

    const effectiveSpecs = this.careerManager.getEffectiveVehicleSpecs(catalogItem.id) || catalogItem.specs;
    const profile = createHandlingProfile(effectiveSpecs, catalogItem.id, catalogItem.name, catalogItem.tier);
    this.vehicleController.applyHandlingProfile(profile);

    if (this.vehicle.metadata?.fileName !== catalogItem.fileName) {
      try {
        const savedPaint = this.careerManager.getVehiclePaint(catalogItem.id);
        await this.vehicle.load(
          catalogItem.fileName,
          this.vehicleController.position,
          0,
          savedPaint,
          catalogItem.yawOffset || 0
        );
        this.sceneManager.addShadowCaster(this.vehicle.modelContainer);
      } catch (err) {
        console.warn('[Game] Failed to sync 3D vehicle model:', catalogItem.fileName, err);
      }
    }
  }

  public async startCareerEvent(careerEvent: CareerEventDefinition): Promise<void> {
    this.soundManager.playUISelect();
    this.isCareerSession = true;
    this.activeCareerEvent = careerEvent;
    this.careerSessionToken = `${careerEvent.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.careerWallCollisions = 0;
    this.careerMaxSpeedKmh = 0;

    // Synchronize vehicle from career manager
    const selectedVehicleId = this.careerManager.getSelectedVehicleId();
    const vehicleItem = getVehicleById(selectedVehicleId);
    if (vehicleItem && this.vehicleController) {
      this.settingsManager.setSelectedVehicleId(selectedVehicleId);
      const effectiveSpecs = this.careerManager.getEffectiveVehicleSpecs(vehicleItem.id) || vehicleItem.specs;
      const profile = createHandlingProfile(effectiveSpecs, vehicleItem.id, vehicleItem.name, vehicleItem.tier);
      this.vehicleController.applyHandlingProfile(profile);
      try {
        const savedPaint = this.careerManager.getVehiclePaint(vehicleItem.id);
        await this.vehicle.load(
          vehicleItem.fileName,
          this.vehicleController.position,
          0,
          savedPaint,
          vehicleItem.yawOffset || 0
        );
        this.sceneManager.addShadowCaster(this.vehicle.modelContainer);
      } catch (err) {
        console.warn('[Career] Failed to load 3D vehicle model:', vehicleItem.fileName, err);
      }
    }

    // Load circuit
    const circuit = getCircuitById(careerEvent.circuitId);
    await this.ensureCircuitLoaded(circuit);

    // Map to race configuration
    const baseEvent = circuit.events.find((e) => e.mode === careerEvent.mode) || circuit.events[0];
    const raceConfig: RaceEventConfig = {
      ...baseEvent,
      id: careerEvent.id,
      name: careerEvent.name,
      subtitle: `${circuit.name} • ${careerEvent.subtitle}`,
      mode: careerEvent.mode,
    };
    this.currentEvent = raceConfig;

    this.startCountdown(raceConfig, careerEvent.aiDifficulty);
  }

  public openEventSelect(): void {
    this.setGameState(GameState.EventSelect);
  }

  public openGarage(returnState?: GameState): void {
    this.garageReturnState = returnState || (this.isCareerSession ? GameState.CareerHub : GameState.MainMenu);
    this.setGameState(GameState.Garage);
  }

  public openSettings(): void {
    this.setGameState(GameState.Settings);
  }

  public startReplay(): void {
    if (!this.replayManager.hasRecordedData()) {
      return;
    }
    this.finishScreen.hide();
    this.careerResultsScreen.hide();
    this.setGameState(GameState.Replay);
    this.replayManager.startPlayback({
      onExitReplay: () => this.exitReplay(),
    });
  }

  public exitReplay(): void {
    this.setGameState(GameState.Finished);
    const pref = this.settingsManager.getSettings().preferredCameraMode || 'chase';
    this.sceneManager.restoreGameplayCamera(pref);
    this.showFinishScreen();
  }

  public exitGame(): void {
    // Graceful browser-supported exit behavior
    const confirmed = confirm('Are you sure you want to exit Project Apex?');
    if (confirmed) {
      window.close();
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.clearCountdownTimeouts();
    this.sceneManager.engine.stopRenderLoop();
    this.multiplayerManager?.close();
    this.inputManager.dispose();
    this.checkpointManager.dispose();
    this.pauseMenu.dispose();
    this.mainMenu.dispose();
    this.careerHub.dispose();
    this.careerResultsScreen.dispose();
    this.eventSelect.dispose();
    this.garageScreen.dispose();
    this.settingsMenu.dispose();
    this.finishScreen.dispose();
    this.pursuitManager.dispose();
    this.replayManager.dispose();
    this.tireFeedbackManager?.dispose();
    this.menuNavigator.dispose();
    this.vehicle.dispose();
    this.sceneManager.dispose();
  }
}

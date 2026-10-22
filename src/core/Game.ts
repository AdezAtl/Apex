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
  public aiManager: AIManager;
  public replayManager: ReplayManager;
  public physicsDebugOverlay: PhysicsDebugOverlay;
  public careerManager: CareerManager;
  public careerHub: CareerHub;
  public careerResultsScreen: CareerResultsScreen;
  public multiplayerManager: MultiplayerManager;

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
  private cachedResultValue: number = 0;

  // Debug HUD elements
  private fpsElement: HTMLElement | null = null;
  private carInfoElement: HTMLElement | null = null;
  private cameraModeElement: HTMLElement | null = null;
  private settingsReturnState: GameState = GameState.MainMenu;
  private garageReturnState: GameState = GameState.MainMenu;

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
    this.soundManager = new SoundManager(
      settings.masterVolume,
      settings.engineVolume,
      settings.effectsVolume,
      settings.isMuted
    );
    this.driftScoringManager = new DriftScoringManager();
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
      onMuteToggle: (isMuted) => {
        this.settingsManager.setMuted(isMuted);
        this.soundManager.setMuted(isMuted);
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
    this.checkpointManager.onLapCompleted = () => {
      if (this.state === GameState.Racing && this.currentEvent.mode === 'time_trial') {
        this.finishRace();
      }
    };

    this.checkpointManager.onSprintCompleted = () => {
      if (this.state === GameState.Racing && this.currentEvent.mode === 'sprint') {
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
      }, 300);

      // Window-level user gesture unlock for Web Audio
      const unlockAudio = () => {
        this.soundManager.initContext();
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
          case GameState.CareerHub:
            // Silence engine in showroom & career hub turntable
            this.soundManager.updateEngine(0, 0, 0, false);
            this.soundManager.updateTires(0, 0, 0, false);
            this.sceneManager.updateGarageCamera(dt);
            break;

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

            // AI Opponents update
            this.aiManager.update(
              dt,
              true,
              this.isPaused,
              this.vehicleController
            );

            // Record frame for replay system
            this.replayManager.recordFrame(dt, this.vehicleController, this.aiManager.opponents);

            // Multiplayer network update & remote vehicle interpolation
            if (this.multiplayerManager?.isActive) {
              this.multiplayerManager.update(dt, this.vehicleController, inputState);
            }

            // Solid body vehicle-to-vehicle collision resolution (player vs AI and AI vs AI)
            if (this.aiManager.isEnabled) {
              VehicleCollision.resolveAll(
                this.vehicleController,
                this.aiManager.opponents,
                (hit) => {
                  this.soundManager.playCollisionImpact(hit.impactSpeed);
                  this.sceneManager.triggerCameraShake(Math.min(0.9, hit.impactSpeed * 0.12));
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

            // Gear shift acoustic trigger
            if (this.vehicleController.didShiftThisFrame) {
              this.soundManager.playGearShift(this.vehicleController.currentGear);
            }

            // Compute player progress distance & relative grid ranking
            const playerProgress = this.aiManager.waypointManager.getProgressDistance(
              this.vehicleController.position,
              this.checkpointManager.lapCount + 1
            );
            const rankInfo = this.aiManager.getPlayerRank(playerProgress);

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
            }

            // HUD update
            this.racingHUD.update({
              telemetry: this.vehicleController.getTelemetry(),
              currentGate: this.checkpointManager.getCurrentGateNumber(),
              totalGates: this.checkpointManager.getTotalGates(),
              lap: this.checkpointManager.lapCount + 1,
              raceTimeSeconds: this.raceTimeSeconds,
              mode: this.currentEvent.mode,
              positionRank: posRank,
              positionTotal: posTotal,
              showPosition: this.aiManager.isEnabled || (this.multiplayerManager?.isActive ?? false),
              driftTelemetry:
                this.currentEvent.mode === 'drift'
                  ? this.driftScoringManager.getTelemetry()
                  : undefined,
            });
            break;
          }

          case GameState.Paused:
            // Simulation is frozen. Suppress audio & tire emission.
            this.soundManager.updateEngine(0, 0, 0, false);
            this.soundManager.updateTires(0, 0, 0, false);
            this.tireFeedbackManager?.update(dt, this.vehicle, this.vehicleController, false);
            if (this.multiplayerManager?.isActive) {
              this.multiplayerManager.update(dt, this.vehicleController, {
                forward: false,
                backward: false,
                steerLeft: false,
                steerRight: false,
                handbrake: false,
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
            : this.raceTimeSeconds;
        let finishPositionDisplay: string | undefined;
        if (this.aiManager.isEnabled && this.vehicleController) {
          const playerProgress = this.aiManager.waypointManager.getProgressDistance(
            this.vehicleController.position,
            this.checkpointManager.lapCount + 1
          );
          const rankInfo = this.aiManager.getPlayerRank(playerProgress);
          finishPositionDisplay = `${rankInfo.rankFormatted} PLACE / ${rankInfo.totalRacers} DRIVERS`;
        }
        this.cachedResultValue = resultValue;
        this.cachedFinishPositionDisplay = finishPositionDisplay;

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
      let positionRank = 1;
      if (this.aiManager.isEnabled && this.vehicleController) {
        const playerProgress = this.aiManager.waypointManager.getProgressDistance(
          this.vehicleController.position,
          this.checkpointManager.lapCount + 1
        );
        const rankInfo = this.aiManager.getPlayerRank(playerProgress);
        positionRank = rankInfo.rank;
      }

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
        this.cachedFinishPositionDisplay,
        this.replayManager.hasRecordedData()
      );
      this.setGameState(GameState.CareerResults);
    } else {
      this.finishScreen.show(
        this.cachedResultValue,
        this.currentEvent,
        this.cachedFinishPositionDisplay
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

  public startCountdown(event?: RaceEventConfig, difficulty?: AIDifficulty): void {
    this.clearCountdownTimeouts();

    if (event) {
      this.currentEvent = event;
    }

    this.aiManager.setupGrid(this.currentEvent, difficulty);

    this.checkpointManager.setActiveEvent(this.currentEvent);
    this.driftScoringManager.reset();

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
    let rank = 1;
    for (const [_, rv] of this.multiplayerManager.remoteVehicles) {
      if (rv.currentLap > this.checkpointManager.lapCount + 1) {
        rank++;
      } else if (rv.currentLap === this.checkpointManager.lapCount + 1) {
        if (rv.currentGate > this.checkpointManager.getCurrentGateNumber()) {
          rank++;
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
    this.replayManager.dispose();
    this.tireFeedbackManager?.dispose();
    this.vehicle.dispose();
    this.sceneManager.dispose();
  }
}

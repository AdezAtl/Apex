# Project Apex — Topology & Semantic Memory Layer

## Codebase Anchors & High-Centrality Modules
- **Game Engine**: [`src/core/Game.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/core/Game.ts) — Master coordinator and state machine (`GameState`). Manages transitions between `MainMenu`, `EventSelect`, `Garage`, `CareerHub`, `Racing`, `Paused`, `Finished`, and `Replay`. Controls two-way navigation routing and Web Audio gesture unlocking.
- **Vehicle Catalog**: [`src/vehicle/VehicleCatalog.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/vehicle/VehicleCatalog.ts) — Source of truth for 18 vehicles, specifications, unlock rules, credit costs, tiers.
- **Handling Engine**: [`src/vehicle/VehicleHandlingProfile.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/vehicle/VehicleHandlingProfile.ts) & [`src/vehicle/VehicleController.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/vehicle/VehicleController.ts) — Arcade-sim hybrid physics, dynamic downforce, drivetrain dynamics.
- **Circuit System**: [`src/tracks/TrackRegistry.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/tracks/TrackRegistry.ts) — `ForestValleyCircuit` (980m Grand Course) and `AzureCoastCircuit` (580m GP Track).
- **AI Opponents**: [`src/ai/AIManager.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/ai/AIManager.ts) & [`src/ai/AIOpponent.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/ai/AIOpponent.ts) — Fleet of 3 AI racers with Technician, Aggressor, and Challenger personalities.
- **Progression Layer (Stage 13)**:
  - [`src/career/CareerConfig.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/career/CareerConfig.ts) — 5 competitive tiers, 15 curated events, reward tables, reputation milestones.
  - [`src/career/CareerManager.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/career/CareerManager.ts) — Persistence (`project_apex_career_v1`), credits, reputation, vehicle ownership, exact-once reward guards.
  - [`src/ui/CareerHub.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/ui/CareerHub.ts) — Fully overhauled 4-zone motorsport-editorial career championship hub: 64px player header bar, 72px 5-tier navigation tab bar with anchored locked-tier tooltips, 360px/1fr main content area with flush 80px event cards and 3-row detail panel, and 64px pinned CTA bar with sharp 280×44px primary launcher.
  - [`src/ui/CareerResultsScreen.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/ui/CareerResultsScreen.ts) — Dedicated career results overlay with rewards breakdown.
- **Vehicle Economy & Upgrades Layer (Stage 14)**:
  - [`src/vehicle/VehicleUpgrades.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/vehicle/VehicleUpgrades.ts) — 4 performance upgrade categories (Engine, Handling, Brakes, Suspension), tier-scaled credit costs, non-mutating `calculateEffectiveSpecs()`, and stat delta previews.
  - [`src/career/CareerManager.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/career/CareerManager.ts) — Atomic purchase handlers (`purchaseVehicle`, `purchaseUpgrade`), multi-car ownership, per-vehicle upgrade tracking, and independent per-vehicle paint persistence.
  - [`src/ui/GarageScreen.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/ui/GarageScreen.ts) — Upgraded fleet showroom with dual-dock layout: Performance Workshop (stage tuning, level pips, stat deltas) and Exterior Lacquer (swatches, 360° turntable), plus dual-tone base/upgraded spec progress meters.
- **Final Release Candidate Integration (Stage 15)**:
  - [`index.html`](file:///C:/Users/Dell/Documents/coding/ProjectApex/index.html) — Production favicon (inline SVG motorsport chevron data URI), complete OpenGraph tags, responsive viewport definitions, zero 404 console errors.
  - [`src/ui/MainMenu.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/ui/MainMenu.ts) — Distinct primary action hierarchy (`CAREER CHAMPIONSHIP` vs `FREE PLAY / ARCADE`), Release Candidate status pill `RELEASE CANDIDATE 1.0.0 • 60 FPS ENGINE`.
  - [`src/ui/EventSelect.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/ui/EventSelect.ts) — Active chassis telemetry bar with direct `GARAGE / SWITCH` action and seamless return synchronization.
  - [`src/audio/SoundManager.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/audio/SoundManager.ts) — Window-level input gesture resume binding guarantees audio output on first interaction without browser autoplay blocks.
  - [`src/ui/PauseMenu.ts`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/ui/PauseMenu.ts) — Clarified abandon action `ABANDON EVENT & RETURN` with cautionary progress-discard notice.
  - [`src/style.css`](file:///C:/Users/Dell/Documents/coding/ProjectApex/src/style.css) — Polished 4px/8px motorsport spacing system, responsive docks at 1280x720 (unobstructed 520px center showroom) and 1920x1080 (1044px gap), zero horizontal scrolling.

## Invariants & Principles
1. **Single-Award Guarantee**: Each completed race session generates a unique completion token to strictly prevent duplicate awards through re-rendering or menu navigation.
2. **Vehicle Ownership & Eligibility**: Free Play permits open selection; Career Mode enforces vehicle ownership and event tier/drivetrain rules with clear visual guidance to the Garage.
3. **Save Isolation & Migration**: Career progression uses `project_apex_career_v1`, keeping user settings (`project_apex_settings`) and time trial records (`project_apex_records`) completely insulated. Automatic schema migration preserves legacy save files.
4. **Physical Upgrade Integration**: Upgrades never mutate base catalog items; effective specs are calculated on the fly and mapped into physical controller profiles (`createHandlingProfile(effectiveSpecs)`), modifying acceleration, top speed, cornering grip, downforce, and braking.
5. **Two-Way Navigation Contract**: Entering the Garage from Event Select remembers the originating state and returns cleanly back to Event Select with the updated vehicle telemetry bar refreshed.
6. **Autoplay Resistance**: WebAudio initialization hooks into DOM pointer/keyboard gestures so audio unlocks without console security warnings or audio starvation.
7. **Verified Status (Stage 15 Release Candidate — 100% Pass Rate)**:
   - 65/65 comprehensive release audit assertions passing in [`scripts/verify_stage15_release_readiness.cjs`](file:///C:/Users/Dell/Documents/coding/ProjectApex/scripts/verify_stage15_release_readiness.cjs).
   - Zero uncaught console errors, zero 404 network warnings.
   - Clean production compilation in `npm run build` with zero TypeScript errors.

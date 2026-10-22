export type PersonalityType = 'technician' | 'aggressor' | 'challenger';

export interface PersonalityTraits {
  id: PersonalityType;
  name: string;
  tagline: string;

  // Braking behavior
  brakeMarginMultiplier: number;    // > 1.0 brakes earlier & cautiously; < 1.0 brakes late and deep
  brakeConsistency: number;         // Variance in braking point (0.01 = laser consistent, 0.10 = variable)

  // Racing line & steering
  steeringSmoothness: number;       // Exponential smoothing factor for steering inputs
  apexKerbClipping: number;         // Multiplier pulling toward the inside apex kerb (0.0 to 1.0)

  // Overtaking & aggression
  overtakeThresholdDistance: number;// Distance ahead in meters to begin hunting for a pass
  minPassSpeedDifferential: number;// Minimum speed advantage (m/s) required before initiating an overtake
  insideDiveAssertiveness: number; // Propensity to dive down the inside entering corners (0.0 to 1.0)
  passCommitmentSeconds: number;    // Minimum time to stay committed to a chosen overtaking lane

  // Defense & tactical positioning
  defensiveTriggerDistance: number; // Trailing distance in meters behind to trigger defensive line protection
  defensiveLateralShift: number;    // Distance in meters to shift laterally to hold the inside line

  // Calculated risk & mistake dynamics
  riskFactor: number;               // 0.0 = zero unforced errors, 0.40 = pushes limits with occasional slips
  cornerEntrySpeedFactor: number;   // Extra speed carried on corner entry (1.0 = nominal, > 1.0 = pushes limit)
}

export const PERSONALITY_PRESETS: Record<PersonalityType, PersonalityTraits> = {
  technician: {
    id: 'technician',
    name: 'The Technician',
    tagline: 'Smooth, disciplined, early consistent braking with laser-accurate lines.',
    brakeMarginMultiplier: 1.15,     // Brakes early and consistently before corners
    brakeConsistency: 0.02,          // Near-zero variance: identical braking points every lap
    steeringSmoothness: 7.5,         // High smoothing: eliminates all steering wobble & saw
    apexKerbClipping: 0.40,          // Follows mathematically clean geometric racing line
    overtakeThresholdDistance: 10.0, // Patient: only initiates pass when close
    minPassSpeedDifferential: 2.8,   // Only overtakes when clearly faster
    insideDiveAssertiveness: 0.15,   // Prefers clean, safe passes without diving
    passCommitmentSeconds: 2.2,      // Very steady lane commitment
    defensiveTriggerDistance: 0.0,   // Does not swerve to block; focuses on own clean line
    defensiveLateralShift: 0.0,
    riskFactor: 0.02,                // Minimal mistakes: pristine consistency
    cornerEntrySpeedFactor: 0.98,    // Prioritizes corner exit drive over entry dive
  },

  aggressor: {
    id: 'aggressor',
    name: 'The Aggressor',
    tagline: 'Assertive, late-braking apex hunter with calculated passing risks.',
    brakeMarginMultiplier: 0.88,     // Brakes late and deep into corner entries
    brakeConsistency: 0.08,          // Slight variance: pushes braking threshold
    steeringSmoothness: 5.2,         // Fast, punchy steering bite
    apexKerbClipping: 0.95,          // Aggressively clips inside kerbs and curbs
    overtakeThresholdDistance: 20.0, // Scans far ahead to hunt and plan overtakes
    minPassSpeedDifferential: 0.8,   // Looks for any opportunity to slip past
    insideDiveAssertiveness: 0.90,   // Dives down the inside lane into braking zones
    passCommitmentSeconds: 1.4,      // Quick to switch passing lanes if gap opens
    defensiveTriggerDistance: 0.0,   // Pure forward hunter; rarely looks behind
    defensiveLateralShift: 0.0,
    riskFactor: 0.28,                // Occasionally pushes entry grip; induces controlled slide
    cornerEntrySpeedFactor: 1.07,    // Enters corners hot and scrubs speed mid-corner
  },

  challenger: {
    id: 'challenger',
    name: 'The Challenger',
    tagline: 'Tactical opportunist with defensive positioning and dynamic race pace.',
    brakeMarginMultiplier: 1.00,     // Balanced, responsive braking
    brakeConsistency: 0.04,          // High consistency with adaptive race craft
    steeringSmoothness: 6.2,         // Crisp, controlled steering response
    apexKerbClipping: 0.70,          // Balanced apex attack
    overtakeThresholdDistance: 15.0, // Attacks whenever leader is slower
    minPassSpeedDifferential: 1.4,   // Passes whenever momentum advantage is detected
    insideDiveAssertiveness: 0.60,   // Takes inside line when leader leaves space
    passCommitmentSeconds: 1.8,      // Balanced commitment
    defensiveTriggerDistance: 10.0,  // Defends when a chasing car gets within 10 meters
    defensiveLateralShift: 0.85,     // Shifts toward inside of upcoming corner to protect line
    riskFactor: 0.10,                // Low mistake rate; stays within tire traction limits
    cornerEntrySpeedFactor: 1.02,    // Competitive entry speed with dynamic pace
  },
};

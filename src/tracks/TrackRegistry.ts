import { CircuitDefinition } from './TrackConfig';
import { ForestValleyCircuit } from './ForestValleyCircuit';
import { SavannaRidgeCircuit } from './SavannaRidgeCircuit';
import { AkoboHighwayCircuit } from './AkoboHighwayCircuit';
import { EleyeleRingCircuit } from './EleyeleRingCircuit';

export const ALL_CIRCUITS: CircuitDefinition[] = [
  ForestValleyCircuit,
  SavannaRidgeCircuit,
  AkoboHighwayCircuit,
  EleyeleRingCircuit,
];

export const DEFAULT_CIRCUIT_ID = 'forest_valley';

export function getAllCircuits(): CircuitDefinition[] {
  return ALL_CIRCUITS;
}

export function getCircuitById(id: string): CircuitDefinition {
  const found = ALL_CIRCUITS.find((c) => c.id === id);
  return found || ForestValleyCircuit;
}

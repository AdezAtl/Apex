import { CircuitDefinition } from './TrackConfig';
import { ForestValleyCircuit } from './ForestValleyCircuit';
import { AzureCoastCircuit } from './AzureCoastCircuit';
import { SavannaRidgeCircuit } from './SavannaRidgeCircuit';

export const ALL_CIRCUITS: CircuitDefinition[] = [
  ForestValleyCircuit,
  AzureCoastCircuit,
  SavannaRidgeCircuit,
];

export const DEFAULT_CIRCUIT_ID = 'forest_valley';

export function getAllCircuits(): CircuitDefinition[] {
  return ALL_CIRCUITS;
}

export function getCircuitById(id: string): CircuitDefinition {
  const found = ALL_CIRCUITS.find((c) => c.id === id);
  return found || ForestValleyCircuit;
}

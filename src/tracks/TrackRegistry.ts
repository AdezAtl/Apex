import { CircuitDefinition } from './TrackConfig';
import { ForestValleyCircuit } from './ForestValleyCircuit';
import { AzureCoastCircuit } from './AzureCoastCircuit';

export const ALL_CIRCUITS: CircuitDefinition[] = [
  ForestValleyCircuit,
  AzureCoastCircuit,
];

export const DEFAULT_CIRCUIT_ID = 'forest_valley';

export function getAllCircuits(): CircuitDefinition[] {
  return ALL_CIRCUITS;
}

export function getCircuitById(id: string): CircuitDefinition {
  const found = ALL_CIRCUITS.find((c) => c.id === id);
  return found || ForestValleyCircuit;
}

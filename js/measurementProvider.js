import { buildMeasurements } from './demoMeasurements.js';

/**
 * Contract for a future production body-measurement service.
 * A real provider must return the same measurement object shape.
 * This prototype never calls a remote measurement API.
 */
export class MeasurementProvider {
  async analyze(_input) {
    throw new Error('MeasurementProvider.analyze is not implemented');
  }
}

/**
 * Demo provider. Input photographs are accepted on the contract so a future
 * provider can use them, but they are not read here.
 */
export class IllustrativeMeasurementProvider extends MeasurementProvider {
  async analyze(input) {
    const measurements = buildMeasurements(input.heightCm, input.preset);
    return {
      provider: 'illustrative_demo',
      measurements,
      note: 'Illustrative values come from the entered height and demo preset. Photographs were not used.',
    };
  }
}

let provider = new IllustrativeMeasurementProvider();

export function getProvider() {
  return provider;
}

/** Test or future wiring hook. The UI does not call a remote provider. */
export function setProvider(next) {
  if (!(next instanceof MeasurementProvider)) {
    throw new Error('Provider must extend MeasurementProvider');
  }
  provider = next;
}

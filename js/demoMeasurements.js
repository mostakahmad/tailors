import {
  BASELINES,
  MEASUREMENT_DEFS,
  PRESET_OFFSETS,
  PRESETS,
  REFERENCE_HEIGHT_CM,
} from './config.js';
import { round1 } from './utils.js';

/**
 * Deterministic illustrative measurements.
 * Formula: round1((baselineCm + presetOffsetCm) * (heightCm / 170)).
 * Height itself is the entered height. Photographs are intentionally unused.
 */
export function buildMeasurements(heightCm, preset) {
  const safePreset = PRESETS.includes(preset) ? preset : 'regular';
  const scale = heightCm / REFERENCE_HEIGHT_CM;
  const offsets = PRESET_OFFSETS[safePreset];
  return MEASUREMENT_DEFS.map((def) => {
    const illustrativeCm = def.key === 'height'
      ? round1(heightCm)
      : round1((BASELINES[def.key] + (offsets[def.key] || 0)) * scale);
    return {
      key: def.key,
      group: def.group,
      region: def.region,
      illustrativeCm,
      valueCm: illustrativeCm,
      source: 'illustrative_demo',
      manuallyEdited: false,
    };
  });
}

/** Keep manual edits when height or preset changes. Height always follows the profile. */
export function mergeMeasurements(previous, next) {
  if (!previous?.length) return next;
  return next.map((item) => {
    const old = previous.find((entry) => entry.key === item.key);
    if (old?.manuallyEdited && item.key !== 'height') {
      return {
        ...item,
        valueCm: old.valueCm,
        manuallyEdited: true,
        source: 'manual_entry',
        illustrativeCm: item.illustrativeCm,
      };
    }
    return item;
  });
}

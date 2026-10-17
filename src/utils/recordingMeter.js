/** Match mobile LiveRecordingMeter.js for consistent feel. */
export const BAR_COUNT = 26;
const MIN_DB = -55;
const MAX_DB = -5;

export const METER_KNEE_DB = -35;
const METER_BELOW_KNEE_POWER = 2.15;
const METER_ABOVE_KNEE_POWER = 0.58;
const METER_KNEE_OUTPUT = 0.36;

export function meteringDbToNormalized(db) {
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  return (clamped - MIN_DB) / (MAX_DB - MIN_DB);
}

export function meteringDbToBarDisplay(db) {
  const kneeLin = meteringDbToNormalized(METER_KNEE_DB);
  const linear = Math.max(0, Math.min(1, meteringDbToNormalized(db)));
  if (linear <= kneeLin) {
    const t = kneeLin > 0 ? linear / kneeLin : 0;
    const shaped = Math.pow(Math.max(0, Math.min(1, t)), METER_BELOW_KNEE_POWER);
    return shaped * METER_KNEE_OUTPUT;
  }
  const span = 1 - kneeLin;
  const t = span > 0 ? (linear - kneeLin) / span : 1;
  const shaped = Math.pow(Math.max(0, Math.min(1, t)), METER_ABOVE_KNEE_POWER);
  return METER_KNEE_OUTPUT + (1 - METER_KNEE_OUTPUT) * shaped;
}

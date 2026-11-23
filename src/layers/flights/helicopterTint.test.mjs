import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyAircraft,
  HELICOPTER_TINT_CSS,
} from '../../data/aircraftClass.js';
import { EMERGENCY_TINT_CSS } from '../../data/aircraftEmergency.js';
import {
  EMERGENCY_TINT,
  FLEET_TINT,
  HELICOPTER_TINT,
  MIL_TINT,
  VEHICLE_TINT,
} from './policy.js';

test('helicopter tint is distinct from every other flights tint', () => {
  assert.match(HELICOPTER_TINT_CSS, /^#[0-9a-fA-F]{6}$/);
  assert.notEqual(HELICOPTER_TINT_CSS, EMERGENCY_TINT_CSS);
  const tints = [
    HELICOPTER_TINT,
    EMERGENCY_TINT,
    MIL_TINT,
    VEHICLE_TINT,
    FLEET_TINT,
  ];
  const seen = new Set(tints.map((tint) => JSON.stringify(tint)));
  assert.equal(seen.size, tints.length);
});

test('rotorcraft reach the flights layer as klass helicopter', () => {
  // OpenSky category 8 and ADS-B emitter A7 are both rotorcraft, and
  // the flights layer highlights klass === 'helicopter'.
  assert.equal(classifyAircraft({ category: 8 }), 'helicopter');
  assert.equal(classifyAircraft({ category: 'A7' }), 'helicopter');
  assert.equal(classifyAircraft({ typeCode: 'EC35' }), 'helicopter');
  assert.notEqual(classifyAircraft({ typeCode: 'B738' }), 'helicopter');
});

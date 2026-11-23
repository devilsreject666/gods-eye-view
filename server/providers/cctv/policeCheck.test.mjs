import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleCctvPoliceCheck,
  checkCameraForPolice,
  policeCheckUnavailable,
  POLICE_CHECK_MISSING_KEY_CODE,
  POLICE_CHECK_VISION_NOT_IMPLEMENTED_CODE,
} from './policeCheck.js';

test('policeCheckUnavailable names the missing GEMINI_API_KEY when no key is set', () => {
  const result = policeCheckUnavailable({ env: {} });
  assert.equal(result.code, POLICE_CHECK_MISSING_KEY_CODE);
  assert.match(result.message, /GEMINI_API_KEY/);
  assert.equal(policeCheckUnavailable({ env: { GEMINI_API_KEY: '  ' } }).code, POLICE_CHECK_MISSING_KEY_CODE);
});

test('policeCheckUnavailable reports the vision wiring as the remaining step once a key exists', () => {
  const result = policeCheckUnavailable({ env: { GEMINI_API_KEY: 'test-key' } });
  assert.equal(result.code, POLICE_CHECK_VISION_NOT_IMPLEMENTED_CODE);
  assert.match(result.message, /server\/providers\/gemini\/chat\.js/);
  assert.match(result.message, /server\/providers\/cctv\/policeCheck\.js/);
  assert.doesNotMatch(result.message, /test-key/);
});

test('handleCctvPoliceCheck never reports a detection and never fetches a snapshot without a key', async () => {
  let fetched = false;
  const result = await handleCctvPoliceCheck({
    cameraId: 'cdot-21314',
    source: { id: 'cdot-21314', snapshotUrl: 'https://example.com/snap.png' },
    fetchSnapshot: async () => {
      fetched = true;
      return { body: Buffer.from('fake'), contentType: 'image/jpeg' };
    },
    env: {},
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, POLICE_CHECK_MISSING_KEY_CODE);
  assert.match(result.body.error, /GEMINI_API_KEY/);
  assert.equal('policeVehicleVisible' in result.body, false);
  assert.equal(fetched, false);
});

test('handleCctvPoliceCheck returns 404 for an unknown camera', async () => {
  const result = await handleCctvPoliceCheck({ cameraId: 'cdot-99999', source: null, env: {} });
  assert.equal(result.status, 404);
  assert.equal(result.body.ok, false);
});

test('checkCameraForPolice reports the vision wiring as unavailable and never reports a detection', () => {
  const result = checkCameraForPolice(Buffer.from('fake'));
  assert.equal(result.ok, false);
  assert.equal(result.code, POLICE_CHECK_VISION_NOT_IMPLEMENTED_CODE);
  assert.match(result.error, /server\/providers\/gemini\/chat.js/);
  assert.match(result.error, /checkCameraForPolice/);
  assert.equal('policeVehicleVisible' in result, false);
});

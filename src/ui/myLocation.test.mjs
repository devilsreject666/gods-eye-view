import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MY_LOCATION_FLY_HEIGHT_M,
  MY_LOCATION_TIMEOUT_MS,
  bindMyLocation,
  formatMyLocationMessage,
  myLocationErrorMessage,
} from './myLocation.js';

test('my location message names the coordinates and accuracy', () => {
  const message = formatMyLocationMessage({
    latitude: 39.7392,
    longitude: -104.9903,
    accuracy: 12.4,
  });
  assert.match(message, /39\.73920/);
  assert.match(message, /-104\.99030/);
  assert.match(message, /12 m/);
});

test('my location errors explain permission, availability and timeout', () => {
  assert.match(myLocationErrorMessage({ code: 1 }), /permission/i);
  assert.match(myLocationErrorMessage({ code: 2 }), /could not be determined/i);
  assert.match(myLocationErrorMessage({ code: 3 }), /too long/i);
  assert.equal(typeof myLocationErrorMessage(undefined), 'string');
});

test('my location without geolocation toasts and never crashes', async () => {
  const toasts = [];
  const original = globalThis.navigator?.geolocation;
  Object.defineProperty(globalThis, 'navigator', {
    value: {},
    configurable: true,
  });
  try {
    const { locate } = bindMyLocation({
      viewer: {},
      showToast: (m) => toasts.push(m),
    });
    const result = await locate();
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unsupported');
    assert.equal(toasts.length, 1);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: original ? { geolocation: original } : {},
      configurable: true,
    });
  }
});

test('my location on denied permission toasts and never flies', async () => {
  const toasts = [];
  const flights = [];
  const camera = {
    cancelFlight() {},
    flyTo(destination, options) {
      flights.push([destination, options]);
    },
  };
  const viewer = { entities: { add: () => ({}), remove: () => {} } };
  const originalGeolocation = globalThis.navigator?.geolocation;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      geolocation: {
        getCurrentPosition(_success, error) {
          error({ code: 1 });
        },
      },
    },
    configurable: true,
  });
  try {
    const { locate } = bindMyLocation({
      viewer,
      showToast: (m) => toasts.push(m),
      camera,
    });
    const result = await locate();
    assert.equal(result.ok, false);
    assert.equal(flights.length, 0);
    assert.match(toasts.join(' '), /permission/i);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalGeolocation ? { geolocation: originalGeolocation } : {},
      configurable: true,
    });
  }
});

test('my location on a fix flies the camera, marks it and toasts', async () => {
  const toasts = [];
  const flights = [];
  const markers = [];
  const camera = {
    cancelFlight() {},
    flyTo(destination, options) {
      flights.push([destination, options]);
    },
  };
  const viewer = {
    entities: {
      add: (entity) => {
        markers.push(entity);
        return entity;
      },
      remove: () => {},
    },
  };
  const originalGeolocation = globalThis.navigator?.geolocation;
  let capturedOptions;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      geolocation: {
        getCurrentPosition(success, _error, options) {
          capturedOptions = options;
          success({
            coords: { latitude: 39.7392, longitude: -104.9903, accuracy: 8 },
          });
        },
      },
    },
    configurable: true,
  });
  try {
    const { locate } = bindMyLocation({
      viewer,
      showToast: (m) => toasts.push(m),
      camera,
    });
    const result = await locate();
    assert.equal(result.ok, true);
    assert.equal(capturedOptions.enableHighAccuracy, true);
    assert.equal(capturedOptions.timeout, MY_LOCATION_TIMEOUT_MS);
    assert.equal(flights.length, 1);
    assert.equal(flights[0][0].lat, 39.7392);
    assert.equal(flights[0][0].lon, -104.9903);
    assert.equal(flights[0][0].height, MY_LOCATION_FLY_HEIGHT_M);
    assert.equal(markers.length, 1);
    assert.equal(markers[0].id, 'my-location');
    assert.match(toasts.join(' '), /39\.73920/);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalGeolocation ? { geolocation: originalGeolocation } : {},
      configurable: true,
    });
  }
});

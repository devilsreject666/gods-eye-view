import { fromDegrees, toRadians } from '../geo/index.js';
import { t } from '../i18n/index.js';
import { cameraOf } from '../render/rendererOf.js';

// My Location: ask the browser where the device is, fly the Cesium camera
// there, drop a marker and say what was found. There is no server call and
// no location is stored; the marker is replaced on every successful fix.
// Geolocation errors never throw: they become a friendly toast instead.
export const MY_LOCATION_FLY_HEIGHT_M = 2500;
export const MY_LOCATION_TIMEOUT_MS = 10000;
export const MY_LOCATION_MARKER_ID = 'my-location';

export function formatMyLocationMessage({ latitude, longitude, accuracy }) {
  const lat = Number(latitude).toFixed(5);
  const lon = Number(longitude).toFixed(5);
  const metres = Math.round(Number(accuracy));
  return t('My location: {lat}, {lon} (accurate to about {accuracy} m)', {
    lat,
    lon,
    accuracy: String(metres),
  });
}

export function myLocationErrorMessage(error) {
  if (!error) return t('Location is not available right now.');
  if (error.code === 1) {
    return t(
      'Location permission is needed for My Location. Allow location access in your browser settings and try again.',
    );
  }
  if (error.code === 2) {
    return t(
      'Your location could not be determined right now. Try again in a moment.',
    );
  }
  if (error.code === 3) {
    return t('Finding your location took too long. Try again in a moment.');
  }
  return t('Location is not available right now.');
}

export function bindMyLocation({ viewer, showToast, camera: cameraOverride }) {
  let marker = null;

  function placeMarker(latitude, longitude) {
    try {
      const entities = viewer?.entities;
      if (!entities?.add) return null;
      if (marker) {
        try {
          entities.remove(marker);
        } catch {
          /* marker already gone */
        }
        marker = null;
      }
      marker = entities.add({
        id: MY_LOCATION_MARKER_ID,
        name: t('My location'),
        position: fromDegrees(longitude, latitude, 0),
        point: { pixelSize: 14, outlineWidth: 2 },
        label: { text: t('My location') },
      });
      return marker;
    } catch {
      return null;
    }
  }

  function flyTo(latitude, longitude) {
    // The camera port the app entry binds (see ./render/cesium/unbound);
    // a test may hand one in directly instead of a viewer.
    const camera = cameraOverride ?? cameraOf(viewer);
    camera.cancelFlight();
    camera.flyTo(
      { lon: longitude, lat: latitude, height: MY_LOCATION_FLY_HEIGHT_M },
      {
        orientation: { heading: 0, pitch: toRadians(-90), roll: 0 },
        duration: 2,
      },
    );
  }

  function locate() {
    return new Promise((resolve) => {
      if (!globalThis.navigator?.geolocation) {
        showToast(t('Location is not available in this browser.'));
        resolve({ ok: false, reason: 'unsupported' });
        return;
      }
      globalThis.navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          placeMarker(latitude, longitude);
          try {
            flyTo(latitude, longitude);
          } catch {
            showToast(
              t('Your location was found, but the map could not move there.'),
            );
            resolve({
              ok: false,
              reason: 'fly-failed',
              latitude,
              longitude,
              accuracy,
            });
            return;
          }
          showToast(formatMyLocationMessage({ latitude, longitude, accuracy }));
          resolve({ ok: true, latitude, longitude, accuracy });
        },
        (error) => {
          showToast(myLocationErrorMessage(error));
          resolve({
            ok: false,
            reason: 'geolocation-error',
            code: error?.code,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: MY_LOCATION_TIMEOUT_MS,
          maximumAge: 0,
        },
      );
    });
  }

  function destroy() {
    try {
      if (marker && viewer?.entities?.remove) viewer.entities.remove(marker);
    } catch {
      /* marker already gone */
    }
    marker = null;
  }

  return { locate, destroy };
}

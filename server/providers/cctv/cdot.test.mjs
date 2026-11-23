import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  cdotSnapshotUrlForStream,
  loadCdotSourcesFromOpenData,
  normalizeCdotCamera,
} from './sources.js';

const hlsCamera = {
  id: 21314,
  public: true,
  name: 'I-25 MP 209.15 NB : 0.5 miles N of Evans Ave',
  lastUpdated: 1795422128557,
  location: {
    latitude: 39.69933,
    longitude: -104.9874,
    routeId: 'I-25',
    linearReference: 209.15,
    cityReference: 'Denver',
  },
  views: [
    {
      name: 'Looking North',
      type: 'WMP',
      url: 'https://publicstreamer1.cotrip.org/rtplive/025N20915CAM1RP1/playlist.m3u8',
    },
  ],
  active: true,
};

const stillCamera = {
  id: 21001,
  public: true,
  name: 'I-70 MP 278.5 EB : 0.5 miles E of Havana St',
  location: { latitude: 39.7747, longitude: -104.8663, routeId: 'I-70' },
  views: [
    {
      name: 'Looking East',
      type: 'STILL_IMAGE',
      url: 'https://cocam.carsprogram.org/Cellular/70E27850CAM1RHS.jpg',
    },
  ],
  active: true,
};

const outsideCamera = {
  id: 21301,
  public: true,
  name: 'US 160 MP 168.20 EB : 0.5 miles E of Wolf Creek Ski Area',
  location: { latitude: 37.47636, longitude: -106.7848, routeId: 'US 160' },
  views: [
    {
      name: 'Looking East',
      type: 'STILL_IMAGE',
      url: 'https://cocam.carsprogram.org/Cellular/160E16820CAM1RHS.jpg',
    },
  ],
  active: true,
};

function mockFeed(payload, status = 200) {
  return mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

test('cdotSnapshotUrlForStream derives the COtrip snapshot from an HLS playlist URL', () => {
  assert.equal(
    cdotSnapshotUrlForStream(
      'https://publicstreamer1.cotrip.org/rtplive/025N20915CAM1RP1/playlist.m3u8',
    ),
    'https://cocam.carsprogram.org/Snapshots/025N20915CAM1RP1.flv.png',
  );
  assert.equal(
    cdotSnapshotUrlForStream(
      'https://publicstreamer2.cotrip.org/rtplive/070E27850CAM1RP1/playlist.m3u8',
    ),
    'https://cocam.carsprogram.org/Snapshots/070E27850CAM1RP1.flv.png',
  );
  assert.equal(cdotSnapshotUrlForStream('https://example.com/rtplive/abc/playlist.m3u8'), '');
  assert.equal(cdotSnapshotUrlForStream('https://publicstreamer1.cotrip.org/live/abc/playlist.m3u8'), '');
  assert.equal(
    cdotSnapshotUrlForStream(
      'https://publicstreamer3.cotrip.org/rtplive/025N22030CAM1GP2/playlist.m3u8',
    ),
    'https://cocam.carsprogram.org/Snapshots/025N22030CAM1GP2.flv.png',
  );
  assert.equal(cdotSnapshotUrlForStream(''), '');
  assert.equal(cdotSnapshotUrlForStream(null), '');
});

test('normalizeCdotCamera maps an HLS camera to a source with a snapshot and a north heading', () => {
  const source = normalizeCdotCamera(hlsCamera);
  assert.equal(source.id, 'cdot-21314');
  assert.equal(source.name, hlsCamera.name);
  assert.equal(source.provider, 'CDOT');
  assert.equal(source.city, 'Denver');
  assert.equal(source.feedType, 'hls');
  assert.equal(source.url, hlsCamera.views[0].url);
  assert.equal(
    source.snapshotUrl,
    'https://cocam.carsprogram.org/Snapshots/025N20915CAM1RP1.flv.png',
  );
  assert.equal(source.headingDeg, 0);
  assert.equal(source.headingConfidence, 'high');
  assert.equal(source.frameRefreshMs, 3 * 60 * 1000);
  assert.equal(source.sourceKind, 'cdot-open-data');
  assert.match(source.license, /CDOT/);
});

test('normalizeCdotCamera uses the feed preview URL for an HLS camera', () => {
  const withPreview = {
    ...hlsCamera,
    id: 21806,
    name: 'I-25 MP 220.30 NB : 0.5 miles N of 120th Ave',
    location: { latitude: 39.913581, longitude: -104.9874 },
    views: [
      {
        name: 'Looking North',
        type: 'WMP',
        url: 'https://publicstreamer3.cotrip.org/rtplive/025N22030CAM1GP2/playlist.m3u8',
        videoPreviewUrl:
          'https://cocam.carsprogram.org/Snapshots/025N22030CAM1GP2.flv.png',
      },
    ],
  };
  const source = normalizeCdotCamera(withPreview);
  assert.equal(source.feedType, 'hls');
  assert.equal(
    source.snapshotUrl,
    'https://cocam.carsprogram.org/Snapshots/025N22030CAM1GP2.flv.png',
  );
});

test('normalizeCdotCamera prefers a still view and reads its direction', () => {
  const multiView = {
    ...stillCamera,
    views: [
      {
        name: 'Looking West',
        type: 'WMP',
        url: 'https://publicstreamer2.cotrip.org/rtplive/070E27850CAM1RP1/playlist.m3u8',
      },
      stillCamera.views[0],
    ],
  };
  const source = normalizeCdotCamera(multiView);
  assert.equal(source.feedType, 'image');
  assert.equal(source.url, stillCamera.views[0].url);
  assert.equal(source.snapshotUrl, stillCamera.views[0].url);
  assert.equal(source.headingDeg, 90);
});

test('normalizeCdotCamera rejects cameras outside Denver, inactive cameras and bad streams', () => {
  assert.equal(normalizeCdotCamera(outsideCamera), null);
  assert.equal(normalizeCdotCamera({ ...hlsCamera, active: false }), null);
  assert.equal(normalizeCdotCamera({ ...hlsCamera, views: [] }), null);
  assert.equal(normalizeCdotCamera({ ...hlsCamera, location: { latitude: 39.7 } }), null);
  assert.equal(
    normalizeCdotCamera({
      ...hlsCamera,
      views: [{ name: 'Looking North', type: 'WMP', url: 'https://example.com/x.m3u8' }],
    }),
    null,
  );
});

test('loadCdotSourcesFromOpenData keeps Denver cameras and caps to the nearest N', async (t) => {
  const fetchMock = mockFeed([hlsCamera, stillCamera, outsideCamera]);
  t.after(() => fetchMock.mock.restore());
  const sources = await loadCdotSourcesFromOpenData({}, { CCTV_CDOT_MAX_SOURCES: '1' });
  assert.equal(sources.length, 1);
  // The I-25 camera is closer to central Denver than the I-70 camera.
  assert.equal(sources[0].id, 'cdot-21314');
});

test('loadCdotSourcesFromOpenData returns [] when the feed is down or unusable', async (t) => {
  const badStatus = mockFeed({ error: 'nope' }, 503);
  t.after(() => badStatus.mock.restore());
  assert.deepEqual(await loadCdotSourcesFromOpenData({}, {}), []);
  const throwing = mock.method(globalThis, 'fetch', async () => {
    throw new Error('network down');
  });
  t.after(() => throwing.mock.restore());
  assert.deepEqual(await loadCdotSourcesFromOpenData({}, {}), []);
});

/**
 * On-demand "Check for police" for a CCTV camera snapshot.
 *
 * This is deliberately a gatekeeper, not a vision call. It never guesses,
 * never fakes a detection and never reports a police sighting that did not
 * come from a vision model - there is no model call here at all yet.
 *
 * Two things block a real check, in order:
 *
 * 1. No vision key is configured. `GEMINI_API_KEY` is absent (no `.env` in
 *    this codespace, and the variable is not set in the environment), so
 *    `policeCheckUnavailable()` returns the missing-key message and the
 *    route answers 503. That is the state a user in this codespace sees.
 *
 * 2. The configured Gemini route cannot take an image. The app's Gemini
 *    chat route, `createGeminiChatHandler` in
 *    `server/providers/gemini/chat.js`, validates every part with
 *    `validChatContents`, which only allows text / functionCall /
 *    functionResponse / thoughtSignature parts ("Only text and function
 *    exchanges may cross this route, never media or config"). A snapshot
 *    cannot be sent through it. The remaining wiring is a dedicated
 *    image-capable Gemini `generateContent` call (inlineData parts, model
 *    from `GEMINI_CHAT_MODEL` via `normalizeGeminiModel` in
 *    `server/providers/gemini/config.js`, default `gemini-3.5-flash-lite`)
 *    in this module, `checkCameraForPolice`, plus the client button that
 *    already posts here. Until that call exists, this module returns a
 *    501 and no detection is ever reported.
 *
 * Checks are on-demand only: the client posts once per button click, and
 * there is no background or continuous monitoring loop (the codespace
 * sleeps after 4 hours idle, so checks only run while the app is open).
 */

export const POLICE_CHECK_MISSING_KEY_CODE = 'missing-gemini-api-key';
export const POLICE_CHECK_VISION_NOT_IMPLEMENTED_CODE = 'vision-not-implemented';

export function policeCheckMissingKeyMessage() {
  return (
    'Police check is unavailable: GEMINI_API_KEY is not configured. ' +
    'Set GEMINI_API_KEY in the server environment to enable the Gemini vision check.'
  );
}

export function policeCheckVisionNotImplementedMessage() {
  return (
    'Police check is not wired up yet: the Gemini chat route in ' +
    'server/providers/gemini/chat.js (createGeminiChatHandler) only accepts text, ' +
    'so a camera snapshot cannot be sent through it. A dedicated image-capable ' +
    'Gemini generateContent call is still needed in ' +
    'server/providers/cctv/policeCheck.js (checkCameraForPolice). ' +
    'No police sighting is reported.'
  );
}

/**
 * Return the reason a police check cannot run right now, or null if the
 * vision call exists and a key is configured. Today this always returns a
 * reason: the vision call is the remaining wiring (see above).
 */
export function policeCheckUnavailable({ env = process.env } = {}) {
  const apiKey = env?.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return { code: POLICE_CHECK_MISSING_KEY_CODE, message: policeCheckMissingKeyMessage() };
  }
  return {
    code: POLICE_CHECK_VISION_NOT_IMPLEMENTED_CODE,
    message: policeCheckVisionNotImplementedMessage(),
  };
}

/**
 * Handle one on-demand police check for a camera whose snapshot has
 * already been resolved. `fetchSnapshot` must return the snapshot image
 * ({ body, contentType }) or null; it is only called once a key and a vision
 * call are both available, so today it is never called. Kept separate so the
 * vision wiring lands here and nowhere else.
 */
/**
 * Send one camera snapshot to the vision model and report whether a police
 * vehicle is visible in it.
 *
 * Remaining wiring (see the header): this is where the dedicated
 * image-capable Gemini generateContent call belongs. Until it exists, this
 * always reports the vision wiring as unavailable and never reports a
 * detection.
 */
export function checkCameraForPolice(_snapshot) {
  return {
    ok: false,
    code: POLICE_CHECK_VISION_NOT_IMPLEMENTED_CODE,
    error: policeCheckVisionNotImplementedMessage(),
  };
}

export async function handleCctvPoliceCheck({
  cameraId,
  source,
  fetchSnapshot,
  env = process.env,
} = {}) {
  if (!cameraId || !source) {
    return { status: 404, body: { ok: false, error: 'Camera not found' } };
  }
  const unavailable = policeCheckUnavailable({ env });
  if (unavailable) {
    const status = unavailable.code === POLICE_CHECK_MISSING_KEY_CODE ? 503 : 501;
    return {
      status,
      body: { ok: false, cameraId, code: unavailable.code, error: unavailable.message },
    };
  }
  const snapshot = typeof fetchSnapshot === 'function' ? await fetchSnapshot() : null;
  if (!snapshot) {
    return {
      status: 502,
      body: { ok: false, cameraId, error: 'No snapshot is available for this camera right now' },
    };
  }
  // No vision call exists yet; reaching here means policeCheckUnavailable
  // was changed without adding one. Never report a detection from here.
  const vision = checkCameraForPolice(snapshot);
  return {
    status: 501,
    body: {
      ok: false,
      cameraId,
      ...vision,
    },
  };
}

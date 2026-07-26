// Remember-me (session-only) + single-device binding storage helpers.

const SESSION_ONLY_KEY = 'iwasfat_session_only';
const SESSION_ALIVE_KEY = 'iwasfat_session_alive';
const DEVICE_ID_KEY = 'iwasfat_device_id';
const BASE44_TOKEN_KEY = 'base44_access_token';

/**
 * Call after every successful login.
 * remember = true  → persistent session: clear both flags.
 * remember = false → session-only: mark flags so that if the browser is
 * closed (sessionStorage wiped) the token is rejected on next load.
 */
export const applyRememberPreference = (remember) => {
  try {
    if (remember) {
      localStorage.removeItem(SESSION_ONLY_KEY);
      sessionStorage.removeItem(SESSION_ALIVE_KEY);
    } else {
      localStorage.setItem(SESSION_ONLY_KEY, '1');
      sessionStorage.setItem(SESSION_ALIVE_KEY, '1');
    }
  } catch {
    // storage unavailable (private mode) — ignore
  }
};

/**
 * Run during auth initialization, BEFORE trusting an existing token.
 * If the user chose "don't remember me" and the browser was closed,
 * sessionStorage is gone → drop the Base44 token so they must log in again.
 * Returns true when the token was cleared.
 */
export const enforceSessionOnlyOnBoot = () => {
  try {
    if (
      localStorage.getItem(SESSION_ONLY_KEY) === '1' &&
      !sessionStorage.getItem(SESSION_ALIVE_KEY)
    ) {
      localStorage.removeItem(BASE44_TOKEN_KEY);
      localStorage.removeItem(SESSION_ONLY_KEY);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
};

/** Stable per-browser device id, created on first use. */
export const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown-device';
  }
};

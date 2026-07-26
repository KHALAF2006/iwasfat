// Raw HTTP helpers for Base44 auth endpoints that the npm SDK
// (@base44/sdk@0.8.40) does NOT expose: register, OTP, password reset.
// Probed live against the app backend — see project notes.
import { appParams } from '@/lib/app-params';

const authUrl = (path) =>
  `${appParams.appBaseUrl}/api/apps/${appParams.appId}/auth/${path}`;

/**
 * POST JSON to a Base44 auth endpoint.
 * Resolves with parsed JSON on success; throws an Error with
 * `.status` and `.data` attached on HTTP failure.
 */
async function postAuth(path, body) {
  let res;
  try {
    res = await fetch(authUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    const err = new Error('network_error');
    err.code = 'network_error';
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body — leave data null
  }

  if (!res.ok) {
    const message =
      data?.message || data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const authApi = {
  register: ({ email, password, full_name }) =>
    postAuth('register', { email, password, ...(full_name ? { full_name } : {}) }),

  verifyOtp: ({ email, otp_code }) =>
    postAuth('verify-otp', { email, otp_code }),

  resendOtp: ({ email }) =>
    postAuth('resend-otp', { email }),

  resetPasswordRequest: ({ email }) =>
    postAuth('reset-password-request', { email }),

  resetPassword: ({ reset_token, new_password }) =>
    postAuth('reset-password', { reset_token, new_password }),
};

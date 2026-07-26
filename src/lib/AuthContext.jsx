import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { enforceSessionOnlyOnBoot, getDeviceId } from '@/lib/auth-session';
import { toast } from '@/components/ui/use-toast';
import { useT } from '@/i18n';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [subscriber, setSubscriber] = useState(undefined); // undefined = not checked yet, null = no record
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }
  const t = useT();
  const deviceCheckDone = useRef(false);

  const loadSubscriber = useCallback(async (email) => {
    try {
      const subs = await base44.entities.Subscriber.filter({ email: email });
      setSubscriber(subs[0] || null);
      return subs[0] || null;
    } catch (error) {
      console.error('Subscriber load failed:', error);
      setSubscriber(null);
      return null;
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      await loadSubscriber(currentUser.email);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setSubscriber(null);

      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [loadSubscriber]);

  const checkAppState = useCallback(async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // "Remember me" OFF enforcement: if the user chose a session-only login
      // and the browser was closed (sessionStorage wiped), drop the stored
      // Base44 token so they must sign in again.
      const sessionCleared = enforceSessionOnlyOnBoot();
      if (sessionCleared) {
        try { base44.auth.logout(); } catch { /* token cleanup is best-effort */ }
      }

      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: sessionCleared ? undefined : appParams.token, // Include token if available
        interceptResponses: true
      });

      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);

        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token && !sessionCleared) {
          await checkUserAuth();
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setSubscriber(null);
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);

        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            // Not signed in — public pages must still render.
            setUser(null);
            setIsAuthenticated(false);
            setSubscriber(null);
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [checkUserAuth]);

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  // Single-device binding: once a non-admin user is authenticated, bind their
  // Subscriber row to this browser's device id. If another device already
  // holds the binding, sign this session out.
  useEffect(() => {
    if (deviceCheckDone.current) return;
    if (!isAuthenticated || !user?.email) return;
    deviceCheckDone.current = true;
    if (user.role === 'admin') return; // admins are exempt from device binding

    (async () => {
      try {
        const deviceId = getDeviceId();
        const subs = await base44.entities.Subscriber.filter({ email: user.email });
        const row = subs[0];
        if (!row) return;
        if (row.active_device_id && row.active_device_id !== deviceId) {
          toast({ title: t('auth.deviceSignedOut'), variant: 'destructive' });
          logout(false);
        } else if (row.active_device_id !== deviceId) {
          await base44.entities.Subscriber.update(row.id, { active_device_id: deviceId });
        }
      } catch (error) {
        // Device binding must never crash the app.
        console.error('Device binding check failed:', error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, t]);

  const logout = (redirectTo = true) => {
    setUser(null);
    setSubscriber(null);
    setIsAuthenticated(false);

    if (redirectTo === false) {
      // Just remove the token without redirect
      base44.auth.logout();
    } else {
      // Use the SDK's logout method which handles token cleanup and redirect.
      // Pass a string (e.g. "/") to control where the user lands after sign-out.
      base44.auth.logout(typeof redirectTo === 'string' ? redirectTo : window.location.href);
    }
  };

  const navigateToLogin = () => {
    // Route to the custom in-app login page. AuthProvider lives outside the
    // Router, so a full navigation is used instead of useNavigate.
    window.location.assign('/auth/login');
  };

  return (
    <AuthContext.Provider value={{
      user,
      subscriber,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authChecked,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
      refreshSubscriber: () => (user?.email ? loadSubscriber(user.email) : Promise.resolve(null)),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

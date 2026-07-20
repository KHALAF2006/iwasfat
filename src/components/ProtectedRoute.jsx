import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/i18n';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Button } from '@/components/ui/button';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

/**
 * Route guard for authenticated areas of the app.
 * - Shows a spinner while auth state is being resolved.
 * - Redirects anonymous visitors to the Base44 login flow.
 * - Renders nested routes (<Outlet />) for authenticated users.
 */
export default function ProtectedRoute({ fallback = <DefaultFallback /> }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, navigateToLogin, checkAppState } = useAuth();
  const t = useT();

  const shouldRedirectToLogin =
    authChecked && !isLoadingAuth && !isAuthenticated &&
    (!authError || authError.type === 'auth_required');

  useEffect(() => {
    if (shouldRedirectToLogin) {
      navigateToLogin();
    }
  }, [shouldRedirectToLogin, navigateToLogin]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    if (authError && authError.type !== 'auth_required') {
      // Unexpected error (e.g. network) — offer a retry instead of looping into login.
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-muted-foreground">{t('register.errorLoad')}</p>
          <Button onClick={checkAppState}>{t('common.retry')}</Button>
        </div>
      );
    }
    // Redirect to login is triggered above; keep the spinner while the browser navigates.
    return fallback;
  }

  return <Outlet />;
}

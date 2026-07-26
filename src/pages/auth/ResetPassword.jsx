import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, TriangleAlert } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  AuthLayout,
  FieldError,
  FormError,
  MatchIndicator,
  PasswordField,
  SubmitButton,
} from './shared';

export default function ResetPassword() {
  const t = useT();
  const [searchParams] = useSearchParams();

  const token = useMemo(
    () => searchParams.get('reset_token') || searchParams.get('token') || '',
    [searchParams]
  );

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [tokenRejected, setTokenRejected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');

  const validate = () => {
    const errors = {};
    if (!password) errors.password = t('auth.fieldRequired');
    else if (password.length < 8) errors.password = t('auth.passwordTooShort');
    if (confirm !== password) errors.confirm = t('auth.passwordsNoMatch');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.resetPassword({ reset_token: token, new_password: password });
      setDone(true);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (
        error?.status === 400 || error?.status === 401 || error?.status === 404 ||
        /token|expired|invalid/.test(message)
      ) {
        setTokenRejected(true);
      } else if (error?.code === 'network_error') {
        setFormError(t('auth.errorNetwork'));
      } else {
        setFormError(t('auth.errorResetFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ---- invalid / missing token ----
  if (!token || tokenRejected) {
    return (
      <AuthLayout title={t('auth.resetInvalidTitle')} subtitle={t('auth.resetInvalidBody')}>
        <div className="flex flex-col items-center gap-5">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="h-7 w-7" />
          </span>
          <div className="flex w-full flex-col gap-2.5">
            <Link to="/auth/forgot" className="w-full">
              <Button className="w-full bg-accent hover:bg-accent/90 text-white">
                {t('auth.requestNewLink')}
              </Button>
            </Link>
            <Link to="/auth/login" className="w-full">
              <Button variant="ghost" className="w-full">
                {t('auth.backToLogin')}
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // ---- success ----
  if (done) {
    return (
      <AuthLayout title={t('auth.resetSuccessTitle')} subtitle={t('auth.resetSuccessBody')}>
        <div className="flex flex-col items-center gap-5">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <Link to="/auth/login" className="w-full">
            <Button className="w-full bg-accent hover:bg-accent/90 text-white">
              {t('auth.login')}
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // ---- form ----
  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormError>{formError}</FormError>

        <PasswordField
          id="reset-password"
          label={t('auth.newPassword')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          showStrength
          autoComplete="new-password"
          disabled={loading}
        />

        <div>
          <PasswordField
            id="reset-confirm"
            label={t('auth.confirmPassword')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
          />
          <MatchIndicator password={password} confirm={confirm} />
          <FieldError>{fieldErrors.confirm}</FieldError>
        </div>

        <SubmitButton loading={loading} loadingLabel={t('auth.resettingPassword')}>
          <span className="inline-flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {t('auth.resetPasswordCta')}
          </span>
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}

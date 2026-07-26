import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { authApi } from '@/lib/auth-api';
import { applyRememberPreference } from '@/lib/auth-session';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AuthLayout,
  FieldError,
  FormError,
  PasswordField,
  SubmitButton,
  isValidEmail,
} from './shared';

export default function Login() {
  const t = useT();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { checkUserAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [unverified, setUnverified] = useState(false);

  const validate = () => {
    const errors = {};
    if (!email.trim()) errors.email = t('auth.fieldRequired');
    else if (!isValidEmail(email.trim())) errors.email = t('auth.invalidEmail');
    if (!password) errors.password = t('auth.fieldRequired');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setUnverified(false);
    if (!validate()) return;

    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      applyRememberPreference(remember);
      await checkUserAuth();
      toast({ title: t('auth.loginSuccess') });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const status = error?.status ?? error?.response?.status;
      const message = String(error?.message || '').toLowerCase();
      const looksUnverified =
        status === 403 || /verif|otp|activat|pending/.test(message);
      if (looksUnverified && status !== 401) {
        setUnverified(true);
        setFormError(t('auth.errorUnverified'));
      } else if (status === 401 || /invalid|incorrect|credential|password/.test(message)) {
        setFormError(t('auth.errorInvalidCredentials'));
      } else if (error?.code === 'network_error' || message.includes('fetch')) {
        setFormError(t('auth.errorNetwork'));
      } else {
        setFormError(t('auth.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email.trim() || resending) return;
    setResending(true);
    try {
      await authApi.resendOtp({ email: email.trim() });
      toast({ title: t('auth.resendOtpSent') });
      navigate('/auth/register', {
        state: { step: 'otp', email: email.trim(), password },
      });
    } catch {
      toast({ title: t('auth.errorGeneric'), variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <span>
          {t('auth.noAccount')}{' '}
          <Link to="/auth/register" className="font-medium text-accent hover:underline">
            {t('auth.createAccount')}
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormError>{formError}</FormError>
        {unverified && (
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resending}
            className="w-full text-start text-sm text-accent hover:underline disabled:opacity-50"
          >
            {resending ? t('auth.otpResending') : t('auth.resendOtp')} ←
          </button>
        )}

        <div>
          <Label htmlFor="email" className="mb-1.5 block">{t('auth.email')}</Label>
          <Input
            id="email"
            type="email"
            dir="auto"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            autoComplete="email"
            disabled={loading}
            className={fieldErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
            aria-invalid={!!fieldErrors.email}
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </div>

        <PasswordField
          id="password"
          label={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          autoComplete="current-password"
          disabled={loading}
        />

        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="remember"
            className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none"
          >
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked === true)}
              disabled={loading}
            />
            {t('auth.rememberMe')}
          </label>
          <Link to="/auth/forgot" className="text-sm text-accent hover:underline whitespace-nowrap">
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <SubmitButton loading={loading} loadingLabel={t('auth.signingIn')}>
          <span className="inline-flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {t('auth.login')}
          </span>
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}

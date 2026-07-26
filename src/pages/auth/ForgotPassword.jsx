import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, KeyRound } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { useT } from '@/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  AuthLayout,
  FieldError,
  FormError,
  SubmitButton,
  isValidEmail,
} from './shared';

export default function ForgotPassword() {
  const t = useT();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');

  const requestReset = async (targetEmail) => {
    await authApi.resetPasswordRequest({ email: targetEmail });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError(t('auth.fieldRequired'));
      return;
    }
    if (!isValidEmail(trimmed)) {
      setFieldError(t('auth.invalidEmail'));
      return;
    }
    setFieldError('');
    setLoading(true);
    try {
      await requestReset(trimmed);
      setSent(true);
    } catch (error) {
      if (error?.code === 'network_error') setFormError(t('auth.errorNetwork'));
      else setFormError(t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await requestReset(email.trim());
      toast({ title: t('auth.resendEmailSent') });
    } catch {
      toast({ title: t('auth.errorGeneric'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title={t('auth.checkEmailTitle')}
        subtitle={t('auth.checkEmailBody', { email: email.trim() })}
      >
        <div className="flex flex-col items-center gap-5">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
            <Inbox className="h-7 w-7" />
          </span>
          <div className="flex w-full flex-col gap-2.5">
            <Button variant="outline" onClick={handleResend} disabled={loading} className="w-full">
              {loading ? t('auth.sendingResetLink') : t('auth.resendEmail')}
            </Button>
            <Link to="/login" className="w-full">
              <Button variant="ghost" className="w-full">
                {t('auth.backToLogin')}
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormError>{formError}</FormError>
        <div>
          <Label htmlFor="forgot-email" className="mb-1.5 block">{t('auth.email')}</Label>
          <Input
            id="forgot-email"
            type="email"
            dir="auto"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            autoComplete="email"
            disabled={loading}
            className={fieldError ? 'border-destructive focus-visible:ring-destructive' : ''}
            aria-invalid={!!fieldError}
          />
          <FieldError>{fieldError}</FieldError>
        </div>

        <SubmitButton loading={loading} loadingLabel={t('auth.sendingResetLink')}>
          <span className="inline-flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {t('auth.sendResetLink')}
          </span>
        </SubmitButton>

        <div className="text-center">
          <Link to="/login" className="text-sm text-accent hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

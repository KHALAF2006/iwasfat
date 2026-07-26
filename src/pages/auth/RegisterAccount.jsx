import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Clock3, ShieldCheck, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { authApi } from '@/lib/auth-api';
import { applyRememberPreference } from '@/lib/auth-session';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  AuthLayout,
  FieldError,
  FormError,
  MatchIndicator,
  PasswordField,
  SubmitButton,
  isValidEmail,
} from './shared';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

/** 6-box OTP input: auto-advance, backspace-to-previous, full-paste fill. */
function OtpInput({ value, onChange, disabled }) {
  const inputsRef = useRef([]);
  const digits = value.padEnd(OTP_LENGTH, ' ').slice(0, OTP_LENGTH).split('');

  const setDigit = (index, digit) => {
    const next = value.padEnd(OTP_LENGTH, ' ').slice(0, OTP_LENGTH).split('');
    next[index] = digit;
    onChange(next.join('').replace(/ /g, ''));
  };

  const handleChange = (index) => (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigit(index, ' ');
      return;
    }
    // typing (or mobile autofill) may deliver multiple digits — fill forward
    const next = value.padEnd(OTP_LENGTH, ' ').slice(0, OTP_LENGTH).split('');
    for (let i = 0; i < raw.length && index + i < OTP_LENGTH; i += 1) {
      next[index + i] = raw[i];
    }
    onChange(next.join('').replace(/ /g, ''));
    const focusTo = Math.min(index + raw.length, OTP_LENGTH - 1);
    inputsRef.current[focusTo]?.focus();
  };

  const handleKeyDown = (index) => (e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index] !== ' ') {
        setDigit(index, ' ');
      } else if (index > 0) {
        setDigit(index - 1, ' ');
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    onChange(pasted);
    inputsRef.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  return (
    <div dir="ltr" className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputsRef.current[index] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={OTP_LENGTH}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          value={digit.trim()}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          className="h-12 w-10 sm:h-14 sm:w-12 rounded-lg border border-input bg-transparent text-center text-lg font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        />
      ))}
    </div>
  );
}

export default function RegisterAccount() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { checkUserAuth } = useAuth();

  // 'form' | 'otp' | 'pending' — Login can deep-link us straight to the OTP step
  const incoming = location.state || {};
  const [step, setStep] = useState(incoming.step === 'otp' ? 'otp' : 'form');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(incoming.email || '');
  const [password, setPassword] = useState(incoming.password || '');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(incoming.step === 'otp' ? RESEND_SECONDS : 0);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return undefined;
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  const validate = () => {
    const errors = {};
    if (!fullName.trim()) errors.fullName = t('auth.fieldRequired');
    if (!email.trim()) errors.email = t('auth.fieldRequired');
    else if (!isValidEmail(email.trim())) errors.email = t('auth.invalidEmail');
    if (!password) errors.password = t('auth.fieldRequired');
    else if (password.length < 8) errors.password = t('auth.passwordTooShort');
    if (confirm !== password) errors.confirm = t('auth.passwordsNoMatch');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });
      if (res?.status === 'pending') {
        setStep('pending');
      } else {
        setStep('otp');
        setCountdown(RESEND_SECONDS);
        setOtp('');
      }
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (error?.status === 409 || /exist|already|duplicate|taken/.test(message)) {
        setFormError(t('auth.errorEmailExists'));
      } else if (error?.code === 'network_error') {
        setFormError(t('auth.errorNetwork'));
      } else {
        setFormError(t('auth.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setFormError('');
    try {
      await authApi.resendOtp({ email: email.trim() });
      setCountdown(RESEND_SECONDS);
      setOtp('');
      toast({ title: t('auth.otpResent') });
    } catch {
      toast({ title: t('auth.errorGeneric'), variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setFormError('');
    if (otp.length !== OTP_LENGTH) return;
    setLoading(true);
    try {
      await authApi.verifyOtp({ email: email.trim(), otp_code: otp });
      // verified — sign in to establish a session, then continue onboarding
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      applyRememberPreference(true);
      await checkUserAuth();
      toast({ title: t('auth.verifySuccess') });
      navigate('/register', { replace: true });
    } catch (error) {
      if (error?.code === 'network_error') {
        setFormError(t('auth.errorNetwork'));
      } else {
        setFormError(t('auth.otpErrorInvalid'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ---- pending admin approval screen ----
  if (step === 'pending') {
    return (
      <AuthLayout title={t('auth.pendingTitle')} subtitle={t('auth.pendingBody')}>
        <div className="flex flex-col items-center gap-5">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15">
            <Clock3 className="h-7 w-7" />
          </span>
          <Link to="/login" className="w-full">
            <Button variant="outline" className="w-full">
              {t('auth.pendingBackToLogin')}
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // ---- OTP verification screen ----
  if (step === 'otp') {
    return (
      <AuthLayout
        title={t('auth.otpTitle')}
        subtitle={t('auth.otpSubtitle', { email: email.trim() })}
      >
        <form onSubmit={handleVerify} className="space-y-5">
          <FormError>{formError}</FormError>
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />

          <SubmitButton
            loading={loading}
            loadingLabel={t('auth.otpVerifying')}
            disabled={otp.length !== OTP_LENGTH}
          >
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t('auth.otpVerify')}
            </span>
          </SubmitButton>

          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('auth.otpResendIn', { seconds: countdown })}
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
              >
                {resending ? t('auth.otpResending') : t('auth.otpResend')}
              </button>
            )}
          </div>
        </form>
      </AuthLayout>
    );
  }

  // ---- registration form ----
  return (
    <AuthLayout
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <span>
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            {t('auth.login')}
          </Link>
        </span>
      }
    >
      <form onSubmit={handleRegister} noValidate className="space-y-4">
        <FormError>{formError}</FormError>

        <div>
          <Label htmlFor="fullName" className="mb-1.5 block">{t('auth.fullName')}</Label>
          <Input
            id="fullName"
            type="text"
            dir="auto"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('auth.fullNamePlaceholder')}
            autoComplete="name"
            disabled={loading}
            className={fieldErrors.fullName ? 'border-destructive focus-visible:ring-destructive' : ''}
            aria-invalid={!!fieldErrors.fullName}
          />
          <FieldError>{fieldErrors.fullName}</FieldError>
        </div>

        <div>
          <Label htmlFor="reg-email" className="mb-1.5 block">{t('auth.email')}</Label>
          <Input
            id="reg-email"
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
          id="reg-password"
          label={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          showStrength
          autoComplete="new-password"
          disabled={loading}
        />

        <div>
          <PasswordField
            id="reg-confirm"
            label={t('auth.confirmPassword')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
          />
          <MatchIndicator password={password} confirm={confirm} />
          <FieldError>{fieldErrors.confirm}</FieldError>
        </div>

        <SubmitButton loading={loading} loadingLabel={t('auth.creatingAccount')}>
          <span className="inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {t('auth.createAccount')}
          </span>
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}

// Shared building blocks for the custom auth pages.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/** Centered card on a subtle gradient backdrop, with logo + language switcher. */
export function AuthLayout({ title, subtitle, children, footer }) {
  const t = useT();
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-teal-50 dark:from-slate-950 dark:via-background dark:to-emerald-950/30">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-32 -start-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -end-32 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="absolute top-4 end-4">
        <LanguageSwitcher className="text-foreground/70" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white text-xl font-black shadow-lg shadow-accent/25">
              W
            </span>
            <span className="text-2xl font-bold tracking-tight">I Was Fat</span>
          </Link>
          <p className="text-sm text-muted-foreground">{t('auth.appTagline')}</p>
        </div>

        <Card className="border-border/60 shadow-xl shadow-black/5 backdrop-blur-sm bg-card/95">
          <div className="p-6 sm:p-8">
            {(title || subtitle) && (
              <div className="mb-6 text-center">
                {title && <h1 className="text-xl font-bold mb-1.5">{title}</h1>}
                {subtitle && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
                )}
              </div>
            )}
            {children}
          </div>
        </Card>

        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-destructive">{children}</p>;
}

export function HelperText({ children, className }) {
  if (!children) return null;
  return <p className={cn('mt-1.5 text-xs text-muted-foreground', className)}>{children}</p>;
}

/** Inline form error banner (server-side errors). */
export function FormError({ children }) {
  if (!children) return null;
  return (
    <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
      {children}
    </div>
  );
}

/** Submit button with spinner + disabled loading state. */
export function SubmitButton({ loading, loadingLabel, children, className, ...props }) {
  return (
    <Button
      type="submit"
      disabled={loading || props.disabled}
      className={cn('w-full bg-accent hover:bg-accent/90 text-white', className)}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel || children}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}

/** 0–5 password strength score: length / case mix / digit / symbol. */
export const passwordScore = (pw) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return score;
};

export const strengthLevel = (pw) => {
  const s = passwordScore(pw);
  if (s <= 2) return 'weak';
  if (s === 3) return 'fair';
  return 'strong';
};

function StrengthMeter({ password }) {
  const t = useT();
  const level = strengthLevel(password);
  const score = passwordScore(password);
  const colors = {
    weak: 'bg-destructive',
    fair: 'bg-amber-500',
    strong: 'bg-emerald-500',
  };
  const labels = {
    weak: t('auth.strengthWeak'),
    fair: t('auth.strengthFair'),
    strong: t('auth.strengthStrong'),
  };
  const filled = Math.max(1, Math.min(3, level === 'weak' ? 1 : level === 'fair' ? 2 : 3));
  return (
    <div className="mt-2">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= filled ? colors[level] : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {labels[level]}
        <span className="mx-1">·</span>
        {t('auth.strengthHint')}
      </p>
    </div>
  );
}

/**
 * Password input with eye show/hide toggle and optional live strength meter.
 * Logical properties (pe-/end-) keep the eye on the correct side in RTL.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  showStrength = false,
  autoComplete = 'current-password',
  disabled,
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      {label && <Label htmlFor={id} className="mb-1.5 block">{label}</Label>}
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          dir="auto"
          value={value}
          onChange={onChange}
          placeholder={placeholder ?? t('auth.passwordPlaceholder')}
          autoComplete={autoComplete}
          disabled={disabled}
          className={cn('pe-10', error && 'border-destructive focus-visible:ring-destructive')}
          aria-invalid={!!error}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && value ? <StrengthMeter password={value} /> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Live match indicator for the confirm-password field. */
export function MatchIndicator({ password, confirm }) {
  const t = useT();
  if (!confirm) return null;
  const match = password === confirm;
  return (
    <p
      className={cn(
        'mt-1.5 inline-flex items-center gap-1 text-xs',
        match ? 'text-emerald-600' : 'text-destructive'
      )}
    >
      {match ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {match ? t('auth.passwordsMatch') : t('auth.passwordsNoMatch')}
    </p>
  );
}

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

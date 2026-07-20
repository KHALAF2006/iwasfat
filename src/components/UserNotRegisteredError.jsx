import React from 'react';
import { useT } from '@/i18n';

const UserNotRegisteredError = () => {
  const t = useT();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-lg border border-border/50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">{t('errors.notRegisteredTitle')}</h1>
          <p className="text-muted-foreground mb-8">
            {t('errors.notRegisteredBody')}
          </p>
          <div className="p-4 bg-secondary/50 rounded-md text-sm text-muted-foreground">
            <p>{t('errors.notRegisteredTips')}</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-start">
              <li>{t('errors.tip1')}</li>
              <li>{t('errors.tip2')}</li>
              <li>{t('errors.tip3')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;

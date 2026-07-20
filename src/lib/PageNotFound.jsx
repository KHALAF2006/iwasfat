import { useLocation, Link } from 'react-router-dom';
import { useT } from '@/i18n';
import { Home } from 'lucide-react';

export default function PageNotFound() {
    const location = useLocation();
    const pageName = location.pathname.substring(1);
    const t = useT();

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    {/* 404 Error Code */}
                    <div className="space-y-2">
                        <h1 className="text-7xl font-light text-muted-foreground/40">404</h1>
                        <div className="h-0.5 w-16 bg-border mx-auto"></div>
                    </div>

                    {/* Main Message */}
                    <div className="space-y-3">
                        <h2 className="text-2xl font-medium text-foreground">
                            {t('errors.notFoundTitle')}
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            {t('errors.notFoundBody', { page: pageName })}
                        </p>
                    </div>

                    {/* Action Button */}
                    <div className="pt-6">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-secondary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        >
                            <Home className="w-4 h-4" />
                            {t('errors.goHome')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorState({ title, description, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-center max-w-sm mb-6">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
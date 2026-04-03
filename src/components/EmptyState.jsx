import { AlertCircle } from 'lucide-react';

export default function EmptyState({ title, description, icon: Icon = AlertCircle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Icon className="w-16 h-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-center max-w-sm">{description}</p>
    </div>
  );
}
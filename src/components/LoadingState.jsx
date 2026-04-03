export default function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-secondary border-t-primary rounded-full animate-spin"></div>
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  );
}
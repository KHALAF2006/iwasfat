export default function CalorieRing({ consumed, target, weight }) {
  const percentage = Math.min((consumed / target) * 100, 100);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
        {/* Background circle */}
        <circle cx="100" cy="100" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="12" />
        {/* Progress circle */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={percentage > 90 ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-foreground">{weight || "--"}</span>
        <span className="text-sm text-muted-foreground">كغ</span>
        <div className="mt-1 text-xs text-muted-foreground">
          {consumed} / {target} سعرة
        </div>
      </div>
    </div>
  );
}
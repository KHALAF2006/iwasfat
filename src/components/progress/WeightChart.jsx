import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Area, AreaChart } from "recharts";
import { useT } from "@/i18n";

export default function WeightChart({ data, targetWeight }) {
  const t = useT();
  const weightName = t("components.charts.weightName");

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
          <p className="text-muted-foreground mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }} className="font-bold">
              {p.name}: {p.value} {p.name === weightName ? t("common.kg") : ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length < 2) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <span className="text-4xl">📊</span>
        <p className="text-sm">{t("components.charts.logWeightRegularly")}</p>
      </div>
    );
  }

  const min = Math.min(...data.map(d => d.weight)) - 2;
  const max = Math.max(...data.map(d => d.weight)) + 2;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis domain={[min, max]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={40} />
        <Tooltip content={<CustomTooltip />} />
        {targetWeight && (
          <ReferenceLine y={targetWeight} stroke="hsl(var(--accent))" strokeDasharray="5 5" label={{ value: t("components.charts.goalLabel", { value: targetWeight }), position: "right", fontSize: 11, fill: "hsl(var(--accent))" }} />
        )}
        <Area type="monotone" dataKey="weight" name={weightName} stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#weightGradient)" dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 2, stroke: "white" }} activeDot={{ r: 6 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

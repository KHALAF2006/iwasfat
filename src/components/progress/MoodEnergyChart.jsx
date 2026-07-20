import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useT } from "@/i18n";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-medium">
            {p.name}: {p.value}/5
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function MoodEnergyChart({ data }) {
  const t = useT();

  if (!data || data.length < 2) {
    return (
      <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
        {t("components.charts.logToSee")}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={20} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="energy" name={t("components.charts.energy")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="mood" name={t("components.charts.mood")} fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

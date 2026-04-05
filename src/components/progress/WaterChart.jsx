import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
        <p className="text-muted-foreground mb-1">{label}</p>
        <p className="text-blue-500 font-bold">{payload[0]?.value} أكواب</p>
      </div>
    );
  }
  return null;
};

export default function WaterChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
        سجّل بياناتك لرؤية التحليل
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={20} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={8} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: "الهدف 8", position: "right", fontSize: 10, fill: "#3b82f6" }} />
        <Bar dataKey="water" name="أكواب الماء" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
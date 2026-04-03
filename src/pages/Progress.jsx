import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, TrendingDown, Droplets, Target, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import moment from "moment";

export default function Progress() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [water, setWater] = useState("");

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });

  const { data: weightLogs = [] } = useQuery({
    queryKey: ["weightLogs"],
    queryFn: () => base44.entities.WeightLog.filter({ subscriber_id: subscriber?.id }, "date"),
    enabled: !!subscriber,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.WeightLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weightLogs"] });
      setOpen(false);
      setWeight("");
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      subscriber_id: subscriber?.id,
      date: moment().format("YYYY-MM-DD"),
      weight: parseFloat(weight),
      energy_level: energy,
      mood_level: mood,
      water_cups: parseFloat(water) || 0,
    });
  };

  const startWeight = subscriber?.current_weight || 0;
  const targetWeight = subscriber?.target_weight || 0;
  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : startWeight;
  const totalLost = startWeight - currentWeight;
  const remaining = currentWeight - targetWeight;

  const chartData = weightLogs.map(log => ({
    date: moment(log.date).format("MM/DD"),
    weight: log.weight,
  }));

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">تتبع التقدم</h1>
          <p className="text-muted-foreground text-sm">تابع رحلتك نحو هدفك</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground gap-1">
              <Plus className="w-4 h-4" /> تسجيل
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تسجيل وزن اليوم</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>الوزن (كغ)</Label>
                <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="مثال: 82.5" className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>مستوى الطاقة</Label>
                <div className="flex gap-2 mt-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setEnergy(n)} className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${n <= energy ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>المزاج</Label>
                <div className="flex gap-2 mt-1.5">
                  {["😞", "😐", "🙂", "😊", "🤩"].map((emoji, i) => (
                    <button key={i} onClick={() => setMood(i + 1)} className={`w-10 h-10 rounded-lg text-lg transition-all ${i + 1 <= mood ? "scale-110 bg-secondary" : "opacity-40"}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>أكواب الماء اليوم</Label>
                <Input type="number" value={water} onChange={e => setWater(e.target.value)} className="mt-1.5" dir="ltr" />
              </div>
              <Button onClick={handleSave} disabled={!weight || saveMutation.isPending} className="w-full bg-primary text-primary-foreground py-5">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
          <TrendingDown className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{totalLost.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">كغ فقدت</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
          <Target className="w-5 h-5 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{remaining.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">كغ متبقية</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-4 text-center">
          <Droplets className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{currentWeight}</p>
          <p className="text-xs text-muted-foreground">الوزن الحالي</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">منحنى الوزن</h3>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            سجّل وزنك بانتظام لرؤية الرسم البياني
          </div>
        )}
      </div>

      {/* Weight Log History */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <h3 className="font-semibold text-foreground mb-4">سجل الوزن</h3>
        {weightLogs.length > 0 ? (
          <div className="space-y-3">
            {[...weightLogs].reverse().slice(0, 10).map((log, i) => (
              <div key={log.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{moment(log.date).format("DD/MM/YYYY")}</span>
                <div className="flex items-center gap-3">
                  {log.energy_level && <span className="text-xs">⚡{log.energy_level}</span>}
                  <span className="font-bold text-foreground">{log.weight} كغ</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-4">لا توجد تسجيلات بعد</p>
        )}
      </div>
    </div>
  );
}
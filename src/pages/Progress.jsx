import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import moment from "moment";
import WeightChart from "@/components/progress/WeightChart";
import MoodEnergyChart from "@/components/progress/MoodEnergyChart";
import WaterChart from "@/components/progress/WaterChart";
import ProgressStats from "@/components/progress/ProgressStats";
import { useT } from "@/i18n";
import { showApiError } from "@/lib/api-error";

const PERIOD_KEYS = ["week", "month", "threeMonths", "all"];
const PERIOD_VALUES = { week: "week", month: "month", threeMonths: "3months", all: "all" };

export default function Progress() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("month");
  const [activeChart, setActiveChart] = useState("weight");
  const [weight, setWeight] = useState("");
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [water, setWater] = useState("");
  const t = useT();

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });

  const { data: weightLogs = [] } = useQuery({
    queryKey: ["weightLogs", subscriber?.id],
    queryFn: () => base44.entities.WeightLog.filter({ subscriber_id: subscriber?.id }, "date"),
    enabled: !!subscriber,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.WeightLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weightLogs"] });
      setOpen(false);
      setWeight("");
      setWater("");
    },
    onError: (err) => showApiError(err),
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

  // Filter by period
  const filterByPeriod = (logs) => {
    const now = moment();
    return logs.filter(log => {
      const d = moment(log.date);
      if (period === "week") return d.isAfter(now.clone().subtract(7, "days"));
      if (period === "month") return d.isAfter(now.clone().subtract(30, "days"));
      if (period === "3months") return d.isAfter(now.clone().subtract(90, "days"));
      return true;
    });
  };

  const filtered = filterByPeriod(weightLogs);

  const formatDate = (log) => {
    if (period === "week") return moment(log.date).format("ddd DD");
    if (period === "month") return moment(log.date).format("DD/MM");
    return moment(log.date).format("MMM YY");
  };

  const weightData = filtered.map(log => ({ date: formatDate(log), weight: log.weight }));
  const moodData = filtered.filter(l => l.energy_level || l.mood_level).map(log => ({
    date: formatDate(log),
    energy: log.energy_level || 0,
    mood: log.mood_level || 0,
  }));
  const waterData = filtered.filter(l => l.water_cups).map(log => ({
    date: formatDate(log),
    water: log.water_cups,
  }));

  const CHART_KEYS = ["weight", "mood", "water"];

  return (
    <div className="px-4 pt-6 pb-20 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("progress.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("progress.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="w-4 h-4" /> {t("progress.log")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("progress.dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("progress.weight")}</Label>
                <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={t("progress.weightPlaceholder")} className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>{t("progress.energy")}</Label>
                <div className="flex gap-2 mt-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setEnergy(n)} className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${n <= energy ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t("progress.mood")}</Label>
                <div className="flex gap-2 mt-1.5">
                  {["😞", "😐", "🙂", "😊", "🤩"].map((emoji, i) => (
                    <button key={i} onClick={() => setMood(i + 1)} className={`w-10 h-10 rounded-lg text-lg transition-all ${i + 1 === mood ? "scale-110 bg-secondary ring-2 ring-primary" : "opacity-50"}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t("progress.waterCups")}</Label>
                <Input type="number" value={water} onChange={e => setWater(e.target.value)} className="mt-1.5" dir="ltr" placeholder={t("progress.waterPlaceholder")} />
              </div>
              <Button onClick={handleSave} disabled={!weight || saveMutation.isPending} className="w-full py-5">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <ProgressStats subscriber={subscriber} weightLogs={weightLogs} />

      {/* Period Selector */}
      <div className="flex gap-2 bg-secondary rounded-2xl p-1">
        {PERIOD_KEYS.map(key => (
          <button
            key={key}
            onClick={() => setPeriod(PERIOD_VALUES[key])}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${period === PERIOD_VALUES[key] ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
          >
            {t(`progress.periods.${key}`)}
          </button>
        ))}
      </div>

      {/* Chart Tabs */}
      <div className="flex gap-2">
        {CHART_KEYS.map(key => (
          <button
            key={key}
            onClick={() => setActiveChart(key)}
            className={`flex-1 py-2 px-1 rounded-xl text-xs font-medium border transition-all ${activeChart === key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
          >
            {t(`progress.charts.${key}`)}
          </button>
        ))}
      </div>

      {/* Chart Card */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        {activeChart === "weight" && (
          <>
            <h3 className="font-semibold text-foreground mb-4">{t("progress.chartTitles.weight")}</h3>
            <WeightChart data={weightData} targetWeight={subscriber?.target_weight} />
          </>
        )}
        {activeChart === "mood" && (
          <>
            <h3 className="font-semibold text-foreground mb-4">{t("progress.chartTitles.mood")}</h3>
            <MoodEnergyChart data={moodData} />
          </>
        )}
        {activeChart === "water" && (
          <>
            <h3 className="font-semibold text-foreground mb-4">{t("progress.chartTitles.water")}</h3>
            <WaterChart data={waterData} />
          </>
        )}
      </div>

      {/* History */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <h3 className="font-semibold text-foreground mb-4">{t("progress.history")} ({filtered.length})</h3>
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {[...filtered].reverse().slice(0, 15).map(log => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{moment(log.date).format("DD/MM/YYYY")}</p>
                  <div className="flex gap-3 mt-0.5">
                    {log.energy_level && <span className="text-xs text-muted-foreground">⚡ {log.energy_level}/5</span>}
                    {log.mood_level && <span className="text-xs text-muted-foreground">😊 {log.mood_level}/5</span>}
                    {log.water_cups && <span className="text-xs text-muted-foreground">💧 {log.water_cups}</span>}
                  </div>
                </div>
                <span className="text-lg font-bold text-primary">{log.weight} {t("common.kg")}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-4">{t("progress.empty")}</p>
        )}
      </div>
    </div>
  );
}

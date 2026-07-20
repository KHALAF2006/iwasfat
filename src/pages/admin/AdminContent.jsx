import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Video, Image, FileText, Trash2, Edit2, Loader2, LayoutList, Columns3 } from "lucide-react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { useToast } from "@/components/ui/use-toast";
import { useT } from "@/i18n";

const CATEGORIES = { nutrition: "التغذية", exercise: "التمارين", shopping: "التسوق", appetite: "الشهية", motivation: "تحفيز", general: "عام" };
const CONTENT_TYPES = { video: "فيديو", image: "صورة", infographic: "إنفوجرافيك", pdf: "ملف PDF" };
const TYPE_ICONS = { video: Video, image: Image, infographic: Image, pdf: FileText };

// Board state derivation from ContentItem fields:
// published = is_published; scheduled = unpublished with a future publish_date; draft = otherwise.
function boardState(item) {
  if (item.is_published) return "published";
  if (item.publish_date && moment(item.publish_date).isAfter(moment())) return "scheduled";
  return "draft";
}

const BOARD_COLUMNS = [
  { id: "draft", dot: "bg-slate-400" },
  { id: "scheduled", dot: "bg-amber-400" },
  { id: "published", dot: "bg-emerald-500" },
];

const nextStateData = (state) => {
  if (state === "published") return { is_published: true, publish_date: new Date().toISOString() };
  if (state === "scheduled") return { is_published: false, publish_date: moment().add(1, "day").toISOString() };
  return { is_published: false, publish_date: null };
};

export default function AdminContent() {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState("board"); // "board" | "list"
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "", description: "", content_type: "video", category: "nutrition",
    video_url: "", duration_minutes: "", week_number: "", day_number: "",
    is_published: false, target_all: true,
  });
  const [file, setFile] = useState(null);

  const { data: content = [] } = useQuery({
    queryKey: ["allContent"],
    queryFn: () => base44.entities.ContentItem.list("-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      let fileUrl = data.file_url;
      let thumbnail = data.thumbnail;
      if (file) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        if (data.content_type === "video") thumbnail = file_url;
        else fileUrl = file_url;
      }
      const finalData = { ...data, file_url: fileUrl, thumbnail, publish_date: new Date().toISOString() };
      return editingId ? base44.entities.ContentItem.update(editingId, finalData) : base44.entities.ContentItem.create(finalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allContent"] });
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContentItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allContent"] }),
  });

  // Board move: optimistic update with rollback on failure.
  const moveMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContentItem.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["allContent"] });
      const previous = queryClient.getQueryData(["allContent"]);
      queryClient.setQueryData(["allContent"], (old = []) =>
        old.map(c => (c.id === id ? { ...c, ...data } : c))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["allContent"], ctx.previous);
      toast({ title: t("adminPro.contentBoard.moveFailed"), variant: "destructive" });
    },
    onSuccess: () => toast({ title: t("adminPro.contentBoard.moved") }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["allContent"] }),
  });

  const handleBoardMove = (itemId, _from, to) => {
    const item = content.find(c => c.id === itemId);
    if (!item || boardState(item) === to) return;
    moveMutation.mutate({ id: itemId, data: nextStateData(to) });
  };

  const resetForm = () => {
    setForm({ title: "", description: "", content_type: "video", category: "nutrition", video_url: "", duration_minutes: "", week_number: "", day_number: "", is_published: false, target_all: true });
    setFile(null);
    setEditingId(null);
  };

  const handleEdit = (item) => {
    setForm({
      title: item.title, description: item.description || "", content_type: item.content_type,
      category: item.category || "nutrition", video_url: item.video_url || "", duration_minutes: item.duration_minutes || "",
      week_number: item.week_number || "", day_number: item.day_number || "", is_published: item.is_published, target_all: item.target_all !== false,
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const boardColumns = BOARD_COLUMNS.map(col => ({
    ...col,
    title: t(`adminPro.contentBoard.${col.id}`),
    items: content.filter(c => boardState(c) === col.id),
  }));

  const renderBoardCard = (item) => {
    const Icon = TYPE_ICONS[item.content_type] || FileText;
    const state = boardState(item);
    return (
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </span>
          <p className="font-semibold text-sm text-foreground truncate">{item.title}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{CATEGORIES[item.category] || "—"}</span>
          {state === "scheduled" && item.publish_date && (
            <span className="text-amber-600 font-medium shrink-0">
              {t("adminPro.contentBoard.scheduledOn", { date: moment(item.publish_date).format("DD/MM") })}
            </span>
          )}
          {item.week_number != null && item.week_number !== "" && state !== "scheduled" && (
            <span className="shrink-0">أسبوع {item.week_number}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <h1 className="text-3xl font-bold text-foreground">{t('admin.titles.content')}</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setView("board")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${view === "board" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              <Columns3 className="w-3.5 h-3.5" /> {t("adminPro.contentBoard.board")}
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutList className="w-3.5 h-3.5" /> {t("adminPro.contentBoard.list")}
            </button>
          </div>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground gap-1"><Plus className="w-4 h-4" /> محتوى جديد</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "تعديل المحتوى" : "إضافة محتوى جديد"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>العنوان</Label>
                  <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>نوع المحتوى</Label>
                    <Select value={form.content_type} onValueChange={v => setForm(p => ({ ...p, content_type: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONTENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>الفئة</Label>
                    <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.content_type === "video" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>رابط الفيديو</Label>
                      <Input value={form.video_url} onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))} className="mt-1" dir="ltr" placeholder="https://..." />
                    </div>
                    <div>
                      <Label>المدة (دقائق)</Label>
                      <Input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))} className="mt-1" dir="ltr" />
                    </div>
                  </div>
                )}
                <div>
                  <Label>رفع ملف / صورة مصغرة</Label>
                  <Input type="file" onChange={e => setFile(e.target.files[0])} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>رقم الأسبوع</Label>
                    <Input type="number" value={form.week_number} onChange={e => setForm(p => ({ ...p, week_number: parseInt(e.target.value) }))} className="mt-1" dir="ltr" />
                  </div>
                  <div>
                    <Label>رقم اليوم</Label>
                    <Input type="number" value={form.day_number} onChange={e => setForm(p => ({ ...p, day_number: parseInt(e.target.value) }))} className="mt-1" dir="ltr" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>نشر الآن</Label>
                  <Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} />
                </div>
                <Button onClick={() => saveMutation.mutate(form)} disabled={!form.title || saveMutation.isPending} className="w-full bg-primary text-primary-foreground">
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {view === "board" ? (
        <KanbanBoard
          columns={boardColumns}
          onMove={handleBoardMove}
          renderCard={renderBoardCard}
          getId={(c) => c.id}
          emptyText={t("adminPro.contentBoard.empty")}
        />
      ) : (
        /* Content List */
        <div className="space-y-3 max-w-6xl">
          {content.map(item => {
            const Icon = TYPE_ICONS[item.content_type] || FileText;
            return (
              <div key={item.id} className="bg-card rounded-2xl border border-border/50 p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{CATEGORIES[item.category]}</span>
                    <span>•</span>
                    <span>{CONTENT_TYPES[item.content_type]}</span>
                    {item.week_number != null && <><span>•</span><span>أسبوع {item.week_number}</span></>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${item.is_published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {item.is_published ? "منشور" : "مسودة"}
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {content.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">لا يوجد محتوى بعد. أضف أول محتوى!</div>
          )}
        </div>
      )}
    </div>
  );
}

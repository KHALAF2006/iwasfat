import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Video, Image, FileText, Trash2, Edit2, Loader2 } from "lucide-react";
import moment from "moment";

const CATEGORIES = { nutrition: "التغذية", exercise: "التمارين", shopping: "التسوق", appetite: "الشهية", motivation: "تحفيز", general: "عام" };
const CONTENT_TYPES = { video: "فيديو", image: "صورة", infographic: "إنفوجرافيك", pdf: "ملف PDF" };
const TYPE_ICONS = { video: Video, image: Image, infographic: Image, pdf: FileText };

export default function AdminContent() {
  const queryClient = useQueryClient();
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">إدارة المحتوى</h1>
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

      {/* Content List */}
      <div className="space-y-3">
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
                  {item.week_number && <><span>•</span><span>أسبوع {item.week_number}</span></>}
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
    </div>
  );
}
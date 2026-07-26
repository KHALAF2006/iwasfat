import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Plus, Edit2, Trash2, Loader2, Send, Eye, EyeOff, Radio,
  CheckCircle2, MessageSquare, ChevronLeft, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import StatCard from "@/components/admin/StatCard";
import { useToast } from "@/components/ui/use-toast";
import { showApiError } from "@/lib/api-error";
import { useT } from "@/i18n";

const PAGE_SIZE = 50;
const MAX_MESSAGE = 4096;

const emptyForm = {
  name: "",
  bot_token: "",
  channel_id: "",
  description: "",
  notes: "",
  is_active: true,
};

export default function AdminTelegram() {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showToken, setShowToken] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(1);

  // Composer state
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [sessionSent, setSessionSent] = useState(0);

  // Support up to 1000 channels; the table paginates locally.
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["allTelegramChannels"],
    queryFn: () => base44.entities.TelegramChannel.list("-created_date", 1000),
  });

  const activeChannels = useMemo(() => channels.filter(c => c.is_active !== false), [channels]);

  const pageCount = Math.max(1, Math.ceil(channels.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = channels.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowToken(false); };

  const saveMutation = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.TelegramChannel.update(editingId, data)
      : base44.entities.TelegramChannel.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allTelegramChannels"] });
      setOpen(false);
      resetForm();
      toast({ title: t("telegramAdmin.saved") });
    },
    onError: (err) => showApiError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TelegramChannel.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allTelegramChannels"] });
      setDeleteTarget(null);
      toast({ title: t("telegramAdmin.deleted") });
    },
    onError: (err) => showApiError(err),
  });

  const toggleMutation = useMutation({
    mutationFn: (channel) =>
      base44.entities.TelegramChannel.update(channel.id, { is_active: !(channel.is_active !== false) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allTelegramChannels"] }),
    onError: (err) => showApiError(err),
  });

  const sendMutation = useMutation({
    mutationFn: (ids) =>
      base44.functions.invoke("sendTelegramChannelMessage", { channel_ids: ids, message: message.trim() }),
    onSuccess: (res) => {
      const data = res?.data ?? res;
      const results = data?.results || [];
      const ok = results.filter(r => r.ok);
      const failed = results.filter(r => !r.ok);
      setSessionSent(n => n + ok.length);

      if (failed.length === 0 && ok.length > 0) {
        toast({ title: t("telegramAdmin.composer.sentOk", { count: ok.length }) });
        setMessage("");
      } else if (ok.length > 0) {
        toast({ title: t("telegramAdmin.composer.sentPartial", { ok: ok.length, failed: failed.length }) });
      } else {
        toast({ title: t("telegramAdmin.composer.sentFailed"), variant: "destructive" });
      }
      // Per-channel failure detail
      failed.forEach(r => {
        toast({
          title: t("telegramAdmin.composer.channelFailed", { name: r.name || r.channel_id, error: r.error || "?" }),
          variant: "destructive",
        });
      });
    },
    onError: (err) => showApiError(err),
  });

  const handleEdit = (c) => {
    setForm({
      name: c.name || "",
      bot_token: c.bot_token || "",
      channel_id: c.channel_id || "",
      description: c.description || "",
      notes: c.notes || "",
      is_active: c.is_active !== false,
    });
    setEditingId(c.id);
    setShowToken(false);
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.bot_token.trim() || !form.channel_id.trim()) {
      toast({ title: t("telegramAdmin.validation.fillRequired"), variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...form,
      name: form.name.trim(),
      bot_token: form.bot_token.trim(),
      channel_id: form.channel_id.trim(),
    });
  };

  const allSelected = activeChannels.length > 0 && selectedIds.length === activeChannels.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : activeChannels.map(c => c.id));
  };

  const toggleChannel = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const canSend = message.trim().length > 0 && selectedIds.length > 0 && !sendMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">📡 {t("telegramAdmin.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("telegramAdmin.subtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true); }} className="gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" />
          {t("telegramAdmin.addChannel")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={Radio} label={t("telegramAdmin.stats.total")} value={channels.length} loading={isLoading} />
        <StatCard icon={CheckCircle2} label={t("telegramAdmin.stats.active")} value={activeChannels.length} loading={isLoading} color="bg-emerald-500/10 text-emerald-600" />
        <StatCard icon={MessageSquare} label={t("telegramAdmin.stats.sentSession")} value={sessionSent} loading={false} color="bg-blue-500/10 text-blue-600" />
      </div>

      {/* Message composer */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-6">
        <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          {t("telegramAdmin.composer.title")}
        </h2>
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          placeholder={t("telegramAdmin.composer.placeholder")}
          rows={3}
          className="resize-none"
        />
        <div className="flex items-center justify-between mt-1 mb-3">
          <p className="text-[11px] text-muted-foreground" dir="ltr">
            {t("telegramAdmin.composer.charsCount", { count: message.length })}
          </p>
        </div>

        <p className="text-sm font-medium text-foreground mb-2">{t("telegramAdmin.composer.selectChannels")}</p>
        {activeChannels.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("telegramAdmin.composer.noActiveChannels")}</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={toggleSelectAll}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                allSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t("telegramAdmin.composer.all")} ({activeChannels.length})
            </button>
            {activeChannels.map(c => {
              const selected = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleChannel(c.id)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    selected ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        <Button onClick={() => sendMutation.mutate(selectedIds)} disabled={!canSend} className="gap-2">
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sendMutation.isPending ? t("telegramAdmin.composer.sending") : t("telegramAdmin.composer.send")}
        </Button>
      </div>

      {/* Channels table */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-right p-3 font-medium text-muted-foreground">{t("telegramAdmin.table.name")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("telegramAdmin.table.channelId")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("telegramAdmin.table.status")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("telegramAdmin.table.created")}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">{t("telegramAdmin.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={5} className="p-3"><Skeleton className="h-5 w-full" /></td>
                    </tr>
                  ))
                : pageItems.map(c => {
                    const active = c.is_active !== false;
                    return (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="p-3">
                          <p className="font-medium text-foreground">{c.name}</p>
                          {c.description && <p className="text-xs text-muted-foreground truncate max-w-[220px]">{c.description}</p>}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs font-mono" dir="ltr">{c.channel_id}</td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            active ? "bg-emerald-500/10 text-emerald-600" : "bg-secondary text-muted-foreground"
                          }`}>
                            {active ? t("telegramAdmin.table.active") : t("telegramAdmin.table.inactive")}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {c.created_date ? format(new Date(c.created_date), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={active}
                              onCheckedChange={() => toggleMutation.mutate(c)}
                              disabled={toggleMutation.isPending}
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(c)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!isLoading && channels.length === 0 && (
            <p className="text-center py-12 text-muted-foreground">{t("telegramAdmin.emptyState")}</p>
          )}
        </div>

        {/* Pagination */}
        {channels.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              {t("telegramAdmin.showing", {
                from: (safePage - 1) * PAGE_SIZE + 1,
                to: Math.min(safePage * PAGE_SIZE, channels.length),
                total: channels.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} className="gap-1">
                <ChevronRight className="w-4 h-4" />
                {t("telegramAdmin.prev")}
              </Button>
              <span className="text-xs text-muted-foreground" dir="ltr">{safePage} / {pageCount}</span>
              <Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(p => p + 1)} className="gap-1">
                {t("telegramAdmin.next")}
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp placeholder */}
      <div className="bg-secondary/40 rounded-2xl border border-dashed border-border p-5 opacity-70">
        <h2 className="font-bold text-foreground">{t("telegramAdmin.whatsapp.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("telegramAdmin.whatsapp.body")}</p>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("telegramAdmin.editChannel") : t("telegramAdmin.addChannel")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("telegramAdmin.fields.name")} *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder={t("telegramAdmin.fields.namePlaceholder")}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("telegramAdmin.fields.botToken")} *</Label>
              <div className="relative mt-1">
                <Input
                  type={showToken ? "text" : "password"}
                  value={form.bot_token}
                  onChange={e => setForm(p => ({ ...p, bot_token: e.target.value }))}
                  placeholder={t("telegramAdmin.fields.botTokenPlaceholder")}
                  className="pe-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>{t("telegramAdmin.fields.channelId")} *</Label>
              <Input
                value={form.channel_id}
                onChange={e => setForm(p => ({ ...p, channel_id: e.target.value }))}
                placeholder="@mychannel"
                className="mt-1"
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground mt-1">{t("telegramAdmin.fields.channelIdHint")}</p>
            </div>
            <div>
              <Label>{t("telegramAdmin.fields.description")}</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="mt-1 h-16 resize-none"
              />
            </div>
            <div>
              <Label>{t("telegramAdmin.fields.notes")}</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
              <Label>{t("telegramAdmin.fields.isActive")}</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("telegramAdmin.form.requiredHint")}</p>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !form.name.trim() || !form.bot_token.trim() || !form.channel_id.trim()}
              className="w-full"
            >
              {saveMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : t("telegramAdmin.form.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("telegramAdmin.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("telegramAdmin.deleteConfirmBody", { name: deleteTarget?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("telegramAdmin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("telegramAdmin.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

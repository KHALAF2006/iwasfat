import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Loader2, Link2, Unlink } from "lucide-react";
import { useT } from "@/i18n";
import { useToast } from "@/components/ui/use-toast";

// Telegram card for Settings: connect via one-time deep link, disconnect,
// and toggle the notify_telegram preference.
export default function TelegramCard({ subscriber }) {
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const connected = !!subscriber.telegram_chat_id;

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Subscriber.update(subscriber.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriber"] }),
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("generateTelegramLink", {});
      if (res.data?.url) {
        window.open(res.data.url, "_blank", "noopener");
      } else {
        throw new Error("no url");
      }
    } catch {
      toast({ title: t("telegram.connectError"), variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    updateMutation.mutate({
      telegram_chat_id: null,
      telegram_username: null,
      telegram_connected_at: null,
      notify_telegram: false,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" /> {t("telegram.title")} 📣
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("telegram.subtitle")}</p>

        {connected ? (
          <>
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
              <span className="text-sm text-muted-foreground">{t("telegram.connectedAs")}</span>
              <span className="text-sm font-medium text-primary" dir="ltr">
                {subscriber.telegram_username ? `@${subscriber.telegram_username}` : t("telegram.connected")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-telegram" className="text-sm">{t("telegram.notifyToggle")}</Label>
              <Switch
                id="notify-telegram"
                checked={!!subscriber.notify_telegram}
                onCheckedChange={(v) => updateMutation.mutate({ notify_telegram: v })}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={updateMutation.isPending}
              className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              {t("telegram.disconnect")}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleConnect} disabled={connecting} className="w-full gap-2">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {connecting ? t("telegram.connecting") : t("telegram.connect")}
            </Button>
            <p className="text-xs text-muted-foreground text-center">{t("telegram.connectHint")}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

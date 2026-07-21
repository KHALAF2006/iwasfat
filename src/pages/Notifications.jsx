import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import moment from "moment";
import { useT } from "@/i18n";
import { showApiError } from "@/lib/api-error";

const TYPE_ICONS = {
  meal_reminder: "🍽️",
  water_reminder: "💧",
  weight_checkin: "⚖️",
  admin_broadcast: "📢",
  motivation: "💪",
  shopping_reminder: "🛒",
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const t = useT();

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const subs = await base44.entities.Subscriber.filter({ created_by: me.email });
      return subs[0] || null;
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", subscriber?.id],
    queryFn: () => base44.entities.Notification.filter({ subscriber_id: subscriber?.id }, "-created_date"),
    enabled: !!subscriber,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotifs"] });
    } catch (err) {
      showApiError(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("notifications.title")}</h1>
          {unreadCount > 0 && <p className="text-muted-foreground text-sm">{unreadCount} {t("notifications.unread")}</p>}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-1 text-primary">
            <CheckCheck className="w-4 h-4" />
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Bell className="w-16 h-16 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">{t("notifications.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => !notif.is_read && markReadMutation.mutate(notif.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                notif.is_read ? "bg-card border-border/40" : "bg-primary/5 border-primary/20 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">{TYPE_ICONS[notif.type] || "📩"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`font-medium text-sm ${notif.is_read ? "text-foreground" : "text-foreground font-semibold"}`}>
                      {notif.title}
                    </h3>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{notif.message}</p>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {moment(notif.created_date).fromNow()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

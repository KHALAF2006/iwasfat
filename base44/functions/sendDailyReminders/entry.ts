import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// SECURITY:
// - AUTH: previously anyone could invoke this and spam notifications to all
//   subscribers. Now requires either an admin user OR the shared secret header
//   `x-cron-secret: <CRON_SECRET>` for scheduled invocation.
// - IDEMPOTENCY: if a same-type notification already exists for a subscriber
//   in the current 2-hour window, it is skipped (two calls in the same window
//   no longer produce duplicates).
// - N+1 fix: daily meal plans and existing notifications are fetched in bulk
//   (2 queries total) instead of one query per subscriber.
// - Telegram: subscribers with notify_telegram && telegram_chat_id ALSO get the
//   message via the Telegram Bot API. Telegram failures are logged and never
//   crash the run.

// checkEntitlement pattern (also used by sweepTrials / frontend EntitlementGate):
// allowed = status active
//        OR (trial   AND now < trial_ends_at,   or trial_ends_at unset = legacy trial)
//        OR (expired AND grace_ends_at set AND now < grace_ends_at)
function isEntitled(sub, now) {
  if (sub.subscription_status === 'active') return true;
  if (sub.subscription_status === 'trial') {
    if (!sub.trial_ends_at) return true; // legacy trial set client-side; sweep owns lifecycle
    return new Date(sub.trial_ends_at) > now;
  }
  if (sub.subscription_status === 'expired') {
    return sub.grace_ends_at && new Date(sub.grace_ends_at) > now;
  }
  return false;
}

async function sendTelegramMessage(chatId, text) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token || !chatId) return { ok: false, skipped: true };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const data = await res.json();
    return { ok: !!data.ok };
  } catch (e) {
    console.error('Telegram send failed for chat', chatId, e.message);
    return { ok: false, error: e.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: admin user OR cron secret header
    const cronSecret = Deno.env.get('CRON_SECRET');
    const headerSecret = req.headers.get('x-cron-secret');
    const isCron = cronSecret && headerSecret && headerSecret === cronSecret;

    if (!isCron) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: admin or cron secret required' }, { status: 403 });
      }
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();

    // Determine which reminder type applies to this window
    let reminderType = null;
    if (hour >= 8 && hour < 10) reminderType = 'meal_reminder';
    else if (hour >= 12 && hour < 14) reminderType = 'water_reminder';
    else if (hour >= 18 && hour < 20) reminderType = 'motivation';

    if (!reminderType) {
      return Response.json({ success: true, sent: 0, reason: 'outside reminder windows', hour });
    }

    // Bulk reads (N+1 fix): 3 queries total instead of 1 + N
    const [allSubs, todayPlans, existingNotifs] = await Promise.all([
      base44.asServiceRole.entities.Subscriber.filter({ subscription_status: 'active' }),
      base44.asServiceRole.entities.DailyMealPlan.filter({ date: today }),
      base44.asServiceRole.entities.Notification.filter({ type: reminderType }),
    ]);

    // Include trial subscribers within their trial window too
    const trialSubs = await base44.asServiceRole.entities.Subscriber.filter({ subscription_status: 'trial' });
    const subscribers = [...allSubs, ...trialSubs].filter(s => isEntitled(s, now));

    const planBySub = {};
    for (const p of todayPlans) {
      planBySub[p.subscriber_id] = true;
    }

    // Idempotency: same-type notification for the same subscriber within the
    // current 2-hour window => skip
    const windowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const alreadySent = new Set(
      existingNotifs
        .filter(n => n.sent_at && new Date(n.sent_at) >= windowStart)
        .map(n => n.subscriber_id)
    );

    const notifications = [];
    const telegramJobs = [];

    for (const sub of subscribers) {
      if (alreadySent.has(sub.id)) continue;

      let title, message;
      if (reminderType === 'meal_reminder') {
        title = `صباح الخير ${sub.full_name?.split(' ')[0] || ''} 🌅`;
        message = planBySub[sub.id]
          ? `خطة وجباتك لليوم جاهزة! تذكر أن تبدأ بفطورك الصحي.`
          : `لا تنس تسجيل وجباتك اليوم والالتزام بخطتك الغذائية!`;
      } else if (reminderType === 'water_reminder') {
        title = 'تذكير شرب الماء 💧';
        message = 'كيف صحتك؟ تأكد من شرب كميتك من الماء. الهدف 8 أكواب يومياً!';
      } else {
        const motivations = [
          'كل يوم هو خطوة نحو هدفك! استمر 💪',
          'أنت أقوى مما تظن. تذكر سبب بدايتك! 🌟',
          'التزامك اليومي هو سر نجاحك. أحسنت اليوم! 🎯',
          'جسمك يشكرك على كل خيار صحي تتخذه! 🥗',
        ];
        title = 'تحفيزك اليومي 🌟';
        message = motivations[Math.floor(Math.random() * motivations.length)];
      }

      notifications.push({
        subscriber_id: sub.id,
        title,
        message,
        type: reminderType,
        is_read: false,
        sent_at: now.toISOString(),
        target_all: false,
      });

      if (sub.notify_telegram && sub.telegram_chat_id) {
        telegramJobs.push({ chat_id: sub.telegram_chat_id, text: `${title}\n\n${message}` });
      }
    }

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }

    // Telegram fan-out: failures logged, never crash the run
    let telegramSent = 0;
    let telegramFailed = 0;
    for (const job of telegramJobs) {
      const res = await sendTelegramMessage(job.chat_id, job.text);
      if (res.ok) telegramSent++;
      else if (!res.skipped) telegramFailed++;
    }

    return Response.json({
      success: true,
      type: reminderType,
      sent: notifications.length,
      skipped_duplicates: subscribers.length - notifications.length,
      telegram_sent: telegramSent,
      telegram_failed: telegramFailed,
      hour,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

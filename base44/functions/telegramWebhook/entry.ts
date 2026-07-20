import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Telegram bot webhook. Receives updates from Telegram and binds/unbinds
// chat_ids to Subscriber records:
//   /start <token>  -> binds chat_id to the subscriber whose one-time
//                      telegram_connect_token matches (token is cleared after use)
//   /stop           -> disconnects the Telegram account
// Replies in Arabic.
//
// SECURITY: if TELEGRAM_WEBHOOK_SECRET is set, the
// X-Telegram-Bot-Api-Secret-Token header must match it (set this when calling
// setWebhook). Connect tokens are single-use UUIDs.
// UNTESTED — requires a real bot via @BotFather + setWebhook. See base44/ENV.md.

async function sendTelegramMessage(chatId, text) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error('Telegram reply failed:', e.message);
  }
}

Deno.serve(async (req) => {
  try {
    // Optional shared-secret header verification (recommended; set via setWebhook secret_token)
    const hookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (hookSecret) {
      const got = req.headers.get('x-telegram-bot-api-secret-token');
      if (got !== hookSecret) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const base44 = createClientFromRequest(req);
    const update = await req.json();
    const message = update.message;
    if (!message || !message.text) {
      return Response.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const username = message.from?.username || null;
    const text = message.text.trim();

    if (text.startsWith('/start')) {
      const token = text.split(/\s+/)[1];

      if (!token) {
        await sendTelegramMessage(chatId,
          'أهلاً بك في بوت I Was Fat! 👋\nلربط حسابك، افتح التطبيق ← الإعدادات ← تيليجرام واضغط "ربط الحساب" للحصول على رابط خاص بك.');
        return Response.json({ ok: true });
      }

      // Single-use connect token
      const matches = await base44.asServiceRole.entities.Subscriber.filter({ telegram_connect_token: token });
      const sub = matches[0];

      if (!sub) {
        await sendTelegramMessage(chatId,
          'عذراً، رابط الربط غير صالح أو منتهي. أنشئ رابطاً جديداً من إعدادات التطبيق.');
        return Response.json({ ok: true });
      }

      await base44.asServiceRole.entities.Subscriber.update(sub.id, {
        telegram_chat_id: chatId,
        telegram_username: username,
        telegram_connected_at: new Date().toISOString(),
        telegram_connect_token: null,
        notify_telegram: true,
      });

      await sendTelegramMessage(chatId,
        `تم ربط حسابك بنجاح يا ${sub.full_name?.split(' ')[0] || 'صديقي'}! ✅\nستصلك تذكيرات الوجبات والماء هنا. لتوقيف الإشعارات أرسل /stop`);
      return Response.json({ ok: true });
    }

    if (text.startsWith('/stop')) {
      const matches = await base44.asServiceRole.entities.Subscriber.filter({ telegram_chat_id: chatId });
      const sub = matches[0];

      if (sub) {
        await base44.asServiceRole.entities.Subscriber.update(sub.id, {
          telegram_chat_id: null,
          telegram_username: null,
          telegram_connected_at: null,
          notify_telegram: false,
        });
        await sendTelegramMessage(chatId, 'تم إلغاء ربط حسابك وإيقاف الإشعارات. يمكنك إعادة الربط في أي وقت من إعدادات التطبيق.');
      } else {
        await sendTelegramMessage(chatId, 'حسابك غير مرتبط حالياً بالتطبيق.');
      }
      return Response.json({ ok: true });
    }

    await sendTelegramMessage(chatId, 'الأوامر المتاحة:\n/start - ربط الحساب\n/stop - إيقاف الإشعارات وإلغاء الربط');
    return Response.json({ ok: true });
  } catch (error) {
    console.error('telegramWebhook error:', error.message);
    // Always 200 to Telegram so it stops retrying malformed updates
    return Response.json({ ok: true });
  }
});

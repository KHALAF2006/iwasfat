import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * sendTelegramChannelMessage — admin-only broadcast to Telegram channels.
 *
 * Invoked from the admin Telegram page (/admin/telegram). Sends one message
 * to one or more configured TelegramChannel records via the Telegram Bot API.
 *
 * Input:  { channel_ids: string[], message: string }
 * Output: { results: [{ channel_id, name, ok, error? }] }
 *
 * Notes:
 * - Entity access uses base44.asServiceRole.entities (the pattern used across
 *   this codebase) because TelegramChannel RLS is admin-only and the
 *   service-role client is the reliable way to read records inside functions.
 * - bot_token is NEVER returned in the response — only channel id/name.
 * - Telegram message limit: 4096 characters.
 */

const TELEGRAM_MAX_MESSAGE = 4096;
const PER_CHANNEL_TIMEOUT_MS = 5000;

async function sendToChannel(channel, message) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CHANNEL_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${channel.bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channel.channel_id, text: message }),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.description || `Telegram HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timeout (5s)' : (error?.message || 'network error');
    return { ok: false, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Admin-only: the admin UI calls this; regular users get 403.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admins only' }, { status: 403 });
    }

    const { channel_ids, message } = await req.json();

    if (!Array.isArray(channel_ids) || channel_ids.length === 0) {
      return Response.json({ error: 'channel_ids[] is required (at least one channel)' }, { status: 400 });
    }
    if (channel_ids.length > 100) {
      return Response.json({ error: 'too many channels (max 100 per call)' }, { status: 400 });
    }
    if (typeof message !== 'string' || message.trim().length === 0) {
      return Response.json({ error: 'message is required' }, { status: 400 });
    }
    if (message.length > TELEGRAM_MAX_MESSAGE) {
      return Response.json({ error: `message too long (max ${TELEGRAM_MAX_MESSAGE} chars)` }, { status: 400 });
    }

    const results = [];
    // Sequential sends: keeps per-channel timeout/error handling simple and
    // avoids tripping Telegram rate limits when broadcasting to many channels.
    for (const id of channel_ids) {
      const channels = await base44.asServiceRole.entities.TelegramChannel.filter({ id });
      const channel = channels[0];
      if (!channel) {
        results.push({ channel_id: id, name: null, ok: false, error: 'channel not found' });
        continue;
      }
      const outcome = await sendToChannel(channel, message.trim());
      results.push({
        channel_id: channel.channel_id,
        name: channel.name,
        ok: outcome.ok,
        ...(outcome.error ? { error: outcome.error } : {})
      });
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

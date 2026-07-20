import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Generates a one-time Telegram connect token for the caller's OWN subscriber
// record and returns the https://t.me/<bot>?start=<token> deep link.
// Requires TELEGRAM_BOT_USERNAME env var. See base44/ENV.md.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const botUsername = Deno.env.get('TELEGRAM_BOT_USERNAME');
    if (!botUsername) {
      return Response.json({ error: 'TELEGRAM_BOT_USERNAME not configured' }, { status: 500 });
    }

    const own = await base44.asServiceRole.entities.Subscriber.filter({ created_by: user.email });
    const subscriber = own[0];
    if (!subscriber) return Response.json({ error: 'No subscriber record for this user' }, { status: 404 });

    const token = crypto.randomUUID();
    await base44.asServiceRole.entities.Subscriber.update(subscriber.id, {
      telegram_connect_token: token,
    });

    return Response.json({
      url: `https://t.me/${botUsername}?start=${token}`,
      // Note: token is single-use; a new link invalidates the previous one.
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

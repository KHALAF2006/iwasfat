import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Creates a Stripe Billing Portal session so subscribers can self-service
// cancel / update payment method — the global-standard cancel flow.
// UNTESTED LOCALLY — requires STRIPE_SECRET_KEY. See base44/ENV.md.

const STRIPE_API = 'https://api.stripe.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Caller may only open a portal for their own subscriber record
    const own = await base44.asServiceRole.entities.Subscriber.filter({ created_by: user.email });
    const subscriber = own[0];
    if (!subscriber) return Response.json({ error: 'No subscriber record for this user' }, { status: 404 });
    if (!subscriber.stripe_customer_id) {
      return Response.json({ error: 'No billing account yet — subscribe to a plan first' }, { status: 400 });
    }

    const key = Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');

    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://iwasfat.base44.app';

    const res = await fetch(`${STRIPE_API}/billing_portal/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: subscriber.stripe_customer_id,
        return_url: `${appBaseUrl}/settings`,
      }).toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Stripe error ${res.status}: ${data?.error?.message || 'unknown'}`);
    }

    return Response.json({ url: data.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

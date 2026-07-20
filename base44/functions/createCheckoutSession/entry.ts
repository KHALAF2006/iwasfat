import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Creates a Stripe Checkout Session for the caller's OWN subscriber record.
// SECURITY: the plan is looked up SERVER-SIDE from the Plan entity — the
// client sends only plan_id; price/currency/trial are NEVER trusted from the
// client.
//
// Stripe is called via raw fetch (no npm stripe lib in Deno).
// UNTESTED LOCALLY — requires STRIPE_SECRET_KEY and Stripe dashboard
// verification. Required env vars documented in base44/ENV.md:
//   STRIPE_SECRET_KEY, APP_BASE_URL

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripePost(path, params) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe error ${res.status}: ${data?.error?.message || 'unknown'}`);
  }
  return data;
}

async function stripeGet(path) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { 'Authorization': `Bearer ${key}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe error ${res.status}: ${data?.error?.message || 'unknown'}`);
  }
  return data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan_id } = await req.json();
    if (!plan_id) return Response.json({ error: 'plan_id required' }, { status: 400 });

    // Caller may only check out for their own subscriber record
    const own = await base44.asServiceRole.entities.Subscriber.filter({ created_by: user.email });
    const subscriber = own[0];
    if (!subscriber) return Response.json({ error: 'No subscriber record for this user' }, { status: 404 });

    // Server-side plan lookup (NEVER trust client price)
    const plans = await base44.asServiceRole.entities.Plan.filter({ id: plan_id, is_active: true });
    const plan = plans[0];
    if (!plan) return Response.json({ error: 'Plan not found or inactive' }, { status: 404 });
    if (!plan.stripe_price_id) return Response.json({ error: 'Plan is not linked to a Stripe price' }, { status: 400 });

    // Create or retrieve the Stripe customer
    let customerId = subscriber.stripe_customer_id;
    if (!customerId) {
      // Check if a customer already exists for this email (e.g. from another app install)
      const existing = await stripeGet(`/customers?email=${encodeURIComponent(user.email)}&limit=1`);
      if (existing.data && existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripePost('/customers', {
          email: user.email,
          name: subscriber.full_name || user.email,
          'metadata[subscriber_id]': subscriber.id,
        });
        customerId = customer.id;
      }
      await base44.asServiceRole.entities.Subscriber.update(subscriber.id, {
        stripe_customer_id: customerId,
      });
    }

    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://iwasfat.base44.app';

    const params = {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': plan.stripe_price_id,
      'line_items[0][quantity]': '1',
      success_url: `${appBaseUrl}/settings?checkout=success`,
      cancel_url: `${appBaseUrl}/settings?checkout=cancelled`,
      'metadata[subscriber_id]': subscriber.id,
      'metadata[plan_id]': plan.id,
      'subscription_data[metadata][subscriber_id]': subscriber.id,
      'subscription_data[metadata][plan_id]': plan.id,
    };

    // Trial from the Plan entity (server-side), only if the subscriber never had one
    if (plan.trial_days && plan.trial_days > 0 && !subscriber.trial_ends_at && !subscriber.stripe_subscription_id) {
      params['subscription_data[trial_period_days]'] = String(plan.trial_days);
    }

    const session = await stripePost('/checkout/sessions', params);

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

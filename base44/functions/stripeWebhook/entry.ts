import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Stripe webhook receiver.
//
// SIGNATURE VERIFICATION: the Stripe-Signature header is verified manually
// with WebCrypto HMAC-SHA256 over `${timestamp}.${rawBody}` using the endpoint
// secret from env STRIPE_WEBHOOK_SECRET (whsec_...). A 5-minute timestamp
// tolerance is enforced against replay. Timing-safe comparison is used.
// UNTESTED — requires Stripe CLI/dashboard verification:
//   stripe listen --forward-to <this function URL>
//   stripe trigger checkout.session.completed
//
// HANDLED EVENTS:
//   checkout.session.completed   -> link subscription, set trial/renewal dates, Payment row
//   invoice.payment_succeeded    -> status=active, renews_at=period end, Payment row
//   invoice.payment_failed       -> grace_ends_at = now + 3 days, failed Payment row
//   customer.subscription.updated-> record cancel_at_period_end flag
//   customer.subscription.deleted-> status=cancelled
//
// IDEMPOTENCY: Payment rows are checked by stripe_session_id / stripe_invoice_id
// before writing; Stripe retries therefore do not duplicate rows or state.
// All events also write an AuditLog row (actor 'stripe-webhook').

const GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const STRIPE_API = 'https://api.stripe.com';

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  for (const item of sigHeader.split(',')) {
    const [k, v] = item.split('=');
    if (k && v) parts[k] = v;
  }
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  // Replay protection: 5 minute tolerance
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (age > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`)
  );
  const expected = new Uint8Array(signed);
  const provided = hexToBytes(v1);
  return timingSafeEqual(expected, provided);
}

async function stripeGet(path) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { 'Authorization': `Bearer ${key}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe GET ${path} failed: ${res.status}`);
  return data;
}

async function recordAudit(base44, action, targetId, meta) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      actor_email: 'stripe-webhook',
      action,
      target_type: 'Subscriber',
      target_id: targetId || null,
      meta: meta || {},
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('AuditLog write failed:', e.message);
  }
}

async function findSubscriberByStripe(base44, { subscriberId, customerId, subscriptionId }) {
  if (subscriberId) {
    const rows = await base44.asServiceRole.entities.Subscriber.filter({ id: subscriberId });
    if (rows[0]) return rows[0];
  }
  if (subscriptionId) {
    const rows = await base44.asServiceRole.entities.Subscriber.filter({ stripe_subscription_id: subscriptionId });
    if (rows[0]) return rows[0];
  }
  if (customerId) {
    const rows = await base44.asServiceRole.entities.Subscriber.filter({ stripe_customer_id: customerId });
    if (rows[0]) return rows[0];
  }
  return null;
}

async function paymentExists(base44, field, value) {
  if (!value) return false;
  const rows = await base44.asServiceRole.entities.Payment.filter({ [field]: value });
  return rows.length > 0;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Raw body is required for signature verification
  const rawBody = await req.text();
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const sigHeader = req.headers.get('stripe-signature');

  const valid = await verifyStripeSignature(rawBody, sigHeader, secret).catch(() => false);
  if (!valid) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const obj = event.data?.object || {};

    switch (event.type) {
      case 'checkout.session.completed': {
        // Idempotency: skip if we already recorded this session
        if (await paymentExists(base44, 'stripe_session_id', obj.id)) break;

        const subscriber = await findSubscriberByStripe(base44, {
          subscriberId: obj.metadata?.subscriber_id,
          customerId: obj.customer,
          subscriptionId: obj.subscription,
        });
        if (!subscriber) break;

        // Retrieve the subscription for period/trial dates
        const sub = obj.subscription ? await stripeGet(`/v1/subscriptions/${obj.subscription}`) : null;
        const update = {
          stripe_customer_id: obj.customer || subscriber.stripe_customer_id,
          stripe_subscription_id: obj.subscription || subscriber.stripe_subscription_id,
          plan_id: obj.metadata?.plan_id || subscriber.plan_id,
        };
        if (sub) {
          update.cancel_at_period_end = !!sub.cancel_at_period_end;
          if (sub.trial_end) {
            update.subscription_status = 'trial';
            update.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
          } else if (sub.status === 'active') {
            update.subscription_status = 'active';
          }
          if (sub.current_period_end) {
            update.subscription_renews_at = new Date(sub.current_period_end * 1000).toISOString();
          }
        }
        await base44.asServiceRole.entities.Subscriber.update(subscriber.id, update);

        await base44.asServiceRole.entities.Payment.create({
          subscriber_id: subscriber.id,
          stripe_session_id: obj.id,
          amount: (obj.amount_total || 0) / 100,
          currency: (obj.currency || 'sar').toUpperCase(),
          status: 'paid',
          created_at: new Date().toISOString(),
        });
        await recordAudit(base44, 'stripe.checkout_completed', subscriber.id, { session: obj.id });
        break;
      }

      case 'invoice.payment_succeeded': {
        if (await paymentExists(base44, 'stripe_invoice_id', obj.id)) break;

        const subscriber = await findSubscriberByStripe(base44, {
          customerId: obj.customer,
          subscriptionId: obj.subscription,
        });
        if (!subscriber) break;

        const period = obj.lines?.data?.[0]?.period || {};
        const update = {
          subscription_status: 'active',
          grace_ends_at: null,
          cancel_at_period_end: false,
        };
        if (period.end) update.subscription_renews_at = new Date(period.end * 1000).toISOString();

        await base44.asServiceRole.entities.Subscriber.update(subscriber.id, update);
        await base44.asServiceRole.entities.Payment.create({
          subscriber_id: subscriber.id,
          stripe_invoice_id: obj.id,
          amount: (obj.amount_paid || 0) / 100,
          currency: (obj.currency || 'sar').toUpperCase(),
          status: 'paid',
          period_start: period.start ? new Date(period.start * 1000).toISOString() : null,
          period_end: period.end ? new Date(period.end * 1000).toISOString() : null,
          created_at: new Date().toISOString(),
        });
        await recordAudit(base44, 'stripe.invoice_paid', subscriber.id, { invoice: obj.id });
        break;
      }

      case 'invoice.payment_failed': {
        if (await paymentExists(base44, 'stripe_invoice_id', obj.id)) break;

        const subscriber = await findSubscriberByStripe(base44, {
          customerId: obj.customer,
          subscriptionId: obj.subscription,
        });
        if (!subscriber) break;

        // Grace period: 3 days to fix payment before lockout
        await base44.asServiceRole.entities.Subscriber.update(subscriber.id, {
          subscription_status: 'expired',
          grace_ends_at: new Date(Date.now() + GRACE_MS).toISOString(),
        });
        await base44.asServiceRole.entities.Payment.create({
          subscriber_id: subscriber.id,
          stripe_invoice_id: obj.id,
          amount: (obj.amount_due || 0) / 100,
          currency: (obj.currency || 'sar').toUpperCase(),
          status: 'failed',
          created_at: new Date().toISOString(),
        });
        await recordAudit(base44, 'stripe.invoice_failed', subscriber.id, { invoice: obj.id });
        break;
      }

      case 'customer.subscription.updated': {
        const subscriber = await findSubscriberByStripe(base44, {
          customerId: obj.customer,
          subscriptionId: obj.id,
        });
        if (!subscriber) break;
        await base44.asServiceRole.entities.Subscriber.update(subscriber.id, {
          cancel_at_period_end: !!obj.cancel_at_period_end,
          ...(obj.current_period_end
            ? { subscription_renews_at: new Date(obj.current_period_end * 1000).toISOString() }
            : {}),
        });
        await recordAudit(base44, 'stripe.subscription_updated', subscriber.id, {
          cancel_at_period_end: !!obj.cancel_at_period_end,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscriber = await findSubscriberByStripe(base44, {
          customerId: obj.customer,
          subscriptionId: obj.id,
        });
        if (!subscriber) break;
        await base44.asServiceRole.entities.Subscriber.update(subscriber.id, {
          subscription_status: 'cancelled',
          cancel_at_period_end: false,
          grace_ends_at: null,
        });
        await recordAudit(base44, 'stripe.subscription_deleted', subscriber.id, { subscription: obj.id });
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

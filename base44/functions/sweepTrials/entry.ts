import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Sweeps trial subscribers whose trial_ends_at has passed: marks them expired
// and sets grace_ends_at (+3 days). Auth: admin user OR x-cron-secret header.
// DEDUP-SAFE: only rows still in 'trial' status are touched, so re-runs are
// no-ops for already-swept subscribers.
//
// NOTE: Register.jsx still writes subscription_status='trial' client-side with
// no trial_ends_at; this sweep (and the Stripe webhooks) own the lifecycle from
// now on. Rows with no trial_ends_at are treated as legacy trials and get a
// trial_ends_at of created_date + 14 days on first sweep, then normal handling.

const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const LEGACY_TRIAL_MS = 14 * 24 * 60 * 60 * 1000;

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
    const trials = await base44.asServiceRole.entities.Subscriber.filter({ subscription_status: 'trial' });

    let swept = 0;
    let legacyStamped = 0;

    for (const sub of trials) {
      // Skip trials managed by Stripe (webhook owns those)
      if (sub.stripe_subscription_id) continue;

      let trialEnds = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;

      if (!trialEnds) {
        // Legacy client-side trial: stamp an end date once, then handle normally next run
        const created = sub.created_date ? new Date(sub.created_date) : now;
        trialEnds = new Date(created.getTime() + LEGACY_TRIAL_MS);
        await base44.asServiceRole.entities.Subscriber.update(sub.id, {
          trial_ends_at: trialEnds.toISOString(),
        });
        legacyStamped++;
        if (trialEnds > now) continue;
      }

      if (trialEnds <= now) {
        await base44.asServiceRole.entities.Subscriber.update(sub.id, {
          subscription_status: 'expired',
          grace_ends_at: new Date(now.getTime() + GRACE_MS).toISOString(),
        });
        swept++;
        try {
          await base44.asServiceRole.entities.AuditLog.create({
            actor_email: 'sweepTrials',
            action: 'subscription.trial_expired',
            target_type: 'Subscriber',
            target_id: sub.id,
            meta: { trial_ends_at: trialEnds.toISOString() },
            created_at: now.toISOString(),
          });
        } catch (e) {
          console.error('AuditLog write failed:', e.message);
        }
      }
    }

    return Response.json({ success: true, swept, legacy_stamped: legacyStamped, checked: trials.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

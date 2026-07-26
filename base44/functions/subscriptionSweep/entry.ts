import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// subscriptionSweep — daily 06:17 UTC (≈ 09:17 Riyadh) subscription lifecycle
// engine. SUPERSEDES base44/functions/sweepTrials (the old trial-only sweep);
// sweepTrials is kept in place but its schedule should be disabled — this
// function now owns trial expiry, grace, and paid renewal reminders.
//
// AUTH: admin user OR x-cron-secret header (same pattern as sendDailyReminders).
//
// Per subscriber:
//   trial : end = trial_ends_at || subscription_end_date
//           !end            -> stamp created_date + 7d, continue
//           now >= end      -> expired + grace_ends_at (+3d) + notify (trial-expired)
//           end-1d <= now   -> "ينتهي تجريبك غداً" reminder once (stage trial-1d)
//   active: end = subscription_end_date
//           !end            -> skip (legacy unlimited)
//           now >= end      -> expired + grace + notify (paid-expired)
//           end-3d <= now   -> 3-day reminder once (stage paid-3d)
//           end-7d <= now   -> 7-day reminder once (stage paid-7d)
//
// last_reminder_stage is the idempotency key: each stage fires at most once.
// A daily admin digest (Arabic table) is emailed to all admin users when any
// reminders/expiries occurred. Per-subscriber errors are caught so one bad row
// never aborts the run.

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = 3 * DAY_MS;
const TRIAL_MS = 7 * DAY_MS;

function dateOnly(d) {
  return d.toISOString().split('T')[0];
}

// ---- Email templates: Arabic primary, English secondary, وصفتي / I Was Fat ----
function emailTemplate({ heading, arBody, enBody, endDate }) {
  return `
<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
  <h2 style="color: #16a34a;">${heading}</h2>
  <p style="line-height: 1.8;">${arBody}</p>
  <p style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px;">
    📅 تاريخ الانتهاء: <strong>${endDate}</strong>
  </p>
  <p style="line-height: 1.8;">للتجديد، تواصل مع الإدارة أو افتح قسم الأسعار في التطبيق.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
  <p dir="ltr" style="color: #6b7280; font-size: 13px; line-height: 1.6;">${enBody} To renew, contact the admin or open the pricing section in the app.</p>
  <p style="color: #9ca3af; font-size: 12px;">فريق وصفتي — I Was Fat Team</p>
</div>`.trim();
}

function templates(kind, endDate) {
  switch (kind) {
    case 'trial-1d':
      return {
        title: 'ينتهي اشتراكك التجريبي غداً ⏳',
        message: `تبقى يوم واحد على انتهاء فترتك التجريبية (${endDate}). جدد اشتراكك لتستمر رحلتك معنا!`,
        subject: 'ينتهي اشتراكك التجريبي غداً - وصفتي',
        html: emailTemplate({
          heading: 'فترتك التجريبية تنتهي غداً ⏳',
          arBody: 'استمتعنا بوجودك معنا! تبقى يوم واحد فقط على انتهاء الفترة التجريبية. جدد اشتراكك الآن لتحافظ على خطتك الغذائية ومجموعتك وتقدمك.',
          enBody: 'Your trial ends tomorrow. Renew now to keep your meal plan, group, and progress.',
          endDate,
        }),
      };
    case 'trial-expired':
      return {
        title: 'انتهت الفترة التجريبية',
        message: `انتهت فترتك التجريبية (${endDate}). لديك 3 أيام سماح للتجديد قبل إيقاف الحساب.`,
        subject: 'انتهت فترتك التجريبية - وصفتي',
        html: emailTemplate({
          heading: 'انتهت فترتك التجريبية',
          arBody: 'شكراً لتجربتك وصفتي! انتهت الفترة التجريبية، ولديك 3 أيام فترة سماح للتجديد قبل إيقاف الوصول. نتمنى أن نكمل معك رحلتك الصحية.',
          enBody: 'Your trial has ended. You have a 3-day grace period to renew before access is paused.',
          endDate,
        }),
      };
    case 'paid-7d':
      return {
        title: 'اشتراكك ينتهي خلال أسبوع 📅',
        message: `ينتهي اشتراكك في ${endDate} (بعد 7 أيام). جدد مبكراً لتجنب أي انقطاع.`,
        subject: 'اشتراكك ينتهي خلال أسبوع - وصفتي',
        html: emailTemplate({
          heading: 'اشتراكك ينتهي خلال أسبوع 📅',
          arBody: 'تذكير ودي: اشتراكك في وصفتي ينتهي بعد 7 أيام. جدد مبكراً لضمان استمرار خطتك الغذائية دون انقطاع.',
          enBody: 'Friendly reminder: your subscription ends in 7 days. Renew early to avoid any interruption.',
          endDate,
        }),
      };
    case 'paid-3d':
      return {
        title: 'اشتراكك ينتهي خلال 3 أيام ⚠️',
        message: `ينتهي اشتراكك في ${endDate} (بعد 3 أيام). جدد الآن لتجنب انقطاع الخدمة.`,
        subject: 'اشتراكك ينتهي خلال 3 أيام - وصفتي',
        html: emailTemplate({
          heading: 'اشتراكك ينتهي خلال 3 أيام ⚠️',
          arBody: 'اقترب موعد انتهاء اشتراكك! تبقى 3 أيام فقط. جدد الآن لتستمر في الاستفادة من خطتك ومجموعتك.',
          enBody: 'Your subscription ends in 3 days. Renew now to keep your plan and group access.',
          endDate,
        }),
      };
    case 'paid-expired':
      return {
        title: 'انتهى اشتراكك',
        message: `انتهى اشتراكك (${endDate}). لديك 3 أيام سماح للتجديد قبل إيقاف الحساب.`,
        subject: 'انتهى اشتراكك - وصفتي',
        html: emailTemplate({
          heading: 'انتهى اشتراكك',
          arBody: 'انتهى اشتراكك في وصفتي. لديك 3 أيام فترة سماح للتجديد قبل إيقاف الوصول. نتطلع لعودتك!',
          enBody: 'Your subscription has expired. You have a 3-day grace period to renew before access is paused.',
          endDate,
        }),
      };
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

    const db = base44.asServiceRole.entities;
    const now = new Date();

    const [trials, actives] = await Promise.all([
      db.Subscriber.filter({ subscription_status: 'trial' }),
      db.Subscriber.filter({ subscription_status: 'active' }),
    ]);

    const reminded = []; // {name, email, phone, status, end, action}
    const expired = [];
    const errors = [];

    // Notify: in-app Notification + email. Failures logged, never fatal.
    async function notify(sub, kind, endDate) {
      const t = templates(kind, endDate);
      try {
        await db.Notification.create({
          subscriber_id: sub.id,
          title: t.title,
          message: t.message,
          type: 'admin_broadcast',
          is_read: false,
          sent_at: now.toISOString(),
          target_all: false,
        });
      } catch (e) {
        console.error(`Notification create failed for ${sub.id}:`, e.message);
      }
      if (sub.email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: sub.email,
            subject: t.subject,
            body: t.html,
            from_name: 'وصفتي - I Was Fat',
          });
        } catch (e) {
          console.error(`SendEmail failed for ${sub.email}:`, e.message);
        }
      }
    }

    async function handle(sub) {
      const status = sub.subscription_status;

      if (status === 'trial') {
        let end = sub.trial_ends_at || sub.subscription_end_date;
        if (!end) {
          // Legacy trial with no stamped end: stamp created_date + 7d once
          const created = sub.created_date ? new Date(sub.created_date) : now;
          const stamped = new Date(created.getTime() + TRIAL_MS);
          await db.Subscriber.update(sub.id, { trial_ends_at: dateOnly(stamped) });
          if (stamped > now) return;
          end = dateOnly(stamped);
        }
        const endDate = new Date(end);
        if (now >= endDate) {
          await db.Subscriber.update(sub.id, {
            subscription_status: 'expired',
            grace_ends_at: dateOnly(new Date(now.getTime() + GRACE_MS)),
            last_reminder_stage: 'expired',
          });
          await notify(sub, 'trial-expired', dateOnly(endDate));
          expired.push({ sub, status: 'trial', end: dateOnly(endDate) });
        } else if (now >= new Date(endDate.getTime() - DAY_MS) && sub.last_reminder_stage !== 'trial-1d') {
          await db.Subscriber.update(sub.id, { last_reminder_stage: 'trial-1d' });
          await notify(sub, 'trial-1d', dateOnly(endDate));
          reminded.push({ sub, status: 'trial', end: dateOnly(endDate), action: 'trial-1d' });
        }
        return;
      }

      if (status === 'active') {
        if (!sub.subscription_end_date) return; // legacy unlimited
        const endDate = new Date(sub.subscription_end_date);
        if (now >= endDate) {
          await db.Subscriber.update(sub.id, {
            subscription_status: 'expired',
            grace_ends_at: dateOnly(new Date(now.getTime() + GRACE_MS)),
            last_reminder_stage: 'expired',
          });
          await notify(sub, 'paid-expired', dateOnly(endDate));
          expired.push({ sub, status: 'active', end: dateOnly(endDate) });
        } else if (now >= new Date(endDate.getTime() - 3 * DAY_MS) && sub.last_reminder_stage !== 'paid-3d') {
          await db.Subscriber.update(sub.id, { last_reminder_stage: 'paid-3d' });
          await notify(sub, 'paid-3d', dateOnly(endDate));
          reminded.push({ sub, status: 'active', end: dateOnly(endDate), action: 'paid-3d' });
        } else if (
          now >= new Date(endDate.getTime() - 7 * DAY_MS) &&
          now < new Date(endDate.getTime() - 3 * DAY_MS) &&
          sub.last_reminder_stage !== 'paid-7d'
        ) {
          await db.Subscriber.update(sub.id, { last_reminder_stage: 'paid-7d' });
          await notify(sub, 'paid-7d', dateOnly(endDate));
          reminded.push({ sub, status: 'active', end: dateOnly(endDate), action: 'paid-7d' });
        }
      }
    }

    for (const sub of [...trials, ...actives]) {
      try {
        await handle(sub);
      } catch (e) {
        console.error(`subscriptionSweep: error on subscriber ${sub.id}:`, e.message);
        errors.push({ subscriber_id: sub.id, error: e.message });
      }
    }

    // ---- Admin digest ----
    const touched = [
      ...reminded.map((r) => ({ ...r, action: r.action })),
      ...expired.map((x) => ({ ...x, action: 'expired' })),
    ];
    let digestSent = 0;
    if (touched.length > 0) {
      const rows = touched
        .map(
          (t) => `<tr>
            <td style="padding:6px 10px;border:1px solid #e5e7eb;">${t.sub.full_name ?? ''}</td>
            <td style="padding:6px 10px;border:1px solid #e5e7eb;" dir="ltr">${t.sub.email ?? ''}</td>
            <td style="padding:6px 10px;border:1px solid #e5e7eb;" dir="ltr">${t.sub.phone ?? '—'}</td>
            <td style="padding:6px 10px;border:1px solid #e5e7eb;">${t.status === 'trial' ? 'تجريبي' : 'مدفوع'}</td>
            <td style="padding:6px 10px;border:1px solid #e5e7eb;">${t.action === 'expired' ? 'انتهى' : 'تذكير ' + t.action}</td>
            <td style="padding:6px 10px;border:1px solid #e5e7eb;">${t.end}</td>
          </tr>`
        )
        .join('');
      const digestHtml = `
<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; color:#1f2937;">
  <h2 style="color:#16a34a;">ملخص الاشتراكات اليومي — وصفتي</h2>
  <p>تم ${expired.length} إنهاء و ${reminded.length} تذكير في دورة اليوم (${dateOnly(now)}).</p>
  <table style="border-collapse:collapse; font-size:13px;">
    <thead><tr style="background:#f0fdf4;">
      <th style="padding:6px 10px;border:1px solid #e5e7eb;">الاسم</th>
      <th style="padding:6px 10px;border:1px solid #e5e7eb;">البريد</th>
      <th style="padding:6px 10px;border:1px solid #e5e7eb;">الجوال</th>
      <th style="padding:6px 10px;border:1px solid #e5e7eb;">النوع</th>
      <th style="padding:6px 10px;border:1px solid #e5e7eb;">الإجراء</th>
      <th style="padding:6px 10px;border:1px solid #e5e7eb;">تاريخ الانتهاء</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p dir="ltr" style="color:#6b7280;font-size:12px;">Daily subscription digest — I Was Fat</p>
</div>`.trim();

      const admins = await db.User.filter({ role: 'admin' }).catch((e) => {
        console.error('Admin lookup failed:', e.message);
        return [];
      });
      for (const admin of admins) {
        if (!admin.email) continue;
        try {
          await base44.integrations.Core.SendEmail({
            to: admin.email,
            subject: `ملخص الاشتراكات اليومي (${expired.length} منتهي، ${reminded.length} تذكير) - وصفتي`,
            body: digestHtml,
            from_name: 'وصفتي - I Was Fat',
          });
          digestSent++;
        } catch (e) {
          console.error(`Digest email failed for ${admin.email}:`, e.message);
        }
      }
    }

    const summary = {
      success: true,
      checked: trials.length + actives.length,
      reminded: reminded.length,
      expired: expired.length,
      digest_sent: digestSent,
      errors: errors.length,
      error_details: errors,
    };
    console.log('subscriptionSweep summary:', JSON.stringify(summary));
    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

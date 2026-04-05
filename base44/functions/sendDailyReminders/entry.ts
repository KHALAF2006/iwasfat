import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get all active subscribers
  const subscribers = await base44.asServiceRole.entities.Subscriber.filter({ subscription_status: 'active' });

  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();

  let notifications = [];

  for (const sub of subscribers) {
    // Check if already has meal plan today
    const plans = await base44.asServiceRole.entities.DailyMealPlan.filter({
      subscriber_id: sub.id,
      date: today
    });

    // Morning reminder (8-10am) - meal reminder
    if (hour >= 8 && hour < 10) {
      notifications.push({
        subscriber_id: sub.id,
        title: `صباح الخير ${sub.full_name?.split(' ')[0] || ''} 🌅`,
        message: plans.length > 0
          ? `خطة وجباتك لليوم جاهزة! تذكر أن تبدأ بفطورك الصحي.`
          : `لا تنس تسجيل وجباتك اليوم والالتزام بخطتك الغذائية!`,
        type: 'meal_reminder',
        is_read: false,
        sent_at: new Date().toISOString(),
        target_all: false,
      });
    }

    // Midday water reminder (12-2pm)
    if (hour >= 12 && hour < 14) {
      notifications.push({
        subscriber_id: sub.id,
        title: 'تذكير شرب الماء 💧',
        message: 'كيف صحتك؟ تأكد من شرب كميتك من الماء. الهدف 8 أكواب يومياً!',
        type: 'water_reminder',
        is_read: false,
        sent_at: new Date().toISOString(),
        target_all: false,
      });
    }

    // Evening motivation (6-8pm)
    if (hour >= 18 && hour < 20) {
      const motivations = [
        'كل يوم هو خطوة نحو هدفك! استمر 💪',
        'أنت أقوى مما تظن. تذكر سبب بدايتك! 🌟',
        'التزامك اليومي هو سر نجاحك. أحسنت اليوم! 🎯',
        'جسمك يشكرك على كل خيار صحي تتخذه! 🥗',
      ];
      notifications.push({
        subscriber_id: sub.id,
        title: 'تحفيزك اليومي 🌟',
        message: motivations[Math.floor(Math.random() * motivations.length)],
        type: 'motivation',
        is_read: false,
        sent_at: new Date().toISOString(),
        target_all: false,
      });
    }
  }

  // Bulk create notifications
  if (notifications.length > 0) {
    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
  }

  return Response.json({
    success: true,
    sent: notifications.length,
    subscribers: subscribers.length,
    hour,
  });
});
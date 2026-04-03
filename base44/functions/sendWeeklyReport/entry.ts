import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all active subscribers
    const subscribers = await base44.entities.Subscriber.filter({
      subscription_status: 'active'
    });

    const reports = [];

    for (const subscriber of subscribers) {
      // Get this week's weight logs
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const weightLogs = await base44.entities.WeightLog.filter({
        subscriber_id: subscriber.id
      });

      const thisWeekLogs = weightLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= weekAgo && logDate <= today;
      });

      if (thisWeekLogs.length === 0) continue;

      // Calculate progress
      const startWeight = thisWeekLogs[thisWeekLogs.length - 1]?.weight || subscriber.current_weight;
      const endWeight = thisWeekLogs[0]?.weight || subscriber.current_weight;
      const weightLost = startWeight - endWeight;
      const avgEnergy = Math.round(thisWeekLogs.reduce((sum, log) => sum + (log.energy_level || 0), 0) / thisWeekLogs.length);

      // Get food logs compliance
      const foodLogs = await base44.entities.FoodLog.filter({
        subscriber_id: subscriber.id
      });

      const thisWeekFoodLogs = foodLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= weekAgo && logDate <= today;
      });

      const complianceRate = thisWeekFoodLogs.length > 0
        ? Math.round((thisWeekFoodLogs.filter(log => log.followed_plan).length / thisWeekFoodLogs.length) * 100)
        : 0;

      // Send email
      const emailBody = `
مرحباً ${subscriber.full_name}،

تقرير تقدمك الأسبوعي:

📊 البيانات:
• الوزن المفقود: ${Math.abs(weightLost).toFixed(1)} كغ
• متوسط مستوى الطاقة: ${avgEnergy}/5
• معدل الالتزام بالخطة: ${complianceRate}%
• الوزن الحالي: ${endWeight} كغ
• الوزن المستهدف: ${subscriber.target_weight} كغ

${weightLost > 0 ? '🎉 ممتاز! استمر بهذا المستوى الرائع!' : 'دعنا نحسن معاً الأسبوع القادم!'}

مع تحياتنا،
فريق I Was Fat
      `;

      await base44.integrations.Core.SendEmail({
        to: subscriber.email,
        subject: `تقرير تقدمك الأسبوعي - I Was Fat`,
        body: emailBody,
        from_name: 'I Was Fat'
      });

      reports.push({
        subscriber_id: subscriber.id,
        weight_lost: weightLost,
        compliance_rate: complianceRate,
        email_sent: true
      });
    }

    return Response.json({
      success: true,
      reports_sent: reports.length,
      details: reports
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
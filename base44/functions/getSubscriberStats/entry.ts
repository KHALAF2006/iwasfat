import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { subscriber_id } = await req.json();

        if (!subscriber_id) {
            return Response.json({ error: 'subscriber_id is required' }, { status: 400 });
        }

        // SECURITY (IDOR fix): callers may only read their OWN stats.
        // The caller's Subscriber is resolved via created_by == auth email; admins bypass.
        if (user.role !== 'admin') {
            const own = await base44.asServiceRole.entities.Subscriber.filter({ created_by: user.email });
            const mySubscriber = own[0];
            if (!mySubscriber || mySubscriber.id !== subscriber_id) {
                return Response.json({ error: 'Forbidden: not your subscriber record' }, { status: 403 });
            }
        }

        // Fetch subscriber, food logs, and daily meal plans in parallel
        const [subscribers, foodLogs, dailyMealPlans] = await Promise.all([
            base44.entities.Subscriber.filter({ id: subscriber_id }),
            base44.entities.FoodLog.filter({ subscriber_id }),
            base44.entities.DailyMealPlan.filter({ subscriber_id })
        ]);

        const subscriber = subscribers[0];

        // total_meals_logged: count completed meals in DailyMealPlan
        let total_meals_logged = 0;
        for (const plan of dailyMealPlans) {
            if (plan.breakfast_completed) total_meals_logged++;
            if (plan.lunch_completed) total_meals_logged++;
            if (plan.dinner_completed) total_meals_logged++;
        }

        // compliance_rate: percentage of food logs where followed_plan is true
        const logsWithCompliance = foodLogs.filter(l => l.followed_plan !== undefined && l.followed_plan !== null);
        const followed = logsWithCompliance.filter(l => l.followed_plan === true).length;
        const compliance_rate = logsWithCompliance.length > 0
            ? Math.round((followed / logsWithCompliance.length) * 100)
            : 0;

        // Group logs by date for daily averages
        const byDate = {};
        for (const log of foodLogs) {
            if (!byDate[log.date]) {
                byDate[log.date] = { calories: 0, water_cups: 0, protein: 0, carbs: 0, fat: 0 };
            }
            byDate[log.date].calories += log.calories || 0;
            byDate[log.date].water_cups += log.water_cups || 0;
            byDate[log.date].protein += log.protein || 0;
            byDate[log.date].carbs += log.carbs || 0;
            byDate[log.date].fat += log.fat || 0;
        }

        const days = Object.values(byDate);
        const numDays = days.length || 1;

        const avg_daily_calories = Math.round(days.reduce((s, d) => s + d.calories, 0) / numDays);
        const avg_water_cups = Math.round((days.reduce((s, d) => s + d.water_cups, 0) / numDays) * 10) / 10;
        const avg_protein = Math.round(days.reduce((s, d) => s + d.protein, 0) / numDays);
        const avg_carbs = Math.round(days.reduce((s, d) => s + d.carbs, 0) / numDays);
        const avg_fat = Math.round(days.reduce((s, d) => s + d.fat, 0) / numDays);

        // days_remaining from subscription_end_date
        let days_remaining = null;
        if (subscriber && subscriber.subscription_end_date) {
            const endDate = new Date(subscriber.subscription_end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            days_remaining = diff > 0 ? diff : 0;
        }

        return Response.json({
            total_meals_logged,
            compliance_rate,
            avg_daily_calories,
            avg_water_cups,
            avg_protein,
            avg_carbs,
            avg_fat,
            days_remaining
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});
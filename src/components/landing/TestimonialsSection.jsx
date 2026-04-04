import { motion } from "framer-motion";
import { Star, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function TestimonialsSection() {
  const { data: testimonials = [] } = useQuery({
    queryKey: ["testimonials"],
    queryFn: () => base44.entities.Testimonial.filter({ is_published: true }),
  });

  const displayed = testimonials.filter(t => t.is_featured).slice(0, 3);
  const list = displayed.length >= 3 ? displayed : testimonials.slice(0, 3);

  // Stats summary
  const totalLost = testimonials.reduce((s, t) => s + (t.weight_lost || 0), 0);
  const avgWeeks = testimonials.length
    ? Math.round(testimonials.reduce((s, t) => s + (t.duration_weeks || 0), 0) / testimonials.length)
    : 0;

  return (
    <section className="py-24 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            قصص نجاح حقيقية
          </h2>
          <p className="text-muted-foreground text-lg">
            مشتركون حققوا أهدافهم معنا
          </p>
        </motion.div>

        {/* Stats Bar */}
        {testimonials.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-8 mb-16"
          >
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">{testimonials.length}+</p>
              <p className="text-sm text-muted-foreground">قصة نجاح</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">{totalLost}+</p>
              <p className="text-sm text-muted-foreground">كغ فُقدت</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">{avgWeeks}</p>
              <p className="text-sm text-muted-foreground">أسبوع متوسط البرنامج</p>
            </div>
          </motion.div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          {list.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="bg-card rounded-2xl border border-border/50 p-8 hover:shadow-lg transition-shadow flex flex-col"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating || 5 }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <p className="text-foreground leading-relaxed mb-6 flex-1">"{t.quote}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.kitchen_preference || "مشترك"}
                    {t.duration_weeks ? ` · ${t.duration_weeks} أسبوع` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-accent/10 rounded-xl px-3 py-2">
                  <TrendingDown className="w-4 h-4 text-accent" />
                  <div className="text-left">
                    <p className="text-xl font-bold text-accent leading-none">-{t.weight_lost}</p>
                    <p className="text-[10px] text-muted-foreground">كغ</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
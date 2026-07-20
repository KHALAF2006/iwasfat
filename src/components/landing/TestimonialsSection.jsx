import { Star, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useT } from "@/i18n";

export default function TestimonialsSection() {
  const t = useT();

  const { data: testimonials = [] } = useQuery({
    queryKey: ["testimonials"],
    queryFn: () => base44.entities.Testimonial.filter({ is_published: true }),
  });

  const displayed = testimonials.filter(t => t.is_featured).slice(0, 3);
  const list = displayed.length >= 3 ? displayed : testimonials.slice(0, 3);

  const totalLost = testimonials.reduce((s, t) => s + (t.weight_lost || 0), 0);
  const avgWeeks = testimonials.length
    ? Math.round(testimonials.reduce((s, t) => s + (t.duration_weeks || 0), 0) / testimonials.length)
    : 0;

  if (list.length === 0) return null;

  return (
    <section className="py-24 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t("landing.testimonials.title")}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("landing.testimonials.subtitle")}
          </p>
        </div>

        {testimonials.length > 0 && (
          <div className="flex flex-wrap justify-center gap-8 mb-16">
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">{testimonials.length}+</p>
              <p className="text-sm text-muted-foreground">{t("landing.testimonials.successStories")}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">{totalLost}+</p>
              <p className="text-sm text-muted-foreground">{t("landing.testimonials.kgLost")}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">{avgWeeks}</p>
              <p className="text-sm text-muted-foreground">{t("landing.testimonials.avgWeeks")}</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          {list.map((item, i) => (
            <div
              key={item.id || i}
              className="bg-card rounded-2xl border border-border/50 p-8 hover:shadow-lg transition-shadow flex flex-col"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: item.rating || 5 }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <p className="text-foreground leading-relaxed mb-6 flex-1">"{item.quote}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.kitchen_preference || t("landing.testimonials.subscriber")}
                    {item.duration_weeks ? ` · ${item.duration_weeks} ${t("common.week")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-accent/10 rounded-xl px-3 py-2">
                  <TrendingDown className="w-4 h-4 text-accent" />
                  <div className="text-left">
                    <p className="text-xl font-bold text-accent leading-none">-{item.weight_lost}</p>
                    <p className="text-[10px] text-muted-foreground">{t("common.kg")}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

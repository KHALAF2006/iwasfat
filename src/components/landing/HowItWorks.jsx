import { UserPlus, Utensils, TrendingDown } from "lucide-react";
import { useT } from "@/i18n";

const STEP_ICONS = [UserPlus, Utensils, TrendingDown];

export default function HowItWorks() {
  const t = useT();
  const steps = t("landing.howItWorks.steps") || [];

  return (
    <section id="how-it-works" className="py-24 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t("landing.howItWorks.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            {t("landing.howItWorks.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => {
            const Icon = STEP_ICONS[i] || UserPlus;
            return (
              <div key={i} className="relative">
                <div className="bg-card rounded-2xl p-8 border border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-lg group">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <span className="text-6xl font-bold text-primary/5 absolute top-4 left-4" dir="ltr">
                    {i + 1}
                  </span>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

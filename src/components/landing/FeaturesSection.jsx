import { Utensils, Video, Users, Camera, Calculator, Headphones } from "lucide-react";
import { useT } from "@/i18n";

const FEATURE_ICONS = [Utensils, Video, Users, Camera, Calculator, Headphones];

export default function FeaturesSection({ motivationImage }) {
  const t = useT();
  const features = t("landing.features.items") || [];

  return (
    <section id="features" className="py-24 px-6 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                {t("landing.features.title")}
              </h2>
              <p className="text-muted-foreground text-lg">
                {t("landing.features.subtitle")}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {features.map((f, i) => {
                const Icon = FEATURE_ICONS[i] || Utensils;
                return (
                  <div key={i} className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{f.title}</h4>
                      <p className="text-sm text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hidden lg:block">
            <img
              src={motivationImage}
              alt={t("landing.features.imageAlt")}
              className="rounded-2xl shadow-2xl w-full object-cover aspect-square"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

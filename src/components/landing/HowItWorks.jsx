import { motion } from "framer-motion";
import { UserPlus, Utensils, TrendingDown } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "سجّل بياناتك",
    description: "أدخل طولك ووزنك وأهدافك — وسنحسب لك كل شيء تلقائياً",
  },
  {
    icon: Utensils,
    title: "احصل على خطتك",
    description: "خطة وجبات يومية مخصصة لك مع بدائل ذكية وحساب سعرات دقيق",
  },
  {
    icon: TrendingDown,
    title: "تابع تقدمك",
    description: "رسم بياني لوزنك، ملخصات أسبوعية، ونصائح ذكية من الذكاء الاصطناعي",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            كيف يعمل؟
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            ثلاث خطوات بسيطة تفصلك عن بداية جديدة
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative"
            >
              <div className="bg-card rounded-2xl p-8 border border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-lg group">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <span className="text-6xl font-bold text-primary/5 absolute top-4 left-4">
                  {i + 1}
                </span>
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
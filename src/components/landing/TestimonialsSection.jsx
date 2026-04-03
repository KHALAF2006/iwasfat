import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  { name: "سارة م.", quote: "خسيت ١٢ كيلو في ٣ أشهر بدون حرمان! الخطة كانت واقعية وسهلة التطبيق.", rating: 5, lost: 12 },
  { name: "أحمد ع.", quote: "أول مرة أحس إني ملتزم بنظام غذائي. المجموعة والمتابعة فرقت معي كثير.", rating: 5, lost: 8 },
  { name: "نورة خ.", quote: "تحليل الصور بالذكاء الاصطناعي سهّل عليّ كثير حساب السعرات. أنصح فيه!", rating: 5, lost: 15 },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            قصص نجاح حقيقية
          </h2>
          <p className="text-muted-foreground text-lg">
            مشتركون حققوا أهدافهم معنا
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="bg-card rounded-2xl border border-border/50 p-8 hover:shadow-lg transition-shadow"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <p className="text-foreground leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{t.name}</p>
                  <p className="text-sm text-muted-foreground">مشترك سابق</p>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-accent">-{t.lost}</p>
                  <p className="text-xs text-muted-foreground">كغ</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
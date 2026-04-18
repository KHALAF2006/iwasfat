import { Button } from "@/components/ui/button";
import { Check, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const benefits = [
"خطة وجبات يومية مخصصة",
"تحليل وجبات بالذكاء الاصطناعي",
"مجموعة دعم خاصة",
"محتوى تعليمي أسبوعي",
"متابعة من خبير تغذية",
"تتبع الوزن والتقدم",
"ملخص أسبوعي تلقائي",
"حاسبة الوزن المثالي و BMI"];


export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-6 bg-background">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">خطة واحدة — كل شيءffff

          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            اشتراك شهري بسيط يمنحك كل الأدوات التي تحتاجها
          </p>
        </div>

        <div className="bg-card rounded-3xl border border-border/50 shadow-xl overflow-hidden max-w-lg mx-auto">
          <div className="bg-primary p-8">
            <p className="text-primary-foreground/70 text-sm mb-2">الاشتراك الشهري</p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-5xl font-bold text-primary-foreground">١٩٩</span>
              <span className="text-primary-foreground/70">ريال / شهر</span>
            </div>
            <p className="text-primary-foreground/60 text-sm mt-2">أول أسبوع مجاني</p>
          </div>

          <div className="p-8">
            <ul className="space-y-4 text-right mb-8">
              {benefits.map((b, i) =>
              <li key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-foreground">{b}</span>
                </li>
              )}
            </ul>

            <Link to="/register">
              <Button size="lg" className="w-full bg-accent hover:bg-accent/90 text-white text-lg py-6 rounded-xl gap-2">
                ابدأ أسبوعك المجاني
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground mt-4">
              يمكنك الإلغاء في أي وقت خلال الفترة التجريبية
            </p>
          </div>
        </div>
      </div>
    </section>);

}
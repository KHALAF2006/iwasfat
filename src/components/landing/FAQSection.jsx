import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "هل المحتوى باللغة العربية؟", a: "نعم، كل المحتوى والخطط والتطبيق بالكامل باللغة العربية." },
  { q: "هل يناسب النساء والرجال؟", a: "نعم، الخطط مخصصة حسب الجنس والعمر والنشاط البدني لكل مشترك." },
  { q: "كيف أتواصل مع خبير التغذية؟", a: "يمكنك التواصل من خلال المجموعة الخاصة أو عبر الرسائل المباشرة داخل التطبيق." },
  { q: "هل أستطيع تغيير الوجبات المقترحة؟", a: "بالتأكيد! يمكنك استبدال أي وجبة ببديل من قائمة البدائل الذكية مع حساب السعرات تلقائياً." },
  { q: "كيف يعمل تحليل الوجبات بالذكاء الاصطناعي؟", a: "صوّر وجبتك بكاميرا الجوال، والتطبيق يحلل الصورة ويحسب السعرات والعناصر الغذائية تلقائياً." },
  { q: "هل يمكنني إلغاء الاشتراك في أي وقت؟", a: "نعم، يمكنك إلغاء الاشتراك في أي وقت. خلال الأسبوع الأول المجاني لن يتم خصم أي مبلغ." },
  { q: "هل البرنامج يناسب من لديه أمراض مزمنة؟", a: "نأخذ بعين الاعتبار حالتك الصحية عند بناء الخطة، ولكن ننصح باستشارة طبيبك أولاً." },
];

export default function FAQSection() {
  return (
    <section id="faq" className="py-24 px-6 bg-secondary/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            أسئلة شائعة
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card rounded-xl border border-border/50 px-6"
            >
              <AccordionTrigger className="text-right text-foreground font-medium hover:no-underline py-5">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
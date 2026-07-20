import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useT } from "@/i18n";

export default function FAQSection() {
  const t = useT();
  const faqs = t("landing.faq.items") || [];

  return (
    <section id="faq" className="py-24 px-6 bg-secondary/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t("landing.faq.title")}
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card rounded-xl border border-border/50 px-6"
            >
              <AccordionTrigger className="text-start text-foreground font-medium hover:no-underline py-5">
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

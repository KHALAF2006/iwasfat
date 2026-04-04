import { Utensils, Video, Users, Camera, Calculator, Headphones } from "lucide-react";

const features = [
  { icon: Utensils, title: "خطة وجبات يومية مخصصة", desc: "وجبات محسوبة السعرات مع بدائل تناسب ذوقك" },
  { icon: Video, title: "محتوى فيديو تعليمي", desc: "فيديوهات قصيرة (≤5 دقائق) عن التغذية والتمارين" },
  { icon: Users, title: "مجموعة دعم خاصة", desc: "انضم لمجموعة من أشخاص في نفس رحلتك للتحفيز" },
  { icon: Camera, title: "تحليل وجبتك بالذكاء الاصطناعي", desc: "صوّر وجبتك واحصل على تحليل السعرات فوراً" },
  { icon: Calculator, title: "حساب الوزن المثالي", desc: "اعرف BMI وخطة الوصول لوزنك المثالي" },
  { icon: Headphones, title: "متابعة مباشرة من خبير", desc: "خبير تغذية معتمد يتابع تقدمك أسبوعياً" },
];

export default function FeaturesSection({ motivationImage }) {
  return (
    <section id="features" className="py-24 px-6 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                ما ستحصل عليه
              </h2>
              <p className="text-muted-foreground text-lg">
                كل ما تحتاجه لرحلة إنقاص وزن ناجحة في مكان واحد
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {features.map((f, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{f.title}</h4>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <img
              src={motivationImage}
              alt="التحفيز"
              className="rounded-2xl shadow-2xl w-full object-cover aspect-square"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
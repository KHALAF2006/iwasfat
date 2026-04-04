import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function HeroSection({ heroImage }) {
  return (
    <section className="relative h-screen flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="أطعمة صحية"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-black/85 via-black/65 to-black/40" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mr-auto">
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white/80 backdrop-blur-sm border border-white/10 mb-6">
            ابدأ رحلتك نحو النسخة الأفضل منك
          </span>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-tight mb-6">
            كنت سميناً
            <br />
            <span className="text-accent">وانتهى الأمر.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-10 max-w-lg">
            خطة تغذية مخصصة لك، متابعة يومية من خبير، مجتمع داعم، وذكاء اصطناعي يحلل وجباتك — كل ذلك في مكان واحد.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/register">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-white text-lg px-8 py-6 rounded-xl gap-2">
                ابدأ الآن — أول أسبوع مجاني
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="text-white border-white/20 hover:bg-white/10 text-lg px-8 py-6 rounded-xl">
                كيف يعمل؟
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 bg-white/40 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}
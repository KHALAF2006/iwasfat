import HeroSection from "../components/landing/HeroSection";
import HowItWorks from "../components/landing/HowItWorks";
import FeaturesSection from "../components/landing/FeaturesSection";
import TestimonialsSection from "../components/landing/TestimonialsSection";
import PricingSection from "../components/landing/PricingSection";
import FAQSection from "../components/landing/FAQSection";
import Footer from "../components/landing/Footer";

const HERO_IMAGE = "/__generating__/img_2c6ee077ca66.png";
const MOTIVATION_IMAGE = "/__generating__/img_23acd683e57e.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection heroImage={HERO_IMAGE} />
      <HowItWorks />
      <FeaturesSection motivationImage={MOTIVATION_IMAGE} />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <Footer />
    </div>
  );
}
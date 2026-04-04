import HeroSection from "../components/landing/HeroSection";
import HowItWorks from "../components/landing/HowItWorks";
import FeaturesSection from "../components/landing/FeaturesSection";
import TestimonialsSection from "../components/landing/TestimonialsSection";
import PricingSection from "../components/landing/PricingSection";
import FAQSection from "../components/landing/FAQSection";
import Footer from "../components/landing/Footer";
import Navbar from "../components/landing/Navbar";

const HERO_IMAGE = "https://media.base44.com/images/public/69d007075b413b17add2cf30/7dca3c39f_generated_4a75b6ab.png";
const MOTIVATION_IMAGE = "https://media.base44.com/images/public/69d007075b413b17add2cf30/adc736bdf_generated_be6c194d.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
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
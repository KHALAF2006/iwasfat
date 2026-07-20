import { Link } from "react-router-dom";
import { useT } from "@/i18n";

export default function Footer() {
  const t = useT();

  return (
    <footer className="bg-foreground text-background py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-bold mb-4">I Was Fat</h3>
            <p className="text-background/60 text-sm leading-relaxed">
              {t("landing.footer.tagline")}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t("landing.footer.quickLinks")}</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li><a href="#how-it-works" className="hover:text-background transition-colors">{t("landing.nav.howItWorks")}</a></li>
              <li><a href="#pricing" className="hover:text-background transition-colors">{t("landing.nav.pricing")}</a></li>
              <li><a href="#faq" className="hover:text-background transition-colors">{t("landing.nav.faq")}</a></li>
              <li><Link to="/register" className="hover:text-background transition-colors">{t("landing.footer.register")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t("landing.footer.contact")}</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li>{t("landing.footer.email")}: <span dir="ltr">info@iwasfat.com</span></li>
              <li>{t("landing.footer.whatsapp")}: <span dir="ltr">+966 5X XXX XXXX</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-background/10 pt-6 text-center text-sm text-background/40">
          © {new Date().getFullYear()} I Was Fat. {t("landing.footer.rights")}
        </div>
      </div>
    </footer>
  );
}

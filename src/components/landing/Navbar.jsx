import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useT } from "@/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { isAuthenticated, navigateToLogin } = useAuth();
  const t = useT();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: t("landing.nav.howItWorks"), href: "#how-it-works" },
    { label: t("landing.nav.features"), href: "#features" },
    { label: t("landing.nav.pricing"), href: "#pricing" },
    { label: t("landing.nav.faq"), href: "#faq" },
  ];

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className={`text-xl font-bold ${scrolled ? "text-foreground" : "text-white"}`}>
          I Was Fat
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-accent ${
                scrolled ? "text-foreground/70" : "text-white/80"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher className={scrolled ? "text-foreground/70" : "text-white/80"} />
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className={scrolled ? "" : "text-white hover:bg-white/10"}>
                {t("nav.home")}
              </Button>
            </Link>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateToLogin}
              className={scrolled ? "" : "text-white hover:bg-white/10"}
            >
              {t("auth.login")}
            </Button>
          )}
          <Link to="/register">
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-white">
              {t("landing.nav.startNow")}
            </Button>
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className={`md:hidden ${scrolled ? "text-foreground" : "text-white"}`}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-background/95 backdrop-blur-md border-b border-border/50 px-6 py-4 flex flex-col gap-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-foreground/70 hover:text-accent transition-colors"
            >
              {link.label}
            </a>
          ))}
          <LanguageSwitcher className="text-foreground/70" />
          <div className="flex gap-3 pt-2">
            {isAuthenticated ? (
              <Link to="/dashboard" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">{t("nav.home")}</Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => { setOpen(false); navigateToLogin(); }}
              >
                {t("auth.login")}
              </Button>
            )}
            <Link to="/register" className="flex-1">
              <Button size="sm" className="w-full bg-accent hover:bg-accent/90 text-white">{t("landing.nav.startNow")}</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

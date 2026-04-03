import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-foreground text-background py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-bold mb-4">I Was Fat</h3>
            <p className="text-background/60 text-sm leading-relaxed">
              منصة متكاملة لإدارة رحلة إنقاص الوزن بإشراف خبير تغذية معتمد.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">روابط سريعة</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li><a href="#how-it-works" className="hover:text-background transition-colors">كيف يعمل</a></li>
              <li><a href="#pricing" className="hover:text-background transition-colors">الأسعار</a></li>
              <li><a href="#faq" className="hover:text-background transition-colors">أسئلة شائعة</a></li>
              <li><Link to="/register" className="hover:text-background transition-colors">التسجيل</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">تواصل معنا</h4>
            <ul className="space-y-2 text-sm text-background/60">
              <li>البريد: info@iwasfat.com</li>
              <li>واتساب: +966 5X XXX XXXX</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-background/10 pt-6 text-center text-sm text-background/40">
          © {new Date().getFullYear()} I Was Fat. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}
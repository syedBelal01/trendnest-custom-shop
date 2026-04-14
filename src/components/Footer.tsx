import { Link } from 'react-router-dom';
import { Home, ShoppingBag, Paintbrush, TrendingUp, MessageCircle, HelpCircle, RotateCcw, Truck, Package, Mail, Phone } from 'lucide-react';

const shopLinks = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/category/home', label: 'Home Essentials', icon: ShoppingBag },
  { to: '/category/printed', label: 'Printed Products', icon: Paintbrush },
  { to: '/category/trending', label: 'Trending', icon: TrendingUp },
];

const helpLinks = [
  { to: '/contact', label: 'Contact Us', icon: MessageCircle },
  { to: '/faqs', label: 'FAQs', icon: HelpCircle },
  { to: '/returns', label: 'Return Policy', icon: RotateCcw },
  { to: '/shipping', label: 'Shipping Policy', icon: Truck },
  { to: '/account/orders', label: 'Track My Order', icon: Package },
];

export default function Footer() {
  return (
    <footer className="bg-card border-t mt-12 sm:mt-16">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-12">
        {/* Brand */}
        <div className="mb-5 sm:mb-0">
          <h3 className="font-bold text-lg mb-1">
            Trend<span className="text-primary">Nest</span>99
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xs">
            Your one-stop shop for trendy fashion, home essentials, and custom prints.
          </p>
        </div>

        {/* Links grid — 2 cols on mobile, 4 on md+ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-8 mt-5 sm:mt-8">
          {/* Shop */}
          <div>
            <h4 className="font-semibold mb-2 text-sm">Shop</h4>
            <div className="space-y-2">
              {shopLinks.map(l => (
                <Link key={l.to} to={l.to} className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5">
                  <l.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{l.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Help */}
          <div>
            <h4 className="font-semibold mb-2 text-sm">Help</h4>
            <div className="space-y-2">
              {helpLinks.map(l => (
                <Link key={l.to} to={l.to} className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5">
                  <l.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{l.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Contact — spans full width on mobile */}
          <div className="col-span-2 md:col-span-2">
            <h4 className="font-semibold mb-2 text-sm">Contact</h4>
            <div className="flex flex-col gap-2">
              <a href="mailto:support@trendnest99.in" className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="break-all">support@trendnest99.in</span>
              </a>
              <a
                href="https://wa.me/918543841110"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>WhatsApp: 8543841110</span>
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t py-3 text-center text-[10px] sm:text-xs text-muted-foreground">
        © 2026 TrendNest99. All rights reserved.
      </div>
    </footer>
  );
}

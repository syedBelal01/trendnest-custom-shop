import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-card border-t mt-12 sm:mt-16">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
        <div className="col-span-2 sm:col-span-1">
          <h3 className="font-bold text-lg mb-2 sm:mb-3">Trend<span className="text-primary">Nest</span>99</h3>
          <p className="text-sm text-muted-foreground">Your one-stop shop for trendy fashion, home essentials, and custom prints.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-2 sm:mb-3 text-sm">Shop</h4>
          <div className="space-y-1.5 sm:space-y-2 text-sm text-muted-foreground">
            <Link to="/" className="block hover:text-foreground">Home</Link>
            <Link to="/category/home" className="block hover:text-foreground">Home Essentials</Link>
            <Link to="/category/printed" className="block hover:text-foreground">Printed Products</Link>
            <Link to="/category/trending" className="block hover:text-foreground">Trending</Link>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2 sm:mb-3 text-sm">Help</h4>
          <div className="space-y-1.5 sm:space-y-2 text-sm text-muted-foreground">
            <span className="block">Track Order</span>
            <span className="block">Returns</span>
            <span className="block">Shipping Info</span>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2 sm:mb-3 text-sm">Contact</h4>
          <div className="space-y-1.5 sm:space-y-2 text-sm text-muted-foreground">
            <a
              href="mailto:trendnest099@gmail.com"
              className="block break-all hover:text-foreground"
            >
              trendnest099@gmail.com
            </a>
            <a
              href="https://wa.me/918543841110"
              target="_blank"
              rel="noreferrer"
              className="block hover:text-foreground"
            >
              WhatsApp: 8543841110
            </a>
          </div>
        </div>
      </div>
      <div className="border-t py-3 sm:py-4 text-center text-xs text-muted-foreground">
        © 2026 TrendNest99. All rights reserved.
      </div>
    </footer>
  );
}

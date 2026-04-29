import { Link } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle, Send, Youtube } from 'lucide-react';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-100 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:grid-cols-5 md:px-8">
        <div className="md:col-span-2">
          <div className="text-xl font-extrabold">
            TrendNest<span className="text-orange-600">99</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
            Your one-stop shop for trendy fashion, home essentials, and custom prints.
          </p>
          <div className="mt-5 flex gap-3">
            <a
              aria-label="Instagram"
              href="https://www.instagram.com/trendnest099?utm_source=qr&igsh=MWR0ZzBqOGloZzZzNg=="
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full bg-orange-50 text-orange-600"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              aria-label="WhatsApp"
              href="https://wa.me/918543841110"
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full bg-orange-50 text-orange-600"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
            <a
              aria-label="Facebook"
              href="https://www.facebook.com/share/18QuviL6fn/"
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full bg-orange-50 text-orange-600"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              aria-label="YouTube"
              href="https://www.youtube.com/"
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full bg-orange-50 text-orange-600"
            >
              <Youtube className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-extrabold">Shop</h4>
          <ul className="mt-4 space-y-2 text-sm text-slate-500">
            <li>
              <Link to="/category/home" className="hover:text-orange-600 transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link to="/category/printed" className="hover:text-orange-600 transition-colors">
                Prints
              </Link>
            </li>
            <li>
              <Link to="/category/trending" className="hover:text-orange-600 transition-colors">
                Trending
              </Link>
            </li>
            <li>
              <Link to="/" className="hover:text-orange-600 transition-colors">
                All Products
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-extrabold">Help</h4>
          <ul className="mt-4 space-y-2 text-sm text-slate-500">
            <li>
              <Link to="/contact" className="hover:text-orange-600 transition-colors">
                Contact Us
              </Link>
            </li>
            <li>
              <Link to="/faqs" className="hover:text-orange-600 transition-colors">
                FAQs
              </Link>
            </li>
            <li>
              <Link to="/returns" className="hover:text-orange-600 transition-colors">
                Return Policy
              </Link>
            </li>
            <li>
              <Link to="/account/orders" className="hover:text-orange-600 transition-colors">
                Track My Order
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-extrabold">Newsletter</h4>
          <p className="mt-4 text-sm text-slate-500">
            Subscribe to get updates on new arrivals &amp; offers.
          </p>
          <div className="mt-4 flex rounded-xl border border-slate-200 p-1">
            <input
              className="min-w-0 flex-1 px-3 text-sm outline-none bg-transparent"
              placeholder="Enter your email"
            />
            <button
              className="grid h-10 w-10 place-items-center rounded-lg bg-orange-600 text-white"
              type="button"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">
        © {year} TrendNest99. All rights reserved.
        <span className="mx-2 opacity-50">·</span>
        Developed by{' '}
        <a
          href="https://webfisher.in"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground hover:underline"
        >
          Webfisher
        </a>
      </div>
    </footer>
  );
}

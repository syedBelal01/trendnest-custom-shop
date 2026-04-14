import { Link } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Contact Us</h1>
      <p className="text-sm text-muted-foreground mb-8">
        We&apos;re here to help with orders, products, and general questions.
      </p>
      <div className="rounded-xl border bg-card p-5 sm:p-6 space-y-6">
        <div className="flex gap-3">
          <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">Email</div>
            <a
              href="mailto:support@trendnest99.in"
              className="text-sm text-primary hover:underline break-all"
            >
              support@trendnest99.in
            </a>
          </div>
        </div>
        <div className="flex gap-3">
          <MessageCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">WhatsApp</div>
            <a
              href="https://wa.me/918543841110"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              +91 85438 41110
            </a>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-8">
        <Link to="/" className="text-primary hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}

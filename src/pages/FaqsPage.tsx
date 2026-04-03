import { Link } from 'react-router-dom';

const items: { q: string; a: string }[] = [
  {
    q: 'How do I place an order?',
    a: 'Add items to your cart, go to checkout, enter your delivery details, and confirm with Cash on Delivery (COD).',
  },
  {
    q: 'How can I track my order?',
    a: 'Sign in and open My Orders from your account to see status updates. Use Track My Order in the footer for quick access.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We currently offer Cash on Delivery (COD) for eligible orders.',
  },
  {
    q: 'How do returns work?',
    a: 'See our Return Policy for eligibility, timelines, and how to start a return.',
  },
];

export default function FaqsPage() {
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">FAQs</h1>
      <p className="text-sm text-muted-foreground mb-8">Common questions about shopping with TrendNest99.</p>
      <ul className="space-y-6">
        {items.map(({ q, a }) => (
          <li key={q} className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="font-semibold text-sm sm:text-base mb-2">{q}</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground mt-8">
        <Link to="/contact" className="text-primary hover:underline">
          Still need help? Contact us
        </Link>
        {' · '}
        <Link to="/" className="text-primary hover:underline">
          Home
        </Link>
      </p>
    </div>
  );
}

import { Link } from 'react-router-dom';

export default function ShippingPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Shipping Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: April 2026</p>
      <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground">
        <p>
          We ship across India. Delivery times and fees may vary by location, product availability, and promotions shown
          at checkout.
        </p>
        <h2 className="text-foreground font-semibold text-base mt-6">Processing</h2>
        <p>
          Orders are typically processed within 1–2 business days after confirmation. You&apos;ll receive updates by email
          when your order ships or if there are delays.
        </p>
        <h2 className="text-foreground font-semibold text-base mt-6">Delivery</h2>
        <p>
          Estimated delivery windows are shown at checkout and in your order confirmation. Remote areas may require
          additional time.
        </p>
        <h2 className="text-foreground font-semibold text-base mt-6">Tracking</h2>
        <p>
          Signed-in customers can track orders under{' '}
          <Link to="/account/orders" className="text-primary hover:underline">
            My Orders
          </Link>
          . Use &quot;Track My Order&quot; in the site footer for quick access (login required for account orders).
        </p>
      </div>
      <p className="text-xs text-muted-foreground mt-8">
        <Link to="/returns" className="text-primary hover:underline">
          Return Policy
        </Link>
        {' · '}
        <Link to="/" className="text-primary hover:underline">
          Home
        </Link>
      </p>
    </div>
  );
}

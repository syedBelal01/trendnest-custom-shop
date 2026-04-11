import { Link } from 'react-router-dom';

export default function ReturnPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Return Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: April 2026</p>
      <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground">
        <p>
          We want you to be happy with your purchase. If something isn&apos;t right, you may be eligible for a return or
          exchange subject to the conditions below.
        </p>
        <h2 className="text-foreground font-semibold text-base mt-6">Eligibility</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Items must be unused, in original packaging, with tags attached where applicable.</li>
          <li>
            Return requests must be submitted from your account within the return window after delivery (default{' '}
            <strong className="text-foreground">7 days</strong>; the store may configure a different window on the server).
          </li>
          <li>Custom or personalized items are not eligible for self-serve returns in the app; contact support for defects or errors.</li>
        </ul>
        <h2 className="text-foreground font-semibold text-base mt-6">How to start a return</h2>
        <p>
          Sign in, open <Link to="/account/orders" className="text-primary hover:underline">My Orders</Link>, select the
          delivered order, and use <strong className="text-foreground">Request a return</strong>. You can describe the issue,
          optionally add photos, and choose a full or partial return. Our team will approve or decline the request; you can
          track status on the same order page.
        </p>
        <p>
          Need help? Email{' '}
          <a href="mailto:trendnest099@gmail.com" className="text-primary hover:underline">
            trendnest099@gmail.com
          </a>
          .
        </p>
        <h2 className="text-foreground font-semibold text-base mt-6">Refunds</h2>
        <p>
          After your return is received and approved for refund, prepaid (online) orders are refunded via Razorpay to the
          original payment method when possible. Cash on Delivery orders are recorded as manual refund or store credit in our
          system after verification.
        </p>
      </div>
      <p className="text-xs text-muted-foreground mt-8">
        <Link to="/faqs" className="text-primary hover:underline">
          FAQs
        </Link>
        {' · '}
        <Link to="/" className="text-primary hover:underline">
          Home
        </Link>
      </p>
    </div>
  );
}

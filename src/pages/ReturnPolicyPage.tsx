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
          <li>Return requests should be initiated within the timeframe stated at the time of purchase (typically 7–14 days of delivery).</li>
          <li>Custom or personalized items may not be eligible unless defective or incorrect.</li>
        </ul>
        <h2 className="text-foreground font-semibold text-base mt-6">How to start a return</h2>
        <p>
          Contact us at{' '}
          <a href="mailto:trendnest099@gmail.com" className="text-primary hover:underline">
            trendnest099@gmail.com
          </a>{' '}
          or via WhatsApp with your order ID and reason. We&apos;ll confirm next steps.
        </p>
        <h2 className="text-foreground font-semibold text-base mt-6">Refunds</h2>
        <p>
          Approved refunds are processed to the original payment method where possible, or as store credit, in line with
          our team&apos;s confirmation.
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

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Outlet, useLocation } from 'react-router-dom';
import ReviewPromptBar from '@/components/reviews/ReviewPromptBar';
import ReviewReminderPopup from '@/components/reviews/ReviewReminderPopup';
import { useEffect } from 'react';
import { useProducts } from '@/contexts/ProductsContext';

export default function Layout() {
  const loc = useLocation();
  const { loading } = useProducts();

  useEffect(() => {
    // Used by vite-plugin-prerender to know when route content is ready.
    if (loading) return;
    const t = window.setTimeout(() => {
      document.dispatchEvent(new Event('tn_prerender_ready'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [loading, loc.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ReviewPromptBar />
      <ReviewReminderPopup />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

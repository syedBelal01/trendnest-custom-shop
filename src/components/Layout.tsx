import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Outlet, useLocation } from 'react-router-dom';
import ReviewPromptBar from '@/components/reviews/ReviewPromptBar';
import ReviewReminderPopup from '@/components/reviews/ReviewReminderPopup';
import { useEffect } from 'react';
import { useProducts } from '@/contexts/ProductsContext';
import { useSaleBanners } from '@/contexts/SaleBannersContext';
import GlobalSaleThemeLayer from '@/components/GlobalSaleThemeLayer';

export default function Layout() {
  const loc = useLocation();
  const { loading } = useProducts();
  const { activeTheme } = useSaleBanners();

  useEffect(() => {
    // Used by vite-plugin-prerender to know when route content is ready.
    if (loading) return;
    const t = window.setTimeout(() => {
      document.dispatchEvent(new Event('tn_prerender_ready'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [loading, loc.pathname]);

  useEffect(() => {
    if (!activeTheme) {
      document.body.removeAttribute('data-sale-theme');
      return;
    }
    document.body.setAttribute('data-sale-theme', activeTheme);
    return () => {
      document.body.removeAttribute('data-sale-theme');
    };
  }, [activeTheme]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <GlobalSaleThemeLayer />
      <div className="relative z-[2] flex min-h-screen flex-col">
        <Header />
        <ReviewPromptBar />
        <ReviewReminderPopup />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Outlet } from 'react-router-dom';
import ReviewPromptBar from '@/components/reviews/ReviewPromptBar';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ReviewPromptBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

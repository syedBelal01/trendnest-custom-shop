import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function UserGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const returnPath = `${location.pathname}${location.search}`;
      const qs = new URLSearchParams({ redirect: returnPath });
      navigate(`/login?${qs.toString()}`, { replace: true });
    }
  }, [loading, user, navigate, location.pathname, location.search]);

  if (loading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;
  if (!user) return null;

  return <>{children}</>;
}

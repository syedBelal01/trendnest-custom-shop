import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function UserGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate('/login', { replace: true });
  }, [loading, user, navigate]);

  if (loading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;
  if (!user) return null;

  return <>{children}</>;
}

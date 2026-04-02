import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMeApi } from '@/lib/authApi';
import type { User } from '@/types';

export default function UserGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await fetchMeApi();
        if (!mounted) return;
        setUser(u);
        if (!u) navigate('/login', { replace: true });
      } catch {
        if (!mounted) return;
        navigate('/login', { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (loading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;
  if (!user) return null;

  return <>{children}</>;
}


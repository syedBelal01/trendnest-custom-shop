import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { fetchMeApi, resetPasswordApi, setPasswordApi } from '@/lib/authApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { User } from '@/types';

export default function AccountSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await fetchMeApi();
        if (!mounted) return;
        setUser(u);
      } catch {
        toast.error('Could not load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onSetPassword = async () => {
    if (!user) return;
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await setPasswordApi({ password });
      toast.success('Password updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not set password');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <div className="py-10 text-center text-muted-foreground">Not logged in</div>;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Account Settings</h1>
      <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
        <div className="text-sm text-muted-foreground">
          Email: <span className="text-foreground font-medium">{user.email}</span>
        </div>

        <div>
          <label className="text-sm font-medium">New password</label>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mt-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Confirm password</label>
          <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" className="mt-2" />
        </div>

        <Button type="button" disabled={busy} onClick={() => void onSetPassword()} className="w-full">
          {busy ? 'Updating…' : 'Update Password'}
        </Button>
      </div>
    </div>
  );
}


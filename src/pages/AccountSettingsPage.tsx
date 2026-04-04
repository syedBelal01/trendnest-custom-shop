import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchMeApi, setPasswordApi } from '@/lib/authApi';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { User } from '@/types';
import { ArrowLeft, Lock, Mail, ShieldCheck } from 'lucide-react';

export default function AccountSettingsPage() {
  const { refreshAuth } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
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
    if (!user.mustResetPassword) {
      if (!currentPassword) {
        toast.error('Enter your current password');
        return;
      }
    }
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
      const updated = await setPasswordApi({
        password,
        currentPassword: user.mustResetPassword ? undefined : currentPassword,
      });
      if (updated) setUser(updated);
      await refreshAuth();
      toast.success(user.mustResetPassword ? 'Password saved' : 'Password updated');
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not set password');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <div className="py-10 text-center text-muted-foreground">Not logged in</div>;

  const needsCurrent = !user.mustResetPassword;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 sm:py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/account"
          className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      {/* Account info */}
      <div className="rounded-2xl border bg-card shadow-sm p-4">
        <div className="flex items-center gap-3 text-sm">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Signed in as</div>
            <div className="font-medium">{user.email}</div>
          </div>
        </div>
      </div>

      {/* Password form */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            {user.mustResetPassword ? 'Set Your Password' : 'Update Password'}
          </span>
        </div>
        <div className="p-4 space-y-4">
          {needsCurrent && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="pl-10 h-11 rounded-xl"
                  autoComplete="current-password"
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="pl-10 h-11 rounded-xl"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="pl-10 h-11 rounded-xl"
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button disabled={busy} onClick={() => void onSetPassword()} className="w-full h-11 rounded-xl font-semibold">
            {busy ? 'Updating…' : user.mustResetPassword ? 'Save Password' : 'Update Password'}
          </Button>
        </div>
      </div>
    </div>
  );
}

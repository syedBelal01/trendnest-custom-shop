import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchMeApi, loginApi, requestAuthOtpApi, verifyOtpApi } from '@/lib/authApi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function LoginPage() {
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await fetchMeApi();
        if (!mounted) return;
        if (u) {
          window.location.href = u.mustResetPassword ? '/account/settings' : '/account';
          return;
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onLogin = async () => {
    if (!email.trim() || !password) {
      toast.error('Enter email and password');
      return;
    }
    setBusy(true);
    try {
      const user = await loginApi({ email, password });
      toast.success('Logged in');
      if (user?.mustResetPassword) window.location.href = '/account/settings';
      else window.location.href = '/account';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const onRequestOtp = async () => {
    if (!email.trim()) {
      toast.error('Enter your email');
      return;
    }
    setBusy(true);
    try {
      const { challengeId } = await requestAuthOtpApi({ email: email.trim(), name: name.trim() || undefined, phone: phone.trim() || undefined });
      setOtpChallengeId(challengeId);
      toast.success('OTP sent. Enter it to continue.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  };

  const onVerifyOtp = async () => {
    if (!otpChallengeId) {
      toast.error('Request OTP first');
      return;
    }
    if (!otp || otp.length < 4) {
      toast.error('Enter OTP');
      return;
    }
    setBusy(true);
    try {
      const { user } = await verifyOtpApi({ challengeId: otpChallengeId, code: otp });
      toast.success('Logged in');
      window.location.href = user?.mustResetPassword ? '/account/settings' : '/account';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'OTP verification failed');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return <div className="py-10 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Account</h1>
      <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
        <Tabs defaultValue="login">
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">Login</TabsTrigger>
            <TabsTrigger value="register" className="flex-1">Register (OTP)</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} className="mt-2" placeholder="you@email.com" />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2" placeholder="••••••••" />
            </div>
            <Button onClick={() => void onLogin()} disabled={busy} className="w-full">
              {busy ? 'Logging in…' : 'Login'}
            </Button>
            <div className="text-center text-sm">
              <a className="text-primary hover:underline" href="/forgot-password">
                Forgot password?
              </a>
            </div>
          </TabsContent>

          <TabsContent value="register" className="space-y-4">
            <div className="grid gap-3">
              <div>
                <label className="text-sm font-medium">Full name</label>
                <Input value={name} onChange={e => setName(e.target.value)} className="mt-2" placeholder="Your name" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} className="mt-2" placeholder="you@email.com" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone (optional)</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-2" placeholder="Phone number" />
              </div>
            </div>

            {!otpChallengeId ? (
              <Button onClick={() => void onRequestOtp()} disabled={busy} className="w-full">
                {busy ? 'Sending OTP…' : 'Send OTP'}
              </Button>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  Enter the OTP sent to <span className="font-medium text-foreground">{email}</span>
                </div>
                <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="mx-auto" className="w-full">
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <Button onClick={() => void onVerifyOtp()} disabled={busy} className="w-full">
                  {busy ? 'Verifying…' : 'Verify & Continue'}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


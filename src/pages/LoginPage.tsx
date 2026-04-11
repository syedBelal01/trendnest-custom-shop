import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginApi, requestAuthOtpApi, verifyOtpApi } from '@/lib/authApi';
import { useAuth } from '@/contexts/AuthContext';
import { getSafePostLoginRedirect } from '@/lib/safeRedirect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Mail, Lock, User, Phone, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { IndianPhoneInput } from '@/components/forms/IndianPhoneInput';
import { isIndianPhoneValid, normalizeIndianPhoneOptional, validateIndianPhone } from '@/lib/indianPhone';

const SESSION_NOT_VERIFIED =
  'Session could not be verified. Try again, or open the site in your regular browser (Safari/Chrome) if you are in an in-app browser.';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, refreshAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  const postLoginPath = useCallback(
    (mustReset: boolean) => {
      if (mustReset) return '/account/settings';
      const r = getSafePostLoginRedirect(searchParams.get('redirect'));
      return r ?? '/account';
    },
    [searchParams]
  );

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      navigate(postLoginPath(!!user.mustResetPassword), { replace: true });
    }
  }, [authLoading, user, navigate, postLoginPath]);

  const onLogin = async () => {
    if (!email.trim() || !password) {
      toast.error('Enter email and password');
      return;
    }
    setBusy(true);
    try {
      await loginApi({ email, password });
      const u = await refreshAuth();
      if (!u) {
        toast.error(SESSION_NOT_VERIFIED);
        return;
      }
      toast.success('Logged in');
      // Navigation runs in useEffect once `user` is committed—avoids UserGuard racing on mobile.
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
    let phoneParam: string | undefined;
    if (phone.trim()) {
      const pv = validateIndianPhone(phone);
      if (!isIndianPhoneValid(pv)) {
        toast.error(pv.error);
        return;
      }
      phoneParam = pv.digits;
    }
    setBusy(true);
    try {
      const { challengeId } = await requestAuthOtpApi({
        email: email.trim(),
        name: name.trim() || undefined,
        phone: phoneParam,
      });
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
    let phoneForVerify: string | undefined;
    try {
      phoneForVerify = normalizeIndianPhoneOptional(phone);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid phone');
      return;
    }
    setBusy(true);
    try {
      await verifyOtpApi({
        challengeId: otpChallengeId,
        code: otp,
        name: name.trim() || undefined,
        phone: phoneForVerify,
      });
      const u = await refreshAuth();
      if (!u) {
        toast.error(SESSION_NOT_VERIFIED);
        return;
      }
      toast.success('Logged in');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'OTP verification failed');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account or create a new one</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card shadow-lg overflow-hidden">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="w-full rounded-none border-b bg-muted/30 h-12 p-0">
              <TabsTrigger value="login" className="flex-1 rounded-none h-full data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary font-semibold">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1 rounded-none h-full data-[state=active]:bg-card data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary font-semibold">
                Create Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="p-5 sm:p-6 space-y-4 mt-0">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    placeholder="you@email.com"
                    type="email"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <Button
                onClick={() => void onLogin()}
                disabled={busy}
                className="w-full h-11 rounded-xl font-semibold text-sm gap-2"
              >
                {busy ? 'Signing in…' : <>Sign In <ArrowRight className="h-4 w-4" /></>}
              </Button>
              <div className="text-center">
                <a className="text-xs text-primary hover:underline font-medium" href="/forgot-password">
                  Forgot your password?
                </a>
              </div>
            </TabsContent>

            <TabsContent value="register" className="p-5 sm:p-6 space-y-4 mt-0">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={name} onChange={e => setName(e.target.value)} className="pl-10 h-11 rounded-xl" placeholder="Your name" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-11 rounded-xl" placeholder="you@email.com" type="email" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone (optional)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                    <IndianPhoneInput
                      value={phone}
                      onChange={setPhone}
                      className="pl-10 h-11 rounded-xl"
                      placeholder="10-digit mobile"
                    />
                  </div>
                </div>
              </div>

              {!otpChallengeId ? (
                <Button onClick={() => void onRequestOtp()} disabled={busy} className="w-full h-11 rounded-xl font-semibold text-sm gap-2">
                  {busy ? 'Sending OTP…' : <>Send OTP <ArrowRight className="h-4 w-4" /></>}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <span>OTP sent to <span className="font-medium text-foreground">{email}</span></span>
                  </div>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="justify-center">
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <Button onClick={() => void onVerifyOtp()} disabled={busy} className="w-full h-11 rounded-xl font-semibold text-sm gap-2">
                    {busy ? 'Verifying…' : <>Verify & Continue <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer trust */}
        <p className="text-center text-[11px] text-muted-foreground">
          By continuing, you agree to our Terms of Service & Privacy Policy.
        </p>
      </div>
    </div>
  );
}

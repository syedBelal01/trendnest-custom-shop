import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/contexts/AuthContext';
import { loginApi, requestCheckoutOtpApi, setPasswordApi, verifyOtpApi } from '@/lib/authApi';
import { isIndianPhoneValid, validateIndianPhone } from '@/lib/indianPhone';

const LAST_GUEST_CHECKOUT_KEY = 'tn:last_guest_checkout_v1';

type GuestCheckoutSeed = {
  orderId?: string;
  email?: string;
  phone?: string;
  name?: string;
  createdAt?: string;
};

function readGuestCheckoutSeed(locationState: unknown): GuestCheckoutSeed | null {
  const fromState = locationState && typeof locationState === 'object' ? (locationState as GuestCheckoutSeed) : null;
  if (fromState?.phone || fromState?.email || fromState?.orderId || fromState?.name) return fromState;
  try {
    const raw = sessionStorage.getItem(LAST_GUEST_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestCheckoutSeed;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.phone && !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

function simpleEmailValid(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function AccountClaimPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, refreshAuth } = useAuth();

  const seed = useMemo(() => readGuestCheckoutSeed(location.state), [location.state]);

  const [fullName, setFullName] = useState(() => String(seed?.name || '').trim());
  const [email, setEmail] = useState(() => String(seed?.email || '').trim());
  const [phone, setPhone] = useState(() => String(seed?.phone || '').trim());
  const [orderId] = useState(() => String(seed?.orderId || '').trim());

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate('/account/orders', { replace: true });
      return;
    }
    if (!phone) {
      toast.error('Guest checkout details not found. Place an order first.');
      navigate('/checkout', { replace: true });
    }
  }, [loading, user, phone, navigate]);

  const sendOtp = async () => {
    if (!fullName.trim()) {
      toast.error('Enter your full name');
      return;
    }
    if (!simpleEmailValid(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    const phoneCheck = validateIndianPhone(phone);
    if (!isIndianPhoneValid(phoneCheck)) {
      toast.error(phoneCheck.error);
      return;
    }
    setOtpBusy(true);
    try {
      const out = await requestCheckoutOtpApi({
        name: fullName.trim(),
        email: email.trim(),
        phone: phoneCheck.digits,
      });
      setChallengeId(out.challengeId);
      setOtpVerified(false);
      setOtpCode('');
      toast.success('OTP sent to your email');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!challengeId) {
      toast.error('Send OTP first');
      return;
    }
    if (!fullName.trim()) {
      toast.error('Enter your full name');
      return;
    }
    if (!otpCode || otpCode.length < 4) {
      toast.error('Enter OTP');
      return;
    }
    const phoneCheck = validateIndianPhone(phone);
    if (!isIndianPhoneValid(phoneCheck)) {
      toast.error(phoneCheck.error);
      return;
    }
    setOtpBusy(true);
    try {
      await verifyOtpApi({
        challengeId,
        code: otpCode,
        name: fullName.trim(),
        phone: phoneCheck.digits,
      });
      await refreshAuth();
      setOtpVerified(true);
      toast.success('Email verified');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'OTP verification failed');
    } finally {
      setOtpBusy(false);
    }
  };

  const createPasswordAndClaim = async () => {
    if (!otpVerified) {
      toast.error('Verify OTP first');
      return;
    }
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setPasswordBusy(true);
    try {
      await setPasswordApi({ password });
      await loginApi({ email: email.trim(), password });
      await refreshAuth();
      try {
        sessionStorage.removeItem(LAST_GUEST_CHECKOUT_KEY);
      } catch {
        // ignore storage issues
      }
      toast.success('Account created and orders linked');
      navigate('/account/orders', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not finish account setup');
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-10">
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <h1 className="text-2xl font-black tracking-tight">Claim Your Guest Order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Verify your email, set a password, and access your order history from one account.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login?redirect=%2Faccount%2Forders" className="font-semibold text-primary hover:underline">
            Login
          </Link>
        </p>
        {orderId ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Guest Order ID: <span className="font-mono text-foreground">{orderId}</span>
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full name</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11"
              placeholder="Your full name"
              autoComplete="name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone number</label>
            <Input value={phone} readOnly className="h-11 bg-muted/40" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="h-11"
              placeholder="you@example.com"
            />
          </div>

          <Button type="button" className="h-11 w-full" onClick={() => void sendOtp()} disabled={otpBusy}>
            {otpBusy ? 'Sending OTP…' : 'Send OTP'}
          </Button>

          {challengeId ? (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <p className="text-sm font-medium">Enter OTP</p>
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} containerClassName="mx-auto">
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full"
                onClick={() => void verifyOtp()}
                disabled={otpBusy || otpVerified}
              >
                {otpVerified ? 'OTP Verified' : otpBusy ? 'Verifying…' : 'Verify OTP'}
              </Button>
            </div>
          ) : null}

          {otpVerified ? (
            <div className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-medium">Create Password</p>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="h-11"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                className="h-11"
              />
              <Button
                type="button"
                className="h-11 w-full"
                onClick={() => void createPasswordAndClaim()}
                disabled={passwordBusy}
              >
                {passwordBusy ? 'Saving…' : 'Create Account & View Orders'}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

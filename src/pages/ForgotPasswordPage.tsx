import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { forgotPasswordOtpApi, resetPasswordApi } from '@/lib/authApi';
import { ArrowLeft, Lock, Mail, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const requestOtp = async () => {
    if (!email.trim()) {
      toast.error('Enter your email');
      return;
    }
    setBusy(true);
    try {
      const res = await forgotPasswordOtpApi({ email });
      if (!res.challengeId) {
        toast.success('If the email exists, an OTP was sent.');
        setChallengeId(null);
        return;
      }
      setChallengeId(res.challengeId);
      toast.success('OTP sent. Enter it to reset your password.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not request OTP');
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    if (!challengeId) {
      toast.error('Request OTP first');
      return;
    }
    if (!otp || otp.length < 4) {
      toast.error('Enter OTP code');
      return;
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
      await resetPasswordApi({ challengeId, code: otp, password });
      toast.success('Password reset successfully');
      window.location.href = '/account';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reset Password</h1>
          <p className="text-sm text-muted-foreground">We'll send a verification code to your email</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card shadow-lg p-5 sm:p-6 space-y-4">
          {!challengeId ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="pl-10 h-11 rounded-xl" type="email" />
                </div>
              </div>
              <Button onClick={() => void requestOtp()} disabled={busy} className="w-full h-11 rounded-xl font-semibold gap-2">
                {busy ? 'Sending…' : <>Send OTP <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </>
          ) : (
            <>
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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 h-11 rounded-xl" placeholder="At least 8 characters" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="pl-10 h-11 rounded-xl" placeholder="Repeat password" />
                </div>
              </div>
              <Button onClick={() => void onReset()} disabled={busy} className="w-full h-11 rounded-xl font-semibold gap-2">
                {busy ? 'Resetting…' : <>Reset Password <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </>
          )}
        </div>

        <div className="text-center">
          <Link to="/login" className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { forgotPasswordOtpApi, resetPasswordApi } from '@/lib/authApi';

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
    <div className="max-w-lg mx-auto px-3 sm:px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Reset Password</h1>
      <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
        {!challengeId ? (
          <>
            <label className="text-sm font-medium">Email</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
            <Button onClick={() => void requestOtp()} disabled={busy} className="w-full">
              {busy ? 'Sending…' : 'Send OTP'}
            </Button>
          </>
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

            <div>
              <label className="text-sm font-medium">New password</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-medium">Confirm password</label>
              <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-2" />
            </div>

            <Button onClick={() => void onReset()} disabled={busy} className="w-full">
              {busy ? 'Resetting…' : 'Reset Password'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}


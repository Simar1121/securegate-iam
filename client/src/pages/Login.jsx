import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Lock, Mail, Eye, EyeOff, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

export const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const { login, verifyLoginOtp, resendLoginOtp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (!challengeId || resendCountdown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setResendCountdown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [challengeId, resendCountdown]);

  const handleCredentialsSubmit = async (event) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      toast.warning('Enter your registered email or employee ID and password.');
      return;
    }

    try {
      setLoading(true);
      const result = await login(identifier.trim(), password);
      if (!result.requiresOtp || !result.challengeId) {
        throw new Error('SecureGate did not return an email verification challenge.');
      }
      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail || 'your registered email');
      setResendCountdown(result.resendAfterSeconds || 45);
      setOtp('');
      toast.success('Verification code sent to your registered email.');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Unable to start sign-in.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      toast.warning('Enter the six-digit email verification code.');
      return;
    }

    try {
      setLoading(true);
      const result = await verifyLoginOtp({ challengeId, code: otp });
      toast.success(`Welcome back, ${result.user.fullName || result.user.firstName}!`);
      if (result.user.role?.name === 'Employee') {
        navigate('/profile');
      } else {
        navigate(from === '/login' ? '/dashboard' : from);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Verification failed. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!challengeId || resendCountdown > 0 || resending) return;
    try {
      setResending(true);
      const result = await resendLoginOtp(challengeId);
      setMaskedEmail(result.maskedEmail || maskedEmail);
      setResendCountdown(result.resendAfterSeconds || 45);
      setOtp('');
      toast.success('A new verification code has been sent.');
    } catch (error) {
      const retryAfter = error.response?.data?.retryAfterSeconds;
      if (retryAfter) setResendCountdown(retryAfter);
      toast.error(error.response?.data?.message || 'Unable to resend the code.');
    } finally {
      setResending(false);
    }
  };

  const startOver = () => {
    setChallengeId('');
    setOtp('');
    setPassword('');
    setResendCountdown(0);
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-violet-900/40">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="font-extrabold text-2xl tracking-wider text-white">SECURE<span className="text-violet-400">GATE</span></span>
            <span className="block text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Enterprise IAM</span>
          </div>
        </div>

        <h2 className="mt-6 text-center text-xl font-bold tracking-tight text-white">
          {challengeId ? 'Verify your sign-in' : 'Sign in to your organization'}
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          {challengeId
            ? `Enter the six-digit code sent to ${maskedEmail}.`
            : 'Identity verification with mandatory email multi-factor authentication'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-charcoal-900/90 border border-charcoal-800 backdrop-blur-xl py-8 px-6 sm:px-8 shadow-2xl rounded-2xl">
          {!challengeId ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Work Email or Employee ID</label>
                <div className="mt-1.5 relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="name@company.com or SEC-0001"
                    autoComplete="username"
                    required
                    className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
                <div className="mt-1.5 relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-500 hover:text-slate-300 absolute right-3.5 top-1/2 -translate-y-1/2" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm shadow-lg shadow-violet-900/30 transition duration-150 disabled:opacity-50">
                {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Verifying Credentials...</span></> : <><span>Continue to Email Verification</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-300">
                  <ShieldCheck className="w-7 h-7" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider text-center">Email verification code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="mt-2 w-full bg-charcoal-950 border border-charcoal-800 rounded-lg px-4 py-4 text-center text-2xl tracking-[0.5em] font-bold text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                />
                <p className="mt-2 text-[11px] text-slate-500 text-center">The code expires in five minutes and can only be used once.</p>
              </div>
              <button type="submit" disabled={loading || otp.length !== 6} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm shadow-lg shadow-violet-900/30 transition disabled:opacity-50">
                {loading ? 'Verifying Code...' : <>Verify and Sign In <ArrowRight className="w-4 h-4" /></>}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={startOver} className="text-slate-400 hover:text-white">Use another account</button>
                <button type="button" onClick={handleResend} disabled={resendCountdown > 0 || resending} className="flex items-center gap-1.5 text-violet-300 hover:text-violet-200 disabled:text-slate-600">
                  <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

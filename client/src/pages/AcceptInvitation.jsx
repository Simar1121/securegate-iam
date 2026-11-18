import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/authService';
import { useToast } from '../context/ToastContext';

export const AcceptInvitation = () => {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const invitationToken = params.get('token') || '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!invitationToken) {
      toast.error('This invitation link is missing or invalid.');
      return;
    }
    if (password !== confirmPassword) {
      toast.warning('Passwords do not match.');
      return;
    }
    try {
      setLoading(true);
      const result = await authService.acceptInvitation({ token: invitationToken, password, confirmPassword });
      toast.success(result.message || 'Invitation accepted. You can now sign in.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to accept this invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-violet-900/40"><ShieldCheck className="w-6 h-6" /></div>
          <div className="text-left"><span className="font-extrabold text-2xl tracking-wider text-white">SECURE<span className="text-violet-400">GATE</span></span><span className="block text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Employee onboarding</span></div>
        </div>
        <h2 className="mt-6 text-xl font-bold text-white">Accept your invitation</h2>
        <p className="mt-1 text-xs text-slate-400">Verify your email and create your SecureGate password.</p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-charcoal-900/90 border border-charcoal-800 backdrop-blur-xl py-8 px-6 sm:px-8 shadow-2xl rounded-2xl">
          {!invitationToken ? (
            <div className="text-center text-sm text-slate-300">The invitation token is missing. Request a new invitation from your organization administrator.</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Create password</label>
                <div className="mt-1.5 relative"><Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Create a strong password" className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-500 hover:text-slate-300 absolute right-3.5 top-1/2 -translate-y-1/2" aria-label="Toggle password visibility">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Confirm password</label><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required autoComplete="new-password" placeholder="Re-enter your password" className="mt-1.5 w-full bg-charcoal-950 border border-charcoal-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition" /></div>
              <p className="text-[11px] text-slate-500">Your password must meet the organization's password complexity policy. The invitation link can only be used once.</p>
              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm shadow-lg shadow-violet-900/30 transition disabled:opacity-50">{loading ? 'Activating Account...' : 'Verify Email and Set Password'}</button>
            </form>
          )}
          <div className="mt-5 text-center text-xs text-slate-500"><Link to="/login" className="text-violet-300 hover:text-violet-200">Return to sign in</Link></div>
        </div>
      </div>
    </div>
  );
};

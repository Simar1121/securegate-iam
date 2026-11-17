import React, { useState } from 'react';
import { Lock, ShieldCheck, User, Mail, Eye, EyeOff, Building2, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export const OrganizationSetup = ({ onComplete }) => {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const update = (event) => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await api.post('/setup/initialize', form);
      setSuccess(true);
      window.setTimeout(() => onComplete?.(), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Setup could not be completed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-navy-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
      <section className="w-full max-w-xl relative z-10">
        <header className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-violet-900/40"><Lock className="w-7 h-7" /></div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-wide text-white">SECURE<span className="text-violet-400">GATE</span></h1>
          <p className="text-xs tracking-[.2em] uppercase text-slate-400 mt-1">Identity & Access Management</p>
        </header>
        <div className="bg-charcoal-900/95 border border-charcoal-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          {success ? (
            <div className="text-center py-8"><CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" /><h2 className="text-xl font-bold text-white mt-4">Organization initialized</h2><p className="text-sm text-slate-400 mt-2">Your Super Admin account is ready. Redirecting you to sign in…</p></div>
          ) : <>
            <div className="flex items-center gap-3 mb-2"><ShieldCheck className="w-6 h-6 text-violet-400"/><h2 className="text-xl font-bold text-white">Create your first Super Admin</h2></div>
            <p className="text-sm text-slate-400 mb-6">This one-time setup creates the system roles and permissions for your organization. No employee accounts are preloaded.</p>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-slate-300">FIRST NAME<input name="firstName" value={form.firstName} onChange={update} required maxLength={50} autoComplete="given-name" className="mt-1.5 w-full bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" placeholder="First name" /></label>
                <label className="text-xs font-semibold text-slate-300">LAST NAME<input name="lastName" value={form.lastName} onChange={update} required maxLength={50} autoComplete="family-name" className="mt-1.5 w-full bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" placeholder="Last name" /></label>
              </div>
              <label className="block text-xs font-semibold text-slate-300">ORGANIZATION EMAIL<div className="relative mt-1.5"><Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500"/><input type="email" name="email" value={form.email} onChange={update} required autoComplete="email" className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" placeholder="admin@yourcompany.com" /></div></label>
              <label className="block text-xs font-semibold text-slate-300">PASSWORD<div className="relative mt-1.5"><input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={update} required minLength={8} maxLength={128} autoComplete="new-password" className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 pr-11 py-2.5 text-sm text-white outline-none focus:border-violet-500" placeholder="Create a strong password"/><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-2.5 text-slate-500">{showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button></div></label>
              <label className="block text-xs font-semibold text-slate-300">CONFIRM PASSWORD<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} required autoComplete="new-password" className="mt-1.5 w-full bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" placeholder="Re-enter your password" /></label>
              <p className="text-xs text-slate-500">Use at least 8 characters, including uppercase, lowercase, a number and a special character.</p>
              {error && <div role="alert" className="rounded-lg border border-red-900/70 bg-red-950/40 text-red-300 text-sm p-3">{error}</div>}
              <button disabled={loading} className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm py-3 transition">{loading ? 'Initializing organization…' : 'Create Super Admin & Initialize'}</button>
            </form>
            <div className="mt-5 flex items-start gap-2 text-xs text-slate-500"><Building2 className="w-4 h-4 shrink-0 mt-0.5"/><span>One-time setup. After initialization, public registration is disabled and employee accounts must be provisioned by authorized administrators.</span></div>
          </>}
        </div>
      </section>
    </main>
  );
};

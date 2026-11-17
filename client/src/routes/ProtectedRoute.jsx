import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const ProtectedRoute = ({ children, requiredPermission, allowedRoles }) => {
  const { user, token, loading, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
        <p className="mt-4 text-xs font-mono text-slate-400">Authenticating SecureGate session...</p>
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Suspended account screen
  if (user.status === 'Suspended') {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-charcoal-900 border border-amber-500/30 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400 mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Account Suspended</h2>
          <p className="mt-2 text-sm text-slate-300">
            Your employee account has been temporarily suspended by an IAM Administrator.
          </p>
          <div className="mt-6">
            <Link
              to="/login"
              className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-slate-300 rounded-lg text-sm font-medium transition inline-block"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Permission authorization check
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-white">403 — Access Denied</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-md leading-relaxed">
          Your role (<span className="text-violet-400 font-semibold">{user.role?.name}</span>) does not possess the required privilege <code className="px-1.5 py-0.5 rounded bg-charcoal-800 text-rose-300 font-mono text-xs">[{requiredPermission}]</code>.
        </p>
        <Link
          to="/profile"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-sm font-medium text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Profile
        </Link>
      </div>
    );
  }

  // Role authorization check
  if (allowedRoles && !hasRole(...allowedRoles)) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-white">Role Restricted Area</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-md">
          This section is restricted to: {allowedRoles.join(', ')}.
        </p>
        <Link
          to="/profile"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-sm font-medium text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Profile
        </Link>
      </div>
    );
  }

  return children;
};

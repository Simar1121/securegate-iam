import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const NotFound = () => {
  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold text-white">404</h1>
      <h2 className="mt-2 text-xl font-bold text-slate-200">Page Not Found</h2>
      <p className="mt-2 text-sm text-slate-400 max-w-sm">
        The requested IAM resource or console route does not exist.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white shadow-lg transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Safety
      </Link>
    </div>
  );
};

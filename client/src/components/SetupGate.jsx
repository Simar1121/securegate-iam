import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { OrganizationSetup } from '../pages/OrganizationSetup';

export const SetupGate = ({ children }) => {
  const [state, setState] = useState({ loading: true, setupRequired: false, setupInProgress: false, error: '' });

  useEffect(() => {
    let active = true;
    api.get('/setup/status')
      .then(({ data }) => { if (active) setState({ loading: false, setupRequired: !!data.setupRequired, setupInProgress: !!data.setupInProgress, error: '' }); })
      .catch(() => { if (active) setState({ loading: false, setupRequired: false, setupInProgress: false, error: 'Unable to contact SecureGate. Confirm that the backend is running.' }); });
    return () => { active = false; };
  }, []);

  if (state.loading) return <div className="min-h-screen bg-navy-950 flex items-center justify-center text-slate-300">Loading SecureGate…</div>;
  if (state.setupRequired) return <OrganizationSetup onComplete={() => window.location.reload()} />;
  if (state.setupInProgress) return <div className="min-h-screen bg-navy-950 flex items-center justify-center text-amber-300">Organization setup is already in progress. Contact your system operator.</div>;
  if (state.error) return <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6 text-red-300">{state.error}</div>;
  return children;
};

import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LayoutDashboard, Users, Shield, Key, FileText, UserCheck, RefreshCw, Lock, Fingerprint } from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const [resetting] = React.useState(false);
  const canViewDashboard = hasPermission('users:read');
  const canViewUsers = hasPermission('users:read');
  const canViewRoles = hasPermission('roles:manage') || hasPermission('users:read');
  const canViewPermissions = hasPermission('permissions:manage') || hasPermission('roles:manage');
  const canViewAudit = hasPermission('audit:read');
  const canViewAbac = user?.role?.name === 'Super Admin';

  const navItems = [
    { label: 'Admin Console', items: [
      canViewDashboard && { to: '/dashboard', label: 'Overview & Metrics', icon: LayoutDashboard },
      canViewUsers && { to: '/users', label: 'Employee Directory', icon: Users },
      canViewRoles && { to: '/roles', label: 'Roles & RBAC', icon: Shield },
      canViewPermissions && { to: '/permissions', label: 'Permission Matrix', icon: Key },
      canViewAbac && { to: '/abac-policies', label: 'ABAC Policies', icon: Fingerprint },
      canViewAudit && { to: '/audit-logs', label: 'Security Audit Logs', icon: FileText },
    ].filter(Boolean) },
    { label: 'Employee Self-Service', items: [{ to: '/profile', label: 'My Identity & Access', icon: UserCheck }] },
  ];

  const handleResetData = () => toast.info('Database seeding is restricted to development CLI commands (npm run seed) for security.');

  return <>
    {isOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />}
    <aside className={`fixed top-0 bottom-0 left-0 w-64 bg-charcoal-950 border-r border-charcoal-800 flex flex-col z-50 transition-transform duration-200 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="h-16 px-6 border-b border-charcoal-800 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-900/30 group-hover:scale-105 transition"><Lock className="w-5 h-5 text-white" /></div>
          <div><span className="font-extrabold text-base tracking-wider text-white">SECURE<span className="text-violet-400">GATE</span></span><span className="block text-[10px] font-semibold tracking-widest text-slate-500 uppercase">IAM Engine</span></div>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navItems.map((section, idx) => <div key={idx}>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">{section.label}</div>
          <nav className="space-y-1">{section.items.map(item => {
            const Icon = item.icon;
            return <NavLink key={item.to} to={item.to} onClick={onClose} className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-violet-600/15 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-charcoal-900'}`}>
              <Icon className="w-4 h-4 shrink-0" /><span>{item.label}</span>
            </NavLink>;
          })}</nav>
        </div>)}
      </div>
      <div className="p-3 border-t border-charcoal-800 space-y-2 bg-charcoal-950">
        {hasPermission('settings:manage') && <button onClick={handleResetData} disabled={resetting} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-charcoal-900 border border-charcoal-800 text-slate-400 hover:text-white hover:border-violet-500/40 hover:bg-charcoal-850 transition" title="Database seeding is available through developer CLI"><RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin text-violet-400' : ''}`} />Reset Demo Dataset</button>}
        <div className="px-3 py-2 rounded-lg bg-charcoal-900/60 border border-charcoal-850 text-[11px] text-slate-400">
          <div className="flex items-center justify-between"><span className="text-slate-500">IAM Role:</span><span className="font-semibold text-slate-300 truncate max-w-[110px]">{user?.role?.name || 'User'}</span></div>
          <div className="flex items-center justify-between mt-1"><span className="text-slate-500">Employee ID:</span><span className="font-mono text-slate-300">{user?.employeeId}</span></div>
        </div>
      </div>
    </aside>
  </>;
};

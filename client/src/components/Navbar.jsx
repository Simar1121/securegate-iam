import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  User,
  LogOut,
  ChevronDown,
  Activity,
  Menu,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { getInitials, getRoleBadgeClass } from '../utils/helpers';

export const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-navy-900/90 backdrop-blur-md border-b border-charcoal-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-charcoal-800 transition"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            IAM Directory Synchronized
          </span>
          <span className="text-xs text-slate-500 hidden md:inline">
            Enterprise Realm: <strong className="text-slate-300 font-mono">securegate-corp.internal</strong>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* User profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-charcoal-850 border border-transparent hover:border-charcoal-800 transition text-left"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-inner">
              {getInitials(user?.firstName, user?.lastName)}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-slate-200 leading-tight">
                {user?.fullName || `${user?.firstName} ${user?.lastName}`}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {user?.role?.name || 'Employee'}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-charcoal-900 border border-charcoal-800 rounded-xl shadow-2xl py-2 z-50">
              <div className="px-4 py-3 border-b border-charcoal-800">
                <p className="text-xs text-slate-400">Signed in as</p>
                <p className="text-sm font-semibold text-white truncate mt-0.5">{user?.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getRoleBadgeClass(user?.role?.name)}`}>
                    {user?.role?.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {user?.employeeId}</span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-charcoal-800 transition"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  My Identity & Profile
                </Link>
                <Link
                  to="/profile?tab=security"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-charcoal-800 transition"
                >
                  <KeyRound className="w-4 h-4 text-slate-400" />
                  Change Password
                </Link>
              </div>

              <div className="border-t border-charcoal-800 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-400 hover:bg-rose-950/30 transition text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

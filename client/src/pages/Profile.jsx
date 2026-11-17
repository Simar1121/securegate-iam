import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  User,
  KeyRound,
  Shield,
  Phone,
  MapPin,
  FileText,
  Building,
  Briefcase,
  Mail,
  CheckCircle2,
  Lock,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  getInitials,
  getStatusBadgeClass,
  getRoleBadgeClass,
  formatDate,
} from '../utils/helpers';

export const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const toast = useToast();
  const location = useLocation();

  // Active tab state
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'permissions' | 'security'

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'security') setActiveTab('security');
    if (tabParam === 'permissions') setActiveTab('permissions');
  }, [location.search]);

  // Profile Edit State
  const [personalData, setPersonalData] = useState({
    phone: user?.phone || '',
    location: user?.location || 'Headquarters',
    bio: user?.bio || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPass, setChangingPass] = useState(false);

  useEffect(() => {
    if (user) {
      setPersonalData({
        phone: user.phone || '',
        location: user.location || 'Headquarters',
        bio: user.bio || '',
      });
    }
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      await updateProfile(personalData);
      toast.success('Your profile details have been updated.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.warning('Please enter your current password and new password.');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.warning('New password must be at least 8 characters long and contain uppercase, lowercase, number, and special character.');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.warning('New password and confirmation do not match.');
      return;
    }

    try {
      setChangingPass(true);
      const res = await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success(res.message || 'Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setChangingPass(false);
    }
  };

  const isSuperAdmin = user?.role?.name === 'Super Admin';
  const assignedPermissions = user?.role?.permissions || [];

  return (
    <div className="space-y-6">
      {/* Employee Identity Card Header */}
      <div className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-extrabold text-xl text-white shadow-xl shadow-violet-900/40">
              {getInitials(user?.firstName, user?.lastName)}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  {user?.fullName || `${user?.firstName} ${user?.lastName}`}
                </h1>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${getStatusBadgeClass(user?.status)}`}>
                  {user?.status}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {user?.email}
                </span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-slate-300">
                  ID: <strong className="text-violet-300">{user?.employeeId}</strong>
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  {user?.department}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold border ${getRoleBadgeClass(user?.role?.name)}`}>
              Role: {user?.role?.name}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8 pt-2 border-t border-charcoal-800 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'profile'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-charcoal-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Identity & Personal Details</span>
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'permissions'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-charcoal-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Assigned Permissions ({isSuperAdmin ? 'All' : assignedPermissions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'security'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-charcoal-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Password & Security</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Readonly Organization Info */}
          <div className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono text-xs">
              Corporate Directory Profile
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">Job Designation</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{user?.jobTitle}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Assigned Department</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{user?.department}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Corporate Email</span>
                <span className="font-mono text-slate-300 mt-0.5 block">{user?.email}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Employee Identification Number</span>
                <span className="font-mono text-violet-300 font-bold mt-0.5 block">{user?.employeeId}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Account Status</span>
                <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${getStatusBadgeClass(user?.status)}`}>
                  {user?.status}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Last Authenticated Session</span>
                <span className="font-mono text-slate-300 mt-0.5 block">{formatDate(user?.lastLogin)}</span>
              </div>
            </div>
          </div>

          {/* Editable Personal Details */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-white">Update Permitted Personal Details</h2>
              <p className="text-xs text-slate-400">
                You may customize your contact phone, desk location, and team biography.
              </p>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Contact Phone
                  </label>
                  <div className="mt-1.5 relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={personalData.phone}
                      onChange={(e) => setPersonalData({ ...personalData, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Location / Office
                  </label>
                  <div className="mt-1.5 relative">
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={personalData.location}
                      onChange={(e) => setPersonalData({ ...personalData, location: e.target.value })}
                      placeholder="e.g. San Francisco, CA / Remote"
                      className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Biography / Role Summary
                </label>
                <textarea
                  rows="3"
                  value={personalData.bio}
                  onChange={(e) => setPersonalData({ ...personalData, bio: e.target.value })}
                  placeholder="Share a short summary of your team responsibilities and expertise..."
                  className="w-full mt-1.5 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg transition"
                >
                  {savingProfile ? 'Saving Changes...' : 'Save Personal Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Assigned Permissions */}
      {activeTab === 'permissions' && (
        <div className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" />
                Active Authorization Privileges
              </h2>
              <p className="text-xs text-slate-400">
                Capabilities authorized through your assigned role (<span className="text-violet-300 font-semibold">{user?.role?.name}</span>)
              </p>
            </div>

            <span className="text-xs font-mono px-3 py-1 rounded-full bg-charcoal-950 border border-charcoal-800 text-slate-300">
              {isSuperAdmin ? 'Full Bypass Mode' : `${assignedPermissions.length} Active Grants`}
            </span>
          </div>

          {isSuperAdmin ? (
            <div className="p-5 rounded-xl bg-violet-950/20 border border-violet-500/30 text-xs text-violet-200">
              <div className="flex items-center gap-2 font-bold text-violet-300 text-sm">
                <Sparkles className="w-4 h-4" />
                Global Super Administrator Authority
              </div>
              <p className="mt-1 text-slate-300">
                As a Super Admin, your identity is granted full system oversight, permission governance, directory CRUD operations, and immutable audit inspection across all organization units.
              </p>
            </div>
          ) : assignedPermissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {assignedPermissions.map((perm) => (
                <div
                  key={perm._id || perm.code}
                  className="p-3.5 rounded-xl bg-charcoal-950 border border-charcoal-800 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-200">{perm.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed pl-6">
                      {perm.description}
                    </p>
                  </div>
                  <code className="text-[10px] font-mono px-2 py-0.5 rounded bg-charcoal-900 border border-charcoal-800 text-violet-300 shrink-0">
                    {perm.code}
                  </code>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 bg-charcoal-950 rounded-xl border border-charcoal-850">
              Your account currently holds standard Employee self-service permissions (Profile Management & Password Rotation).
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Password & Security */}
      {activeTab === 'security' && (
        <div className="max-w-xl p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-violet-400" />
              Update Corporate Password
            </h2>
            <p className="text-xs text-slate-400">
              Rotate your credentials. Password change events are recorded in the security audit trail.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Current Password *
              </label>
              <div className="mt-1.5 relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                New Password *
              </label>
              <div className="mt-1.5 relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Min 8 chars (upper, lower, number, special char)"
                  required
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Confirm New Password *
              </label>
              <div className="mt-1.5 relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Re-enter new password"
                  required
                  className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={changingPass}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg transition"
              >
                {changingPass ? 'Changing Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

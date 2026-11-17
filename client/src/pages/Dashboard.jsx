import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import { useToast } from '../context/ToastContext';
import { StatCard } from '../components/StatCard';
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Clock,
  ShieldAlert,
  PlusCircle,
  FileText,
  Key,
} from 'lucide-react';
import { formatRelativeTime, formatDate, getAuditActionBadgeClass } from '../utils/helpers';

export const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await dashboardService.getStats();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      toast.error('Failed to retrieve dashboard statistics from MongoDB.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-charcoal-900 rounded-lg w-64 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-charcoal-900 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalEmployees: 0,
    activeEmployees: 0,
    suspendedEmployees: 0,
    totalRoles: 0,
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            IAM Control Plane
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time identity lifecycle, active authorization state, and security events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-900 border border-charcoal-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-violet-500/40 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-violet-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Live Data'}
          </button>

          <Link
            to="/users"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg shadow-violet-900/30 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Manage Users</span>
          </Link>
        </div>
      </div>

      {/* 4 Core Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Employees"
          value={metrics.totalEmployees}
          subtitle="Provisioned identity records"
          icon={Users}
          color="violet"
        />
        <StatCard
          title="Active Employees"
          value={metrics.activeEmployees}
          subtitle="Verified active directory members"
          icon={UserCheck}
          color="emerald"
        />
        <StatCard
          title="Suspended Employees"
          value={metrics.suspendedEmployees}
          subtitle="Access temporarily locked"
          icon={UserX}
          color="amber"
        />
        <StatCard
          title="Total Access Roles"
          value={metrics.totalRoles}
          subtitle="Configured RBAC profiles"
          icon={Shield}
          color="cyan"
        />
      </div>

      {/* Organizational Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Distribution */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Employee Distribution by Department</h2>
              <p className="text-xs text-slate-400">Headcount allocation across business units</p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {data?.departments?.length || 0} Departments
            </span>
          </div>

          <div className="space-y-3.5 mt-5">
            {data?.departments?.map((dept) => {
              const percentage = metrics.totalEmployees > 0
                ? Math.round((dept.count / metrics.totalEmployees) * 100)
                : 0;

              return (
                <div key={dept.name}>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                    <span>{dept.name}</span>
                    <span className="font-mono text-slate-400">
                      {dept.count} {dept.count === 1 ? 'employee' : 'employees'} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-charcoal-950 rounded-full overflow-hidden border border-charcoal-800">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Roles Distribution */}
        <div className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-white">RBAC Role Allocations</h2>
              <Link to="/roles" className="text-xs text-violet-400 hover:underline inline-flex items-center gap-1">
                Manage <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-xs text-slate-400 mb-4">Personnel mapping per security tier</p>

            <div className="space-y-2.5">
              {data?.roles?.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-charcoal-950 border border-charcoal-800"
                >
                  <span className="text-xs font-semibold text-slate-200">{r.name}</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                    {r.count} assigned
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-charcoal-800">
            <Link
              to="/permissions"
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-charcoal-800 hover:bg-charcoal-750 text-xs font-semibold text-slate-200 transition"
            >
              <Key className="w-3.5 h-3.5 text-violet-400" />
              <span>Inspect Role Permissions Matrix</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Activity Streams (Recent Logins & Recent Admin Activities) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Authentication Events */}
        <div className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                Recent Login Activities
              </h2>
              <p className="text-xs text-slate-400">Authentication attempts & access tokens</p>
            </div>
            <Link to="/audit-logs" className="text-xs text-violet-400 hover:underline">
              View All
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-charcoal-800 text-slate-400 uppercase tracking-wider font-mono">
                  <th className="pb-2">Account</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">IP / Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-800/60">
                {data?.recentLogins?.length > 0 ? (
                  data.recentLogins.map((log) => (
                    <tr key={log._id} className="hover:bg-charcoal-850/50 transition">
                      <td className="py-2.5">
                        <div className="font-semibold text-slate-200">{log.actorEmail}</div>
                        <div className="text-[11px] text-slate-500">{log.action}</div>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-[11px] text-slate-400">
                        <div>{formatRelativeTime(log.createdAt)}</div>
                        <div className="text-slate-500 text-[10px]">{log.ipAddress}</div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="py-6 text-center text-slate-500">
                      No recent authentication events recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Administrative Events */}
        <div className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Recent Administrative Activities
              </h2>
              <p className="text-xs text-slate-400">Governance, RBAC modifications, and updates</p>
            </div>
            <Link to="/audit-logs" className="text-xs text-violet-400 hover:underline">
              Audit Trail
            </Link>
          </div>

          <div className="space-y-3">
            {data?.recentAdminActivities?.length > 0 ? (
              data.recentAdminActivities.map((log) => (
                <div
                  key={log._id}
                  className="p-3 rounded-xl bg-charcoal-950 border border-charcoal-800 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${getAuditActionBadgeClass(log.action, log.status)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {log.targetName || log.targetType}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      By <span className="text-slate-300 font-medium">{log.actorName}</span> ({log.actorRole})
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No administrative changes logged yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

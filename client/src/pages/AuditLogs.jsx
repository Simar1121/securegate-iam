import React, { useState, useEffect, useCallback } from 'react';
import { auditService } from '../services/auditService';
import { useToast } from '../context/ToastContext';
import {
  FileText,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  X,
  Code,
  Calendar,
} from 'lucide-react';
import {
  formatDate,
  formatRelativeTime,
  getAuditActionBadgeClass,
} from '../utils/helpers';

export const AuditLogs = () => {
  const toast = useToast();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Payload viewer modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search,
        action: selectedAction !== 'All' ? selectedAction : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
      };

      const res = await auditService.getLogs(params);
      if (res.success) {
        setLogs(res.data);
        setPagination(res.pagination);
      }
    } catch (err) {
      toast.error('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, selectedAction, selectedStatus, selectedCategory, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Security Audit Trail
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Immutable chronicle of all authentication events, privilege assignments, and directory changes.
          </p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="p-4 rounded-xl bg-charcoal-900 border border-charcoal-800 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            placeholder="Search by actor email, name, action, or IP address..."
            className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Action Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-charcoal-950 border border-charcoal-800 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
          >
            <option value="All">All Actions</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="USER_CREATED">USER_CREATED</option>
            <option value="USER_UPDATED">USER_UPDATED</option>
            <option value="USER_DELETED">USER_DELETED</option>
            <option value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</option>
            <option value="ROLE_CREATED">ROLE_CREATED</option>
            <option value="ROLE_UPDATED">ROLE_UPDATED</option>
            <option value="ROLE_DELETED">ROLE_DELETED</option>
            <option value="PASSWORD_CHANGE">PASSWORD_CHANGE</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-charcoal-950 border border-charcoal-800 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
          >
            <option value="All">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-charcoal-950 border border-charcoal-800 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
          >
            <option value="All">All Categories</option>
            <option value="AUTH">AUTH</option>
            <option value="USER_MGMT">USER_MGMT</option>
            <option value="RBAC">RBAC</option>
            <option value="SECURITY">SECURITY</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-charcoal-950 border-b border-charcoal-800 text-slate-400 font-mono uppercase tracking-wider">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Resource</th>
                <th className="py-3.5 px-4">Result</th>
                <th className="py-3.5 px-4">Origin IP</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 font-sans">
                    <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto mb-2" />
                    Querying MongoDB security logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 font-sans">
                    No audit records matching query criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-charcoal-850/50 transition">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      <div>{formatDate(log.createdAt)}</div>
                      <div className="text-[10px] text-slate-500">{formatRelativeTime(log.createdAt)}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200 font-sans">{log.actorName}</div>
                      <div className="text-slate-400 text-[10px] truncate max-w-[150px]">{log.actorEmail}</div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-charcoal-950 text-slate-400 border border-charcoal-800">
                        {log.actorRole}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getAuditActionBadgeClass(log.action, log.status)}`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <div className="text-slate-300 font-medium">{log.targetName || '—'}</div>
                      <div className="text-[10px] font-mono text-slate-500">{log.targetType}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      <div>{log.ipAddress}</div>
                      <div className="text-[9px] text-slate-500 truncate max-w-[120px]" title={log.userAgent}>
                        {log.userAgent}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded-lg bg-charcoal-950 hover:bg-charcoal-800 border border-charcoal-800 text-slate-300 hover:text-white transition font-sans text-xs inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-violet-400" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="px-4 py-3 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Total <span className="font-semibold text-slate-200">{pagination.total}</span> audit records logged
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg bg-charcoal-900 border border-charcoal-800 text-slate-300 disabled:opacity-40 hover:bg-charcoal-850"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg bg-charcoal-900 border border-charcoal-800 text-slate-300 disabled:opacity-40 hover:bg-charcoal-850"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Audit Detail Payload Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          <div className="relative w-full max-w-xl bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-charcoal-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-violet-400" />
                <h2 className="text-base font-bold text-white font-mono">
                  Event: {selectedLog.action}
                </h2>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Event Metadata Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-charcoal-950 border border-charcoal-850">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Actor</span>
                  <span className="font-semibold text-slate-200 mt-1 block">{selectedLog.actorName}</span>
                  <span className="text-slate-400 text-[11px] block">{selectedLog.actorEmail}</span>
                  <span className="text-[10px] text-violet-300 mt-1 block font-mono">Role: {selectedLog.actorRole}</span>
                </div>

                <div className="p-3 rounded-xl bg-charcoal-950 border border-charcoal-850">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Target</span>
                  <span className="font-semibold text-slate-200 mt-1 block">{selectedLog.targetName || 'None'}</span>
                  <span className="text-slate-400 text-[11px] block">Type: {selectedLog.targetType}</span>
                  <span className="text-[10px] text-slate-500 mt-1 block font-mono">ID: {selectedLog.targetId || 'N/A'}</span>
                </div>
              </div>

              {/* Timestamp & Environment */}
              <div className="p-3 rounded-xl bg-charcoal-950 border border-charcoal-850 text-xs space-y-1.5 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ISO Timestamp:</span>
                  <span className="text-slate-300">{new Date(selectedLog.createdAt).toISOString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Origin IP:</span>
                  <span className="text-slate-300">{selectedLog.ipAddress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Result:</span>
                  <span className={selectedLog.status === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {selectedLog.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">User-Agent:</span>
                  <span className="text-slate-400 text-[10px] break-all block mt-0.5">{selectedLog.userAgent}</span>
                </div>
              </div>

              {/* JSON Payload Details */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono block mb-1.5">
                  Audit Metadata & Diff Payload
                </span>
                <pre className="p-3.5 rounded-xl bg-charcoal-950 border border-charcoal-800 text-violet-300 text-[11px] font-mono overflow-x-auto leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-charcoal-800 bg-charcoal-950 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-charcoal-800 text-xs font-semibold text-slate-200 hover:text-white"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

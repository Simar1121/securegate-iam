import React, { useState, useEffect, useCallback } from 'react';
import { permissionService } from '../services/permissionService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Key,
  Shield,
  Check,
  X,
  Plus,
  Layers,
  Lock,
  Grid,
  List,
} from 'lucide-react';

export const Permissions = () => {
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'catalog'
  const [matrixData, setMatrixData] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Custom permission modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    category: 'System Administration',
  });
  const [submitting, setSubmitting] = useState(false);

  const canManagePermissions = hasPermission('permissions:manage');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [matrixRes, listRes] = await Promise.all([
        permissionService.getPermissionMatrix(),
        permissionService.getPermissions(),
      ]);

      if (matrixRes.success) {
        setMatrixData(matrixRes.data);
      }
      if (listRes.success) {
        setPermissions(listRes.data);
        setGroupedPermissions(listRes.grouped || {});
      }
    } catch (err) {
      toast.error('Failed to load permission schemas.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.description) {
      toast.warning('Please enter name, code, and description.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await permissionService.createPermission(formData);
      toast.success(res.message || 'Permission created successfully.');
      setIsModalOpen(false);
      setFormData({ name: '', code: '', description: '', category: 'System Administration' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating permission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Permission Governance Matrix
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Granular access privileges, capability schemas, and organizational RBAC mapping.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Selector */}
          <div className="flex p-1 bg-charcoal-900 border border-charcoal-800 rounded-lg">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'matrix'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>RBAC Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'catalog'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Permission Catalog</span>
            </button>
          </div>

          {canManagePermissions && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg shadow-violet-900/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Permission</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 rounded-2xl bg-charcoal-900 border border-charcoal-800">
          <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto mb-2" />
          Loading permission graph...
        </div>
      ) : activeTab === 'matrix' ? (
        /* Matrix View */
        <div className="rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-charcoal-950 border-b border-charcoal-800 text-slate-400 font-mono uppercase tracking-wider">
                  <th className="py-3.5 px-4 sticky left-0 bg-charcoal-950 z-10 min-w-[240px]">
                    System Capability / Permission
                  </th>
                  <th className="py-3.5 px-4 min-w-[120px]">Code</th>
                  {matrixData?.roles?.map((role) => (
                    <th key={role._id} className="py-3.5 px-4 text-center min-w-[130px]">
                      <div className="font-bold text-slate-200">{role.name}</div>
                      <div className="text-[10px] text-slate-500 lowercase font-mono">
                        {role.isCustom ? 'custom' : 'default'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-800/60">
                {matrixData?.permissions?.map((perm) => (
                  <tr key={perm._id} className="hover:bg-charcoal-850/50 transition">
                    <td className="py-3 px-4 sticky left-0 bg-charcoal-900/90 backdrop-blur-md z-10">
                      <div className="font-semibold text-slate-200">{perm.name}</div>
                      <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                        {perm.description}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-violet-300">
                      {perm.code}
                    </td>

                    {matrixData?.matrix?.map((m) => {
                      const granted = m.permissions[perm.code];
                      return (
                        <td key={m.roleId} className="py-3 px-4 text-center">
                          {granted ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-charcoal-950 border border-charcoal-800 text-slate-600">
                              <span className="w-1.5 h-0.5 bg-slate-600 rounded-full" />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Catalog View Grouped by Category */
        <div className="space-y-6">
          {Object.entries(groupedPermissions).map(([category, perms]) => (
            <div
              key={category}
              className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-violet-400" />
                <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                  {category}
                </h2>
                <span className="text-xs text-slate-500 font-mono">({perms.length} privileges)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {perms.map((p) => (
                  <div
                    key={p._id}
                    className="p-3.5 rounded-xl bg-charcoal-950 border border-charcoal-800 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{p.name}</span>
                        {p.isSystem && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
                            System
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {p.description}
                      </p>
                    </div>

                    <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-charcoal-900 border border-charcoal-800 text-violet-300 shrink-0">
                      {p.code}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Custom Permission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-charcoal-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-violet-400" />
                Register Custom Permission
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePermission} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Permission Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Export Compliance Reports"
                  required
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Permission Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().trim() })}
                  placeholder="e.g. reports:export"
                  required
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs font-mono text-violet-300 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="User Management">User Management</option>
                  <option value="Role Management">Role Management</option>
                  <option value="Audit & Compliance">Audit & Compliance</option>
                  <option value="System Administration">System Administration</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  placeholder="Describe granted access scope..."
                  required
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-charcoal-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-charcoal-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg transition"
                >
                  {submitting ? 'Registering...' : 'Add Permission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

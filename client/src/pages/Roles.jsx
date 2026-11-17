import React, { useState, useEffect, useCallback } from 'react';
import { roleService } from '../services/roleService';
import { permissionService } from '../services/permissionService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
  Shield,
  Plus,
  Key,
  Users,
  Check,
  Edit2,
  Trash2,
  Lock,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { getRoleBadgeClass } from '../utils/helpers';

export const Roles = () => {
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [],
    status: 'Active',
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canManageRoles = hasPermission('roles:manage');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        roleService.getRoles(),
        permissionService.getPermissions(),
      ]);

      if (rolesRes.success) {
        setRoles(rolesRes.data);
      }
      if (permsRes.success) {
        setPermissions(permsRes.data);
        setGroupedPermissions(permsRes.grouped || {});
      }
    } catch (err) {
      toast.error('Failed to load RBAC roles and permissions.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      permissions: [],
      status: 'Active',
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions.map((p) => p._id || p),
      status: role.status || 'Active',
    });
    setIsEditModalOpen(true);
  };

  const togglePermission = (permId) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permId);
      const updated = exists
        ? prev.permissions.filter((id) => id !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: updated };
    });
  };

  const toggleCategoryPermissions = (categoryPerms) => {
    const catIds = categoryPerms.map((p) => p._id);
    const allSelected = catIds.every((id) => formData.permissions.includes(id));

    setFormData((prev) => {
      let updated;
      if (allSelected) {
        updated = prev.permissions.filter((id) => !catIds.includes(id));
      } else {
        const set = new Set([...prev.permissions, ...catIds]);
        updated = Array.from(set);
      }
      return { ...prev, permissions: updated };
    });
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.warning('Please enter a role name.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await roleService.createRole(formData);
      toast.success(res.message || 'Custom role created successfully.');
      setIsCreateModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create role.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await roleService.updateRole(selectedRole._id, formData);
      toast.success(res.message || 'Role permissions updated.');
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePrompt = (role) => {
    if (role.isDefault || ['Super Admin', 'IT Administrator', 'HR Manager', 'Employee'].includes(role.name)) {
      toast.warning(`System default role "${role.name}" cannot be deleted.`);
      return;
    }
    if (role.userCount > 0) {
      toast.warning(`Cannot delete role "${role.name}". It is currently assigned to ${role.userCount} employee(s).`);
      return;
    }
    setRoleToDelete(role);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;
    try {
      setActionLoading(true);
      await roleService.deleteRole(roleToDelete._id);
      toast.success(`Role "${roleToDelete.name}" was successfully removed.`);
      setDeleteModalOpen(false);
      setRoleToDelete(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Role-Based Access Control (RBAC)
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Define organizational roles, assign granular permissions, and govern least-privilege boundaries.
          </p>
        </div>

        {canManageRoles && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Role</span>
          </button>
        )}
      </div>

      {/* Roles Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-charcoal-900 rounded-2xl animate-pulse" />
          ))
        ) : (
          roles.map((role) => (
            <div
              key={role._id}
              className="p-6 rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl flex flex-col justify-between hover:border-charcoal-700 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">{role.name}</h2>
                      <span className="text-[10px] font-mono text-slate-400">
                        {role.isCustom ? 'Custom Role' : 'System Default'}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getRoleBadgeClass(role.name)}`}>
                    {role.status || 'Active'}
                  </span>
                </div>

                <p className="mt-3 text-xs text-slate-300 leading-relaxed min-h-[36px]">
                  {role.description || 'No description provided.'}
                </p>

                {/* Metrics */}
                <div className="mt-4 pt-3 border-t border-charcoal-800 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-charcoal-950 border border-charcoal-850">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                      Employees
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">{role.userCount || 0}</div>
                  </div>

                  <div className="p-2 rounded-lg bg-charcoal-950 border border-charcoal-850">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                      Permissions
                    </div>
                    <div className="text-sm font-bold text-violet-300 mt-0.5">
                      {role.name === 'Super Admin' ? 'All (Unrestricted)' : role.permissions?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Assigned Permission Tags preview */}
                <div className="mt-4 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    Assigned Privileges:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.name === 'Super Admin' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20">
                        * All System Permissions
                      </span>
                    ) : role.permissions?.length > 0 ? (
                      role.permissions.slice(0, 4).map((p) => (
                        <span
                          key={p._id || p.code}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-charcoal-950 text-slate-300 border border-charcoal-800"
                        >
                          {p.name || p.code}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No administrative permissions assigned</span>
                    )}
                    {role.permissions?.length > 4 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400">
                        +{role.permissions.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {canManageRoles && (
                <div className="mt-5 pt-4 border-t border-charcoal-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEditModal(role)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-xs font-semibold text-slate-200 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit Permissions</span>
                  </button>

                  {role.isCustom && (
                    <button
                      onClick={() => handleDeletePrompt(role)}
                      className="p-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-950/30 transition"
                      title="Delete Custom Role"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Custom Role Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-charcoal-800 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Define Custom IAM Role
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Compliance Auditor, DevOps Lead"
                  required
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  placeholder="Define role scope and responsibilities..."
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              {/* Permission Checkboxes Grouped by Category */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Select Granted Permissions ({formData.permissions.length} selected)
                  </label>
                </div>

                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category} className="p-3.5 rounded-xl bg-charcoal-950 border border-charcoal-800">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-bold text-violet-300 font-mono uppercase">{category}</span>
                        <button
                          type="button"
                          onClick={() => toggleCategoryPermissions(perms)}
                          className="text-[10px] text-slate-400 hover:text-white underline"
                        >
                          Toggle Category
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {perms.map((p) => {
                          const isSelected = formData.permissions.includes(p._id);
                          return (
                            <label
                              key={p._id}
                              onClick={() => togglePermission(p._id)}
                              className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition select-none ${
                                isSelected
                                  ? 'bg-violet-600/10 border-violet-500/40 text-slate-200'
                                  : 'bg-charcoal-900 border-charcoal-800 text-slate-400 hover:border-charcoal-700'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center mt-0.5 shrink-0 ${
                                  isSelected
                                    ? 'bg-violet-600 border-violet-600 text-white'
                                    : 'border-slate-600'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="text-xs">
                                <div className="font-semibold text-slate-200">{p.name}</div>
                                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{p.description}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-charcoal-800 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-charcoal-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg transition"
                >
                  {actionLoading ? 'Creating...' : 'Save & Publish Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-charcoal-800 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-violet-400" />
                Edit Role: {selectedRole?.name}
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Role Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={selectedRole?.name === 'Super Admin'}
                  required
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              {selectedRole?.name === 'Super Admin' ? (
                <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/30 text-xs text-violet-200">
                  <AlertCircle className="w-4 h-4 inline-block mr-1 text-violet-400" />
                  Super Admin role inherently holds unrestricted global administrative privileges.
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                      Granted Permissions ({formData.permissions.length} selected)
                    </label>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(groupedPermissions).map(([category, perms]) => (
                      <div key={category} className="p-3.5 rounded-xl bg-charcoal-950 border border-charcoal-800">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-bold text-violet-300 font-mono uppercase">{category}</span>
                          <button
                            type="button"
                            onClick={() => toggleCategoryPermissions(perms)}
                            className="text-[10px] text-slate-400 hover:text-white underline"
                          >
                            Toggle Category
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map((p) => {
                            const isSelected = formData.permissions.includes(p._id);
                            return (
                              <label
                                key={p._id}
                                onClick={() => togglePermission(p._id)}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition select-none ${
                                  isSelected
                                    ? 'bg-violet-600/10 border-violet-500/40 text-slate-200'
                                    : 'bg-charcoal-900 border-charcoal-800 text-slate-400 hover:border-charcoal-700'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center mt-0.5 shrink-0 ${
                                    isSelected
                                      ? 'bg-violet-600 border-violet-600 text-white'
                                      : 'border-slate-600'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="text-xs">
                                  <div className="font-semibold text-slate-200">{p.name}</div>
                                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{p.description}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-charcoal-800 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-charcoal-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg transition"
                >
                  {actionLoading ? 'Saving...' : 'Update Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setRoleToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={`Delete Role "${roleToDelete?.name}"?`}
        message={`Are you sure you want to permanently delete custom role "${roleToDelete?.name}"?`}
        confirmText="Delete Role"
        danger={true}
        loading={actionLoading}
      />
    </div>
  );
};

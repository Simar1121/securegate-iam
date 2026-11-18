import React, { useState, useEffect, useCallback } from 'react';
import { userService } from '../services/userService';
import { roleService } from '../services/roleService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
  Users as UsersIcon,
  Search,
  Plus,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  UserX,
  UserCheck,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
  Building,
  Briefcase,
  Mail,
  Lock,
} from 'lucide-react';
import {
  formatDate,
  formatRelativeTime,
  getInitials,
  getStatusBadgeClass,
  getRoleBadgeClass,
} from '../utils/helpers';

export const Users = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 1 });

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Confirmation Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    phone: '',
    location: 'Headquarters',
    password: '',
    status: 'Active',
  });

  const actorRoleName = currentUser?.role?.name;
  const canCreate = ['Super Admin', 'IT Administrator'].includes(actorRoleName);
  const assignableCreateRoles = roles.filter((role) => {
    if (role.name === 'Super Admin') return false;
    if (actorRoleName === 'Super Admin') return true;
    return ['Employee', 'Security Auditor'].includes(role.name);
  });
  const assignableEditRoles = selectedUser?.role?.name === 'Super Admin'
    ? roles.filter((role) => role.name === 'Super Admin')
    : roles.filter((role) => role.name !== 'Super Admin' && (
        actorRoleName === 'Super Admin' || ['Employee', 'Security Auditor'].includes(role.name)
      ));
  const canUpdate = hasPermission('users:update');
  const canDelete = hasPermission('users:delete');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search,
        department: selectedDept !== 'All' ? selectedDept : undefined,
        role: selectedRole !== 'All' ? selectedRole : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
      };

      const res = await userService.getUsers(params);
      if (res.success) {
        setUsers(res.data);
        setPagination(res.pagination);
      }
    } catch (err) {
      toast.error('Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, selectedDept, selectedRole, selectedStatus, toast]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await roleService.getRoles();
      if (res.success) {
        setRoles(res.data);
        if (res.data.length > 0 && !formData.roleId) {
          const empRole = res.data.find((r) => r.name === 'Employee') || res.data[0];
          setFormData((prev) => ({ ...prev, roleId: empRole._id }));
        }
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Open Create Modal
  const handleOpenAddModal = () => {
    const defaultRoleId = roles.find((r) => r.name === 'Employee')?._id || (roles[0]?._id ?? '');
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      roleId: defaultRoleId,
      department: 'Engineering',
      jobTitle: 'Software Engineer',
      phone: '',
      location: 'Headquarters',
      password: '',
      status: 'Active',
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (u) => {
    setSelectedUser(u);
    setFormData({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      roleId: u.role?._id || u.role,
      department: u.department || 'Engineering',
      jobTitle: u.jobTitle || 'Team Member',
      phone: u.phone || '',
      location: u.location || 'Headquarters',
      password: '',
      status: u.status,
    });
    setIsEditModalOpen(true);
  };

  // Submit Create
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.roleId) {
      toast.warning('Please enter first name, last name, email, and assign a role.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await userService.createUser(formData);
      toast.success(res.message || 'Invitation email sent successfully.');
      setIsAddModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating employee.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Edit
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await userService.updateUser(selectedUser._id, formData);
      toast.success(res.message || 'Employee record updated.');
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update employee.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvitation = async () => {
    if (!selectedUser?._id) return;
    try {
      setActionLoading(true);
      const result = await userService.resendInvitation(selectedUser._id);
      toast.success(result.message || 'A new invitation email has been sent.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to resend invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle user status (Active <-> Suspended)
  const handleToggleStatus = async (u) => {
    const nextStatus = u.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await userService.updateStatus(u._id, nextStatus);
      toast.success(`Employee ${u.fullName} status updated to ${nextStatus}.`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change status.');
    }
  };

  // Delete User Confirmation
  const handleDeletePrompt = (u) => {
    setUserToDelete(u);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      setActionLoading(true);
      await userService.deleteUser(userToDelete._id);
      toast.success(`Employee ${userToDelete.fullName} has been removed.`);
      setDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete employee.');
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
            Employee Directory & Identity
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage organization members, assign authorization roles, and toggle access states.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Employee</span>
          </button>
        )}
      </div>

      {/* Filters & Search Toolbar */}
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
            placeholder="Search by name, email, employee ID, or job title..."
            className="w-full bg-charcoal-950 border border-charcoal-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Filters dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-charcoal-950 border border-charcoal-800 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
          >
            <option value="All">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Product">Product</option>
            <option value="Operations">Operations</option>
            <option value="Finance">Finance</option>
          </select>

          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-charcoal-950 border border-charcoal-800 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
          >
            <option value="All">All Roles</option>
            {roles.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
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
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Deactivated">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="rounded-2xl bg-charcoal-900 border border-charcoal-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-charcoal-950 border-b border-charcoal-800 text-slate-400 font-mono uppercase tracking-wider">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Department & Title</th>
                <th className="py-3.5 px-4">Assigned Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto mb-2" />
                    Loading employees from MongoDB...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No employees matching the current filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-charcoal-850/50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-charcoal-800 border border-charcoal-700 flex items-center justify-center font-bold text-xs text-violet-300 shrink-0">
                          {getInitials(u.firstName, u.lastName)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200">
                            {u.fullName || `${u.firstName} ${u.lastName}`}
                          </div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-slate-400">
                      {u.employeeId}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-200 font-medium">{u.department}</div>
                      <div className="text-[11px] text-slate-400">{u.jobTitle}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRoleBadgeClass(u.role?.name)}`}>
                        {u.role?.name || 'Unassigned'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadgeClass(u.status)}`}>
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {formatRelativeTime(u.lastLogin)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canUpdate && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={u._id === currentUser?.id}
                            className={`p-1.5 rounded-lg border transition text-xs ${
                              u.status === 'Active'
                                ? 'border-amber-500/20 text-amber-400 hover:bg-amber-950/30'
                                : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30'
                            }`}
                            title={u.status === 'Active' ? 'Suspend Employee' : 'Activate Employee'}
                          >
                            {u.status === 'Active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        {canUpdate && (
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 rounded-lg border border-charcoal-700 text-slate-300 hover:text-white hover:bg-charcoal-800 transition"
                            title="Edit Employee Information"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => handleDeletePrompt(u)}
                            disabled={u._id === currentUser?.id}
                            className="p-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-950/30 transition disabled:opacity-40"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
            Showing <span className="font-semibold text-slate-200">{users.length}</span> of{' '}
            <span className="font-semibold text-slate-200">{pagination.total}</span> employees
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

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-charcoal-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-violet-400" />
                Onboard New Employee
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Corporate Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="employee@securegate.io"
                  required
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Assigned Role *
                  </label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    required
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    {assignableCreateRoles.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Product">Product</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Deactivated">Deactivated</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
                <p className="text-xs font-semibold text-violet-200">Secure email invitation</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">SecureGate will email a one-time invitation link. The employee verifies their mailbox and creates their own password. The link expires after 24 hours.</p>
              </div>

              <div className="pt-4 border-t border-charcoal-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-charcoal-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg transition"
                >
                  {actionLoading ? 'Creating...' : 'Onboard Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-charcoal-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-violet-400" />
                Edit Employee Record: {selectedUser?.fullName}
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Role
                  </label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    {assignableEditRoles.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Product">Product</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Deactivated">Deactivated</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Reset Password (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter new password (optional)"
                  className="w-full mt-1 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="pt-4 border-t border-charcoal-800 flex flex-wrap justify-end gap-3">
                {selectedUser?.invitationPending && (
                  <button
                    type="button"
                    onClick={handleResendInvitation}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg border border-violet-500/30 text-xs font-semibold text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                  >
                    {actionLoading ? 'Sending...' : 'Resend Invitation'}
                  </button>
                )}
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
                  {actionLoading ? 'Saving...' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Delete Dialog */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={`Delete Employee ${userToDelete?.fullName}?`}
        message={`Are you sure you want to permanently delete ${userToDelete?.fullName} (${userToDelete?.email})? All directory metadata and assigned access tokens will be revoked.`}
        confirmText="Permanently Delete"
        danger={true}
        loading={actionLoading}
      />
    </div>
  );
};

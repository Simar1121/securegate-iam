import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import AuditLog from '../models/AuditLog.js';
import SetupState from '../models/SetupState.js';
import { validatePasswordStrength } from '../utils/security.js';
import { synchronizeAdminSeats, releaseAdminSeat } from '../services/adminSeatService.js';

const permissions = [
  { name: 'View Users', code: 'users:read', category: 'User Management', description: 'Can view employee directory, profiles, and basic statistics', isSystem: true },
  { name: 'Create Users', code: 'users:create', category: 'User Management', description: 'Can create and onboard new employees into the organization', isSystem: true },
  { name: 'Edit Users', code: 'users:update', category: 'User Management', description: 'Can update employee profiles, departments, assigned roles, and status', isSystem: true },
  { name: 'Delete Users', code: 'users:delete', category: 'User Management', description: 'Can permanently remove or deactivate employee records', isSystem: true },
  { name: 'Manage Roles', code: 'roles:manage', category: 'Role Management', description: 'Can create, configure, update, and delete access roles', isSystem: true },
  { name: 'Manage Permissions', code: 'permissions:manage', category: 'Role Management', description: 'Can configure system permissions and grant security privileges', isSystem: true },
  { name: 'View Audit Logs', code: 'audit:read', category: 'Audit & Compliance', description: 'Can inspect security audit trails and administrative actions', isSystem: true },
  { name: 'Manage System Settings', code: 'settings:manage', category: 'System Administration', description: 'Can manage organization security policies and IAM controls', isSystem: true },
];

const roleDefinitions = [
  { name: 'Super Admin', description: 'Full system access, IAM governance, and security controls.', codes: permissions.map(p => p.code), isDefault: false, isCustom: false },
  { name: 'IT Administrator', description: 'Manages employee onboarding, identity lifecycle, roles, permissions, settings, and audit logs.', codes: ['users:read', 'users:create', 'users:update', 'roles:manage', 'permissions:manage', 'settings:manage', 'audit:read'], isDefault: false, isCustom: false },
  { name: 'HR Manager', description: 'Manages employee directory and staff records; employee invitations are restricted to organization administrators.', codes: ['users:read', 'users:update', 'audit:read'], isDefault: false, isCustom: false },
  { name: 'Employee', description: 'Standard employee with self-service access.', codes: [], isDefault: true, isCustom: false },
  { name: 'Security Auditor', description: 'Read-only access to employee records and audit trails.', codes: ['users:read', 'audit:read'], isDefault: false, isCustom: true },
];

export const getSetupStatus = async (_req, res) => {
  try {
    const state = await SetupState.findById('organization').lean();
    const userCount = await User.countDocuments();
    return res.json({ success: true, setupRequired: !state && userCount === 0, setupInProgress: state?.status === 'initializing' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to determine organization setup status.' });
  }
};

export const initializeOrganization = async (req, res) => {
  let createdPermissionIds = [];
  let createdRoleIds = [];
  let createdUserId = null;
  let createdAuditId = null;
  let lockAcquired = false;

  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body || {};
    if (![firstName, lastName, email, password, confirmPassword].every(v => typeof v === 'string' && v.trim())) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (password !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) return res.status(400).json({ success: false, message: passwordCheck.message });
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    if (firstName.trim().length > 50 || lastName.trim().length > 50) return res.status(400).json({ success: false, message: 'Names must be 50 characters or fewer.' });

    // A unique singleton document is the atomic one-time setup gate. A second
    // request (including a concurrent request) cannot acquire the same _id.
    try {
      await SetupState.create({ _id: 'organization', status: 'initializing' });
      lockAcquired = true;
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ success: false, message: 'Organization setup has already started or completed.' });
      throw error;
    }

    const [usersCount, rolesCount, permissionsCount] = await Promise.all([
      User.countDocuments(), Role.countDocuments(), Permission.countDocuments(),
    ]);
    if (usersCount || rolesCount || permissionsCount) {
      await SetupState.deleteOne({ _id: 'organization' });
      lockAcquired = false;
      return res.status(409).json({ success: false, message: 'The organization database is not empty. Setup was stopped without deleting existing records.' });
    }

    const createdPermissions = await Permission.insertMany(permissions);
    createdPermissionIds = createdPermissions.map(p => p._id);
    const permissionMap = new Map(createdPermissions.map(p => [p.code, p._id]));

    const createdRoles = [];
    for (const definition of roleDefinitions) {
      const role = await Role.create({
        name: definition.name,
        description: definition.description,
        permissions: definition.codes.map(code => permissionMap.get(code)),
        isDefault: definition.isDefault,
        isCustom: definition.isCustom,
        status: 'Active',
      });
      createdRoles.push(role);
      createdRoleIds.push(role._id);
    }

    const adminRole = createdRoles.find(role => role.name === 'Super Admin');
    const admin = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password,
      department: 'Information Technology',
      jobTitle: 'System Owner',
      role: adminRole._id,
      status: 'Active',
      tokenVersion: 0,
    });
    createdUserId = admin._id;
    await synchronizeAdminSeats();

    const audit = await AuditLog.create({
      action: 'SYSTEM_INITIALIZED', category: 'SYSTEM', actor: admin._id,
      actorEmail: admin.email, actorName: admin.fullName, actorRole: 'Super Admin',
      targetType: 'System', targetName: 'Organization', status: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1', userAgent: req.get('user-agent') || 'Unknown',
      details: { rolesCreated: createdRoles.length, permissionsCreated: createdPermissions.length },
    });
    createdAuditId = audit._id;

    await SetupState.updateOne({ _id: 'organization', status: 'initializing' }, { $set: { status: 'completed', completedAt: new Date() } });
    return res.status(201).json({ success: true, message: 'Organization initialized. You can now sign in with your Super Admin account.' });
  } catch (error) {
    // Roll back only documents created by this request; never clear collections.
    if (createdAuditId) await AuditLog.deleteOne({ _id: createdAuditId }).catch(() => {});
    if (createdUserId) {
      await releaseAdminSeat(createdUserId).catch(() => {});
      await User.deleteOne({ _id: createdUserId }).catch(() => {});
    }
    if (createdRoleIds.length) await Role.deleteMany({ _id: { $in: createdRoleIds } }).catch(() => {});
    if (createdPermissionIds.length) await Permission.deleteMany({ _id: { $in: createdPermissionIds } }).catch(() => {});
    if (lockAcquired) await SetupState.deleteOne({ _id: 'organization' }).catch(() => {});
    console.error('[Organization Setup Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Organization setup failed. No existing organization data was deleted. Correct the issue and try again.' });
  }
};

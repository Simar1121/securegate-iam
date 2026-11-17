import User from '../models/User.js';
import Role from '../models/Role.js';
import { logAudit } from '../services/auditService.js';
import {
  isValidObjectId,
  validatePasswordStrength,
  generateSecureTemporaryPassword,
} from '../utils/security.js';

const PRIVILEGED_ROLES = ['Super Admin', 'IT Administrator'];
const PRIVILEGED_PERMISSION_CODES = [
  'roles:manage',
  'permissions:manage',
  'settings:manage',
  'users:delete',
];

const getPermissionCodes = (role) =>
  new Set((role?.permissions || []).map((permission) =>
    typeof permission === 'string' ? permission : permission?.code
  ).filter(Boolean));

const mayAssignRole = (actor, targetRole) => {
  if (actor?.role?.name === 'Super Admin') return true;
  if (!targetRole || PRIVILEGED_ROLES.includes(targetRole.name)) return false;

  const targetCodes = getPermissionCodes(targetRole);
  if ([...targetCodes].some((code) => PRIVILEGED_PERMISSION_CODES.includes(code))) return false;

  const actorCodes = getPermissionCodes(actor?.role);
  return [...targetCodes].every((code) => actorCodes.has(code));
};

// @desc    Get all users with search, filter, and pagination
// @route   GET /api/users
// @access  Private (Permission: users:read)
export const getUsers = async (req, res) => {
  try {
    const {
      search,
      department,
      role,
      status,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // Search keyword across multiple fields
    if (search && search.trim() !== '') {
      const sanitizedSearch = search.trim().slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitizedSearch, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { employeeId: searchRegex },
        { jobTitle: searchRegex },
      ];
    }

    // Filters
    if (department && department !== 'All') {
      query.department = String(department).slice(0, 50);
    }

    if (role && role !== 'All') {
      if (isValidObjectId(role)) {
        query.role = role;
      }
    }

    if (status && status !== 'All') {
      if (['Active', 'Suspended', 'Deactivated'].includes(status)) {
        query.status = status;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const allowedSortFields = ['createdAt', 'firstName', 'lastName', 'email', 'department', 'lastLogin'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sort = { [safeSortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [users, total] = await Promise.all([
      User.find(query)
        .populate({
          path: 'role',
          select: 'name description isDefault isCustom status',
        })
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('[GetUsers Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve employees list.',
    });
  }
};

// @desc    Get single user details by ID
// @route   GET /api/users/:id
// @access  Private (Permission: users:read)
export const getUserById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID format.',
      });
    }

    const user = await User.findById(req.params.id).populate({
      path: 'role',
      populate: { path: 'permissions', model: 'Permission' },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found.',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user details.',
    });
  }
};

// @desc    Create a new employee with privilege escalation prevention
// @route   POST /api/users
// @access  Private (Permission: users:create)
export const createUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      roleId,
      department,
      jobTitle,
      phone,
      location,
      status,
    } = req.body;

    if (!firstName || !lastName || !email || !roleId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide required fields: firstName, lastName, email, and roleId.',
      });
    }

    if (!isValidObjectId(roleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format.',
      });
    }

    const emailNormalized = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid corporate email address.',
      });
    }

    const existing = await User.findOne({ email: emailNormalized });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    const roleDoc = await Role.findById(roleId).populate('permissions');
    if (!roleDoc) {
      return res.status(400).json({
        success: false,
        message: 'Selected role does not exist in the system.',
      });
    }

    // Role Status Validation: Inactive roles cannot be assigned
    if (roleDoc.status === 'Inactive') {
      return res.status(400).json({
        success: false,
        message: `Cannot assign role "${roleDoc.name}" because it is currently inactive.`,
      });
    }

    // PRIVILEGE ESCALATION PREVENTION:
    // Non-Super-Admins may only assign roles whose permissions are a subset of their own.
    const callerRole = req.user.role?.name;
    if (!mayAssignRole(req.user, roleDoc)) {
      await logAudit({
        req,
        action: 'PRIVILEGE_ESCALATION_BLOCKED',
        category: 'SECURITY',
        actor: req.user._id,
        actorEmail: req.user.email,
        actorName: req.user.fullName,
        actorRole: callerRole,
        targetType: 'User',
        targetName: emailNormalized,
        status: 'WARNING',
        details: {
          attemptedRole: roleDoc.name,
          reason: 'Requested role contains privileges the actor is not authorized to assign',
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Privilege Escalation Blocked: You can only assign roles with permissions you already possess. Privileged roles require a Super Administrator.',
      });
    }

    // Password Security: Avoid shared default passwords
    let initialPassword;
    let mustChangePassword = false;

    if (password && password.trim().length > 0) {
      const pwdCheck = validatePasswordStrength(password);
      if (!pwdCheck.valid) {
        return res.status(400).json({
          success: false,
          message: pwdCheck.message,
        });
      }
      initialPassword = password;
    } else {
      // Generate a cryptographically secure, unique temporary password
      initialPassword = generateSecureTemporaryPassword();
      mustChangePassword = true;
    }

    const newUser = new User({
      firstName: firstName.trim().slice(0, 50),
      lastName: lastName.trim().slice(0, 50),
      email: emailNormalized,
      password: initialPassword,
      role: roleDoc._id,
      department: department?.trim().slice(0, 50) || 'Engineering',
      jobTitle: jobTitle?.trim().slice(0, 50) || 'Team Member',
      phone: phone?.trim().slice(0, 30) || '',
      location: location?.trim().slice(0, 50) || 'Headquarters',
      status: ['Active', 'Suspended', 'Deactivated'].includes(status) ? status : 'Active',
      mustChangePassword,
      tokenVersion: 0,
    });

    await newUser.save();
    await newUser.populate('role');

    // Audit log
    await logAudit({
      req,
      action: 'USER_CREATED',
      category: 'USER_MGMT',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: callerRole,
      targetType: 'User',
      targetId: newUser._id,
      targetName: newUser.fullName,
      status: 'SUCCESS',
      details: {
        email: newUser.email,
        role: roleDoc.name,
        department: newUser.department,
        employeeId: newUser.employeeId,
        mustChangePassword,
      },
    });

    res.status(201).json({
      success: true,
      message: `Employee ${newUser.fullName} created successfully.`,
      data: newUser,
      // Provide the temporary password in response only if auto-generated so the admin can deliver it securely
      ...(mustChangePassword ? { temporaryPassword: initialPassword } : {}),
    });
  } catch (error) {
    console.error('[CreateUser Error]:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating new employee.',
    });
  }
};

// @desc    Update employee information with privilege escalation prevention
// @route   PUT /api/users/:id
// @access  Private (Permission: users:update)
export const updateUser = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID format.',
      });
    }

    const {
      firstName,
      lastName,
      email,
      roleId,
      department,
      jobTitle,
      phone,
      location,
      status,
      password,
    } = req.body;

    const user = await User.findById(req.params.id).populate('role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found.',
      });
    }

    const callerRole = req.user.role?.name;
    const targetCurrentRole = user.role?.name;

    // Protect all privileged administrator accounts from modification by lower-privilege actors.
    if (PRIVILEGED_ROLES.includes(targetCurrentRole) && callerRole !== 'Super Admin') {
      await logAudit({
        req,
        action: 'UNAUTHORIZED_ADMIN_MODIFICATION_BLOCKED',
        category: 'SECURITY',
        actor: req.user._id,
        actorEmail: req.user.email,
        actorName: req.user.fullName,
        actorRole: callerRole,
        targetType: 'User',
        targetId: user._id,
        targetName: user.fullName,
        status: 'WARNING',
        details: {
          reason: 'Non-Super Admin attempted to modify a Super Admin account',
        },
      });

      return res.status(403).json({
        success: false,
        message: 'Forbidden: Privileged administrator accounts can only be modified by a Super Administrator.',
      });
    }

    // Check duplicate email if changed
    if (email && email.toLowerCase().trim() !== user.email) {
      const emailNormalized = email.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalized)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid corporate email address.',
        });
      }

      const emailExists = await User.findOne({
        email: emailNormalized,
        _id: { $ne: user._id },
      });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Another user with this email address already exists.',
        });
      }
      user.email = emailNormalized;
    }

    const changes = {};

    if (firstName) {
      changes.firstName = { from: user.firstName, to: firstName.trim().slice(0, 50) };
      user.firstName = firstName.trim().slice(0, 50);
    }
    if (lastName) {
      changes.lastName = { from: user.lastName, to: lastName.trim().slice(0, 50) };
      user.lastName = lastName.trim().slice(0, 50);
    }
    if (department) {
      changes.department = { from: user.department, to: department.trim().slice(0, 50) };
      user.department = department.trim().slice(0, 50);
    }
    if (jobTitle) {
      changes.jobTitle = { from: user.jobTitle, to: jobTitle.trim().slice(0, 50) };
      user.jobTitle = jobTitle.trim().slice(0, 50);
    }
    if (phone !== undefined) user.phone = String(phone).slice(0, 30);
    if (location !== undefined) user.location = String(location).slice(0, 50);

    // PRIVILEGE SAFEGUARD 2: Role Assignment Verification
    if (roleId && roleId !== user.role?._id?.toString()) {
      if (!isValidObjectId(roleId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID format.',
        });
      }

      const newRole = await Role.findById(roleId).populate('permissions');
      if (!newRole) {
        return res.status(400).json({
          success: false,
          message: 'Target role does not exist.',
        });
      }

      // Check role status: Inactive role cannot be assigned
      if (newRole.status === 'Inactive') {
        return res.status(400).json({
          success: false,
          message: `Cannot assign role "${newRole.name}" because it is currently inactive.`,
        });
      }

      // Non-Super-Admins may only assign permissions they already possess.
      if (!mayAssignRole(req.user, newRole)) {
        await logAudit({
          req,
          action: 'PRIVILEGE_ESCALATION_BLOCKED',
          category: 'SECURITY',
          actor: req.user._id,
          actorEmail: req.user.email,
          actorName: req.user.fullName,
          actorRole: callerRole,
          targetType: 'User',
          targetId: user._id,
          targetName: user.fullName,
          status: 'WARNING',
          details: {
            attemptedRole: newRole.name,
            reason: 'Requested role contains privileges the actor is not authorized to assign',
          },
        });
        return res.status(403).json({
          success: false,
          message: 'Privilege Escalation Blocked: You can only assign roles with permissions you already possess. Privileged roles require a Super Administrator.',
        });
      }

      // Only Super Admin can promote someone to Super Admin
      if (newRole.name === 'Super Admin' && callerRole !== 'Super Admin') {
        await logAudit({
          req,
          action: 'PRIVILEGE_ESCALATION_BLOCKED',
          category: 'SECURITY',
          actor: req.user._id,
          actorEmail: req.user.email,
          actorName: req.user.fullName,
          actorRole: callerRole,
          targetType: 'User',
          targetId: user._id,
          targetName: user.fullName,
          status: 'WARNING',
          details: { attemptedRole: 'Super Admin' },
        });

        return res.status(403).json({
          success: false,
          message: 'Privilege Escalation Blocked: Only Super Administrators can assign the Super Admin role.',
        });
      }

      // Non-Super Admins (like HR Managers) cannot assign privileged roles
      if (PRIVILEGED_ROLES.includes(newRole.name) && callerRole !== 'Super Admin') {
        await logAudit({
          req,
          action: 'PRIVILEGE_ESCALATION_BLOCKED',
          category: 'SECURITY',
          actor: req.user._id,
          actorEmail: req.user.email,
          actorName: req.user.fullName,
          actorRole: callerRole,
          targetType: 'User',
          targetId: user._id,
          targetName: user.fullName,
          status: 'WARNING',
          details: { attemptedRole: newRole.name },
        });

        return res.status(403).json({
          success: false,
          message: `Privilege Escalation Blocked: Your role (${callerRole}) is not authorized to assign the privileged role "${newRole.name}".`,
        });
      }

      // Prevent demoting the last active Super Admin
      if (targetCurrentRole === 'Super Admin' && newRole.name !== 'Super Admin') {
        const activeSuperAdminCount = await User.countDocuments({
          role: user.role._id,
          status: 'Active',
        });
        if (activeSuperAdminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Safety safeguard: Cannot demote the last remaining active Super Administrator account.',
          });
        }
      }

      changes.role = { from: user.role?.name, to: newRole.name };
      user.role = newRole._id;
      // Invalidate existing sessions on role change so new permissions take effect immediately
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    // PRIVILEGE SAFEGUARD 3: Status change validation
    if (status && status !== user.status) {
      if (!['Active', 'Suspended', 'Deactivated'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be Active, Suspended, or Deactivated.',
        });
      }

      // Prevent locking out the last active Super Admin
      if (targetCurrentRole === 'Super Admin' && status !== 'Active') {
        const activeSuperAdminCount = await User.countDocuments({
          role: user.role._id,
          status: 'Active',
        });
        if (activeSuperAdminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Safety safeguard: Cannot suspend or deactivate the last remaining active Super Administrator.',
          });
        }
      }

      changes.status = { from: user.status, to: status };
      user.status = status;
      // Revoke all existing sessions immediately
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    // Password reset with complexity enforcement
    if (password && password.trim().length > 0) {
      const pwdCheck = validatePasswordStrength(password);
      if (!pwdCheck.valid) {
        return res.status(400).json({
          success: false,
          message: pwdCheck.message,
        });
      }

      user.password = password;
      user.passwordChangedAt = new Date();
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      changes.passwordReset = true;
    }

    await user.save();
    await user.populate({
      path: 'role',
      select: 'name description isDefault isCustom status',
    });

    // Audit log
    await logAudit({
      req,
      action: 'USER_UPDATED',
      category: 'USER_MGMT',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: callerRole,
      targetType: 'User',
      targetId: user._id,
      targetName: user.fullName,
      status: 'SUCCESS',
      details: { changes },
    });

    res.json({
      success: true,
      message: 'Employee record updated successfully.',
      data: user,
    });
  } catch (error) {
    console.error('[UpdateUser Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating employee record.',
    });
  }
};

// @desc    Delete or deactivate employee with Super Admin protection
// @route   DELETE /api/users/:id
// @access  Private (Permission: users:delete)
export const deleteUser = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID format.',
      });
    }

    const user = await User.findById(req.params.id).populate('role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found.',
      });
    }

    // Prevent deleting own account
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Security safeguard: You cannot delete your own account.',
      });
    }

    const callerRole = req.user.role?.name;
    const targetRole = user.role?.name;

    // PRIVILEGE SAFEGUARD: Protect Super Admin accounts from deletion by non-Super Admins
    if (targetRole === 'Super Admin') {
      if (callerRole !== 'Super Admin') {
        await logAudit({
          req,
          action: 'UNAUTHORIZED_ADMIN_DELETION_BLOCKED',
          category: 'SECURITY',
          actor: req.user._id,
          actorEmail: req.user.email,
          actorName: req.user.fullName,
          actorRole: callerRole,
          targetType: 'User',
          targetId: user._id,
          targetName: user.fullName,
          status: 'WARNING',
          details: { reason: 'Non-Super Admin attempted to delete a Super Admin' },
        });

        return res.status(403).json({
          success: false,
          message: 'Forbidden: Super Administrator accounts can only be deleted by another Super Administrator.',
        });
      }

      // Check if this is the last Super Admin
      const activeSuperAdminCount = await User.countDocuments({
        role: user.role._id,
      });
      if (activeSuperAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Safety safeguard: Cannot delete the last remaining Super Administrator account.',
        });
      }
    }

    const userName = user.fullName;
    const userEmail = user.email;

    await User.findByIdAndDelete(req.params.id);

    // Audit log
    await logAudit({
      req,
      action: 'USER_DELETED',
      category: 'USER_MGMT',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: callerRole,
      targetType: 'User',
      targetId: req.params.id,
      targetName: userName,
      status: 'SUCCESS',
      details: { deletedEmail: userEmail, deletedRole: targetRole },
    });

    res.json({
      success: true,
      message: `Employee ${userName} was permanently deleted.`,
    });
  } catch (error) {
    console.error('[DeleteUser Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete employee record.',
    });
  }
};

// @desc    Change user status (Active, Suspended, Deactivated)
// @route   PATCH /api/users/:id/status
// @access  Private (Permission: users:update)
export const updateUserStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID format.',
      });
    }

    const { status } = req.body;
    if (!['Active', 'Suspended', 'Deactivated'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be Active, Suspended, or Deactivated.',
      });
    }

    const user = await User.findById(req.params.id).populate('role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found.',
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Security safeguard: You cannot change your own account status.',
      });
    }

    const callerRole = req.user.role?.name;
    const targetRole = user.role?.name;

    // Protect privileged administrator account status from lower-privilege actors.
    if (PRIVILEGED_ROLES.includes(targetRole) && callerRole !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only a Super Administrator can change the status of privileged administrator accounts.',
      });
    }

    if (targetRole === 'Super Admin') {
      if (status !== 'Active') {
        const activeCount = await User.countDocuments({
          role: user.role._id,
          status: 'Active',
        });
        if (activeCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Safety safeguard: Cannot suspend or deactivate the last remaining active Super Administrator.',
          });
        }
      }
    }

    const previousStatus = user.status;
    user.status = status;
    // Invalidate existing sessions immediately if account is suspended or deactivated
    if (status !== 'Active') {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await user.save();

    await logAudit({
      req,
      action: 'USER_STATUS_CHANGE',
      category: 'USER_MGMT',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: callerRole,
      targetType: 'User',
      targetId: user._id,
      targetName: user.fullName,
      status: 'SUCCESS',
      details: { from: previousStatus, to: status, sessionsRevoked: status !== 'Active' },
    });

    res.json({
      success: true,
      message: `Status of ${user.fullName} updated to ${status}.`,
      data: { id: user._id, status: user.status },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user status.',
    });
  }
};

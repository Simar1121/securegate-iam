import Role from '../models/Role.js';
import User from '../models/User.js';
import Permission from '../models/Permission.js';
import { logAudit } from '../services/auditService.js';
import { isValidObjectId } from '../utils/security.js';

const PRIVILEGED_PERMISSIONS = ['roles:manage', 'permissions:manage', 'settings:manage', 'users:delete'];
const SYSTEM_ROLE_NAMES = ['Super Admin', 'Employee', 'IT Administrator', 'HR Manager'];
const permissionCodesForRole = (role) =>
  new Set((role?.permissions || []).map((permission) =>
    typeof permission === 'string' ? permission : permission?.code
  ).filter(Boolean));

// @desc    Get all roles with permissions and user count
// @route   GET /api/roles
// @access  Private (Permission: roles:manage or users:read)
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find()
      .populate('permissions')
      .sort({ createdAt: 1 });

    // Count users for each role
    const rolesWithCounts = await Promise.all(
      roles.map(async (role) => {
        const userCount = await User.countDocuments({ role: role._id });
        return {
          ...role.toObject(),
          userCount,
        };
      })
    );

    res.json({
      success: true,
      data: rolesWithCounts,
    });
  } catch (error) {
    console.error('[GetRoles Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve roles.',
    });
  }
};

// @desc    Get single role by ID
// @route   GET /api/roles/:id
// @access  Private
export const getRoleById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format.',
      });
    }

    const role = await Role.findById(req.params.id).populate('permissions');
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found.',
      });
    }

    const userCount = await User.countDocuments({ role: role._id });

    res.json({
      success: true,
      data: {
        ...role.toObject(),
        userCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching role details.',
    });
  }
};

// @desc    Create a custom role with strict permission validation
// @route   POST /api/roles
// @access  Private (Permission: roles:manage)
export const createRole = async (req, res) => {
  try {
    const { name, description, permissions, status } = req.body;

    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Role name is required.',
      });
    }

    const sanitizedName = name.trim().slice(0, 50);

    const existingRole = await Role.findOne({
      name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') },
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'A role with this name already exists.',
      });
    }

    // Validate permission IDs array and reject malformed payloads rather than silently ignoring them.
    if (permissions !== undefined && !Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'Permissions must be an array of permission IDs.' });
    }
    if (status !== undefined && !['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Role status must be Active or Inactive.' });
    }

    let validatedPermissionIds = [];
    if (Array.isArray(permissions) && permissions.length > 0) {
      // 1. Verify every element is a valid ObjectId
      for (const pId of permissions) {
        if (!isValidObjectId(pId)) {
          return res.status(400).json({
            success: false,
            message: `Invalid permission ID format: [${pId}].`,
          });
        }
      }

      // 2. Verify all permission documents actually exist in the database
      const foundPerms = await Permission.find({ _id: { $in: permissions } });
      if (foundPerms.length !== permissions.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more specified permission IDs do not exist in the permissions catalog.',
        });
      }

      // 3. Privileged permission protection:
      // Only Super Admin can grant 'roles:manage', 'permissions:manage', or 'settings:manage'
      const callerRole = req.user.role?.name;
      if (callerRole !== 'Super Admin') {
        const actorPermissionCodes = permissionCodesForRole(req.user.role);
        const containsPrivileged = foundPerms.some((p) => PRIVILEGED_PERMISSIONS.includes(p.code));
        const grantsBeyondActor = foundPerms.some((p) => !actorPermissionCodes.has(p.code));
        if (containsPrivileged || grantsBeyondActor) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You may only grant permissions you already possess; privileged administrative permissions can only be granted by a Super Administrator.',
          });
        }
      }

      validatedPermissionIds = foundPerms.map((p) => p._id);
    }

    const newRole = new Role({
      name: sanitizedName,
      description: typeof description === 'string' ? description.trim().slice(0, 200) : '',
      permissions: validatedPermissionIds,
      isDefault: false,
      isCustom: true,
      status: status || 'Active',
    });

    await newRole.save();
    await newRole.populate('permissions');

    // Audit log
    await logAudit({
      req,
      action: 'ROLE_CREATED',
      category: 'RBAC',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: req.user.role?.name,
      targetType: 'Role',
      targetId: newRole._id,
      targetName: newRole.name,
      status: 'SUCCESS',
      details: {
        roleName: newRole.name,
        permissionCount: newRole.permissions.length,
      },
    });

    res.status(201).json({
      success: true,
      message: `Role "${newRole.name}" created successfully.`,
      data: newRole,
    });
  } catch (error) {
    console.error('[CreateRole Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating role.',
    });
  }
};

// @desc    Update role details and permissions
// @route   PUT /api/roles/:id
// @access  Private (Permission: roles:manage)
export const updateRole = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format.',
      });
    }

    const { name, description, permissions, status } = req.body;

    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found.',
      });
    }

    const callerRole = req.user.role?.name;

    // Only Super Admin may alter built-in roles or roles carrying privileged capabilities.
    const currentRolePermissions = await Permission.find({ _id: { $in: role.permissions } });
    const roleHasPrivilegedPermissions = currentRolePermissions.some((permission) =>
      PRIVILEGED_PERMISSIONS.includes(permission.code)
    );
    if (
      callerRole !== 'Super Admin' &&
      (role.isDefault || SYSTEM_ROLE_NAMES.includes(role.name) || roleHasPrivilegedPermissions)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only a Super Administrator can modify system roles or roles containing privileged permissions.',
      });
    }

    // Safeguard: Cannot rename or deactivate Super Admin
    if (role.name === 'Super Admin') {
      if (name && name !== 'Super Admin') {
        return res.status(400).json({
          success: false,
          message: 'System role name "Super Admin" cannot be modified.',
        });
      }
      if (status && status !== 'Active') {
        return res.status(400).json({
          success: false,
          message: 'System role "Super Admin" cannot be deactivated.',
        });
      }
    }

    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ success: false, message: 'Role name must be a string.' });
    }

    if (name && name.trim() !== role.name) {
      const sanitizedName = name.trim().slice(0, 50);
      const duplicate = await Role.findOne({
        name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') },
        _id: { $ne: role._id },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Another role with this name already exists.',
        });
      }
      role.name = sanitizedName;
    }

    if (description !== undefined) role.description = String(description).slice(0, 200);

    if (permissions !== undefined && !Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'Permissions must be an array of permission IDs.' });
    }

    if (status !== undefined) {
      if (!['Active', 'Inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Role status must be Active or Inactive.',
        });
      }
      role.status = status;
    }

    if (permissions && Array.isArray(permissions)) {
      // 1. Verify every element is a valid ObjectId
      for (const pId of permissions) {
        if (!isValidObjectId(pId)) {
          return res.status(400).json({
            success: false,
            message: `Invalid permission ID format: [${pId}].`,
          });
        }
      }

      // 2. Verify all exist
      const foundPerms = await Permission.find({ _id: { $in: permissions } });
      if (foundPerms.length !== permissions.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more specified permission IDs do not exist in the permissions catalog.',
        });
      }

      // 3. Privileged permission protection
      if (callerRole !== 'Super Admin') {
        const actorPermissionCodes = permissionCodesForRole(req.user.role);
        const containsPrivileged = foundPerms.some((p) => PRIVILEGED_PERMISSIONS.includes(p.code));
        const grantsBeyondActor = foundPerms.some((p) => !actorPermissionCodes.has(p.code));
        if (containsPrivileged || grantsBeyondActor) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You may only grant permissions you already possess; privileged administrative permissions can only be granted by a Super Administrator.',
          });
        }
      }

      role.permissions = foundPerms.map((p) => p._id);
    }

    await role.save();
    await role.populate('permissions');

    // Force assigned users to re-authenticate so changed role policy takes effect immediately.
    await User.updateMany({ role: role._id }, { $inc: { tokenVersion: 1 } });

    // Audit log
    await logAudit({
      req,
      action: 'ROLE_UPDATED',
      category: 'RBAC',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: callerRole,
      targetType: 'Role',
      targetId: role._id,
      targetName: role.name,
      status: 'SUCCESS',
      details: {
        roleName: role.name,
        permissionCount: role.permissions.length,
        status: role.status,
      },
    });

    res.json({
      success: true,
      message: `Role "${role.name}" updated successfully.`,
      data: role,
    });
  } catch (error) {
    console.error('[UpdateRole Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating role.',
    });
  }
};

// @desc    Delete custom role
// @route   DELETE /api/roles/:id
// @access  Private (Permission: roles:manage)
export const deleteRole = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format.',
      });
    }

    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found.',
      });
    }

    // Safeguard: Cannot delete default system roles
    if (role.isDefault || ['Super Admin', 'Employee', 'IT Administrator', 'HR Manager'].includes(role.name)) {
      return res.status(400).json({
        success: false,
        message: `System default role "${role.name}" cannot be deleted.`,
      });
    }

    // Safeguard: Check if any user is currently assigned to this role
    const assignedUsersCount = await User.countDocuments({ role: role._id });
    if (assignedUsersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role "${role.name}". It is currently assigned to ${assignedUsersCount} employee(s). Reassign them first.`,
      });
    }

    const roleName = role.name;
    await Role.findByIdAndDelete(req.params.id);

    // Audit log
    await logAudit({
      req,
      action: 'ROLE_DELETED',
      category: 'RBAC',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: req.user.role?.name,
      targetType: 'Role',
      targetId: req.params.id,
      targetName: roleName,
      status: 'SUCCESS',
      details: { deletedRole: roleName },
    });

    res.json({
      success: true,
      message: `Role "${roleName}" was successfully removed.`,
    });
  } catch (error) {
    console.error('[DeleteRole Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete role.',
    });
  }
};

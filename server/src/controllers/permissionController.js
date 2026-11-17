import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import { logAudit } from '../services/auditService.js';

// @desc    Get all permissions grouped by category
// @route   GET /api/permissions
// @access  Private (Permission: permissions:manage or roles:manage)
export const getPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ category: 1, name: 1 });

    // Group by category
    const grouped = permissions.reduce((acc, perm) => {
      const cat = perm.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    }, {});

    res.json({
      success: true,
      data: permissions,
      grouped,
    });
  } catch (error) {
    console.error('[GetPermissions Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve permissions list.',
    });
  }
};

// @desc    Get complete RBAC Permission Matrix (Roles vs Permissions)
// @route   GET /api/permissions/matrix
// @access  Private (Permission: permissions:manage or roles:manage)
export const getPermissionMatrix = async (req, res) => {
  try {
    const [permissions, roles] = await Promise.all([
      Permission.find().sort({ category: 1, name: 1 }),
      Role.find().sort({ createdAt: 1 }),
    ]);

    // Build matrix
    const matrix = roles.map((role) => {
      const rolePermIds = new Set(role.permissions.map((p) => p.toString()));
      const permStatus = {};
      permissions.forEach((perm) => {
        // Super Admin has all permissions implicitly
        permStatus[perm.code] = role.name === 'Super Admin' ? true : rolePermIds.has(perm._id.toString());
      });

      return {
        roleId: role._id,
        roleName: role.name,
        isDefault: role.isDefault,
        permissions: permStatus,
      };
    });

    res.json({
      success: true,
      data: {
        permissions,
        roles,
        matrix,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load permission matrix.',
    });
  }
};

// @desc    Create a custom permission
// @route   POST /api/permissions
// @access  Private (Permission: permissions:manage)
export const createPermission = async (req, res) => {
  try {
    const { name, code, description, category } = req.body;

    if (!name || !code || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, and description are required.',
      });
    }

    const codeNormalized = code.toLowerCase().trim().replace(/\s+/g, ':');
    const nameSanitized = name.trim().slice(0, 60);

    const existing = await Permission.findOne({
      $or: [{ code: codeNormalized }, { name: nameSanitized }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A permission with this name or code already exists.',
      });
    }

    const newPerm = new Permission({
      name: nameSanitized,
      code: codeNormalized,
      description: description.trim().slice(0, 250),
      category: category || 'System Administration',
      isSystem: false,
    });

    await newPerm.save();

    // Audit log
    await logAudit({
      req,
      action: 'PERMISSION_CREATED',
      category: 'RBAC',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: req.user.role?.name,
      targetType: 'Permission',
      targetId: newPerm._id,
      targetName: newPerm.name,
      status: 'SUCCESS',
      details: {
        permissionCode: newPerm.code,
        category: newPerm.category,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Custom permission created successfully.',
      data: newPerm,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating permission.',
    });
  }
};

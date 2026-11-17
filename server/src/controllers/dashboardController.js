import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import AuditLog from '../models/AuditLog.js';

// @desc    Get real-time IAM dashboard statistics and recent activity streams
// @route   GET /api/dashboard/stats
// @access  Private (Permission: users:read or Super Admin)
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalEmployees,
      activeEmployees,
      suspendedEmployees,
      deactivatedEmployees,
      totalRoles,
      totalPermissions,
      departmentStats,
      roleStatsRaw,
      recentLogins,
      recentAdminActivities,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'Active' }),
      User.countDocuments({ status: 'Suspended' }),
      User.countDocuments({ status: 'Deactivated' }),
      Role.countDocuments(),
      Permission.countDocuments(),
      // Department breakdown aggregation
      User.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Role distribution aggregation
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'roles',
            localField: '_id',
            foreignField: '_id',
            as: 'roleInfo',
          },
        },
        { $unwind: '$roleInfo' },
        { $project: { roleName: '$roleInfo.name', count: 1 } },
      ]),
      // Recent login events
      AuditLog.find({
        action: { $in: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'LOGIN_BLOCKED'] },
      })
        .sort({ createdAt: -1 })
        .limit(7),
      // Recent administrative changes
      AuditLog.find({
        action: { $nin: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'LOGIN_BLOCKED'] },
      })
        .sort({ createdAt: -1 })
        .limit(7),
    ]);

    // Format department stats
    const departments = departmentStats.map((item) => ({
      name: item._id || 'Unassigned',
      count: item.count,
    }));

    // Format role stats
    const roles = roleStatsRaw.map((item) => ({
      name: item.roleName,
      count: item.count,
    }));

    res.json({
      success: true,
      data: {
        metrics: {
          totalEmployees,
          activeEmployees,
          suspendedEmployees,
          deactivatedEmployees,
          totalRoles,
          totalPermissions,
        },
        departments,
        roles,
        recentLogins,
        recentAdminActivities,
      },
    });
  } catch (error) {
    console.error('[DashboardStats Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compute dashboard metrics.',
    });
  }
};

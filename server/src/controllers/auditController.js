import AuditLog from '../models/AuditLog.js';

// @desc    Get paginated audit logs with rich filters
// @route   GET /api/audit-logs
// @access  Private (Permission: audit:read)
export const getAuditLogs = async (req, res) => {
  try {
    const {
      search,
      action,
      category,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 15,
    } = req.query;

    const query = {};

    // Search keyword across actor, target, or details (escaped against ReDoS)
    if (search && search.trim() !== '') {
      const sanitized = search.trim().slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(sanitized, 'i');
      query.$or = [
        { actorEmail: regex },
        { actorName: regex },
        { targetName: regex },
        { action: regex },
        { ipAddress: regex },
      ];
    }

    if (action && action !== 'All') {
      query.action = action;
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('[GetAuditLogs Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log trail.',
    });
  }
};

// @desc    Get audit log statistics and activity breakdown
// @route   GET /api/audit-logs/stats
// @access  Private (Permission: audit:read)
export const getAuditStats = async (req, res) => {
  try {
    const [totalEvents, successCount, failedCount, todayCount] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ status: 'SUCCESS' }),
      AuditLog.countDocuments({ status: 'FAILED' }),
      AuditLog.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        successCount,
        failedCount,
        todayCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit statistics.',
    });
  }
};

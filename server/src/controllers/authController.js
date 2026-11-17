import crypto from 'crypto';
import User from '../models/User.js';
import Role from '../models/Role.js';
import RevokedToken from '../models/RevokedToken.js';
import { logAudit } from '../services/auditService.js';
import { validatePasswordStrength } from '../utils/security.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// @desc    Register a new user / employee
// @route   POST /api/auth/register
// @access  Public
export const register = async (_req, res) => {
  return res.status(403).json({ success: false, message: 'Public self-registration is disabled. Contact an organization administrator.' });
  /* Legacy implementation retained temporarily for reference; unreachable. */
  try {
    const { firstName, lastName, email, password, department, jobTitle } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: first name, last name, email, and password.',
      });
    }

    const emailNormalized = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid corporate email address.',
      });
    }

    // Password strength check
    const pwdCheck = validatePasswordStrength(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        success: false,
        message: pwdCheck.message,
      });
    }

    const existingUser = await User.findOne({ email: emailNormalized });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    // Public self-registration ALWAYS maps strictly to the default Employee role
    let defaultRole = await Role.findOne({ name: 'Employee', isDefault: true });
    if (!defaultRole) {
      defaultRole = await Role.findOne({ isDefault: true }) || await Role.findOne({ name: 'Employee' });
    }

    if (!defaultRole) {
      return res.status(500).json({
        success: false,
        message: 'Default employee role configuration is missing. Contact system administrator.',
      });
    }

    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: emailNormalized,
      password,
      department: department?.trim() || 'Engineering',
      jobTitle: jobTitle?.trim() || 'Software Engineer',
      role: defaultRole._id,
      status: 'Active',
      tokenVersion: 0,
    });

    await user.save();

    // Populate role
    await user.populate({
      path: 'role',
      populate: { path: 'permissions', model: 'Permission' },
    });

    const token = user.generateAuthToken();

    // Log audit
    await logAudit({
      req,
      action: 'USER_REGISTER',
      category: 'AUTH',
      actor: user._id,
      actorEmail: user.email,
      actorName: user.fullName,
      actorRole: user.role?.name || 'Employee',
      targetType: 'User',
      targetId: user._id,
      targetName: user.fullName,
      status: 'SUCCESS',
      details: { email: user.email, role: user.role?.name },
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        employeeId: user.employeeId,
        department: user.department,
        jobTitle: user.jobTitle,
        phone: user.phone,
        location: user.location,
        bio: user.bio,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
    });
  }
};

// @desc    Authenticate user & get JWT token
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user including password
    const user = await User.findOne({ email: normalizedEmail })
      .select('+password')
      .populate({
        path: 'role',
        populate: { path: 'permissions', model: 'Permission' },
      });

    if (!user) {
      await logAudit({
        req,
        action: 'LOGIN_FAILED',
        category: 'AUTH',
        actor: null,
        actorEmail: normalizedEmail,
        actorName: 'Anonymous / Unknown',
        actorRole: 'None',
        targetType: 'Auth',
        targetName: normalizedEmail,
        status: 'FAILED',
        details: { reason: 'User not found' },
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.',
      });
    }

    // 1. Check if account is temporarily locked due to brute-force attempts
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
      const remainingMins = Math.ceil(remainingSeconds / 60);

      await logAudit({
        req,
        action: 'ACCOUNT_LOCKED_ATTEMPT',
        category: 'SECURITY',
        actor: user._id,
        actorEmail: user.email,
        actorName: user.fullName,
        actorRole: user.role?.name || 'User',
        targetType: 'Auth',
        targetName: user.email,
        status: 'FAILED',
        details: { reason: 'Account lockout active', remainingMins },
      });

      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMins} minute(s).`,
      });
    }

    // 2. Check account status
    if (user.status === 'Suspended') {
      await logAudit({
        req,
        action: 'LOGIN_BLOCKED',
        category: 'AUTH',
        actor: user._id,
        actorEmail: user.email,
        actorName: user.fullName,
        actorRole: user.role?.name || 'User',
        targetType: 'Auth',
        status: 'FAILED',
        details: { reason: 'Account is suspended' },
      });

      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by an administrator. Access denied.',
      });
    }

    if (user.status === 'Deactivated') {
      await logAudit({
        req,
        action: 'LOGIN_BLOCKED',
        category: 'AUTH',
        actor: user._id,
        actorEmail: user.email,
        actorName: user.fullName,
        actorRole: user.role?.name || 'User',
        targetType: 'Auth',
        status: 'FAILED',
        details: { reason: 'Account is deactivated' },
      });

      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Access revoked.',
      });
    }

    // An inactive or missing role must not be used to establish a session.
    if (!user.role || user.role.status !== 'Active') {
      await logAudit({
        req,
        action: 'LOGIN_BLOCKED',
        category: 'SECURITY',
        actor: user._id,
        actorEmail: user.email,
        actorName: user.fullName,
        actorRole: user.role?.name || 'Unassigned',
        targetType: 'Auth',
        targetName: user.email,
        status: 'FAILED',
        details: { reason: 'Assigned role is missing or inactive' },
      });
      return res.status(403).json({
        success: false,
        message: 'Your assigned role is inactive or unavailable. Contact your organization administrator.',
      });
    }

    // 3. Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // Check if threshold reached
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await user.save();

        await logAudit({
          req,
          action: 'ACCOUNT_LOCKED',
          category: 'SECURITY',
          actor: user._id,
          actorEmail: user.email,
          actorName: user.fullName,
          actorRole: user.role?.name || 'User',
          targetType: 'Auth',
          targetName: user.email,
          status: 'WARNING',
          details: {
            reason: `Account locked for ${LOCKOUT_MINUTES} minutes after ${user.failedLoginAttempts} failed attempts`,
            lockUntil: user.lockUntil,
          },
        });

        return res.status(423).json({
          success: false,
          message: `Account has been locked for ${LOCKOUT_MINUTES} minutes due to ${MAX_FAILED_ATTEMPTS} consecutive failed login attempts.`,
        });
      }

      await user.save();
      const remainingAttempts = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;

      await logAudit({
        req,
        action: 'LOGIN_FAILED',
        category: 'AUTH',
        actor: user._id,
        actorEmail: user.email,
        actorName: user.fullName,
        actorRole: user.role?.name || 'User',
        targetType: 'Auth',
        targetName: user.email,
        status: 'FAILED',
        details: {
          reason: 'Incorrect password',
          attemptCount: user.failedLoginAttempts,
          remainingAttempts,
        },
      });

      return res.status(401).json({
        success: false,
        message: `Invalid email or password credentials. (${remainingAttempts} attempt(s) remaining before lockout).`,
      });
    }

    // 4. Successful login: reset brute-force counters
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    await user.save();

    const token = user.generateAuthToken();

    // Log successful login
    await logAudit({
      req,
      action: 'LOGIN_SUCCESS',
      category: 'AUTH',
      actor: user._id,
      actorEmail: user.email,
      actorName: user.fullName,
      actorRole: user.role?.name || 'User',
      targetType: 'Auth',
      targetName: user.email,
      status: 'SUCCESS',
      details: {
        role: user.role?.name,
        employeeId: user.employeeId,
      },
    });

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        employeeId: user.employeeId,
        department: user.department,
        jobTitle: user.jobTitle,
        phone: user.phone,
        location: user.location,
        bio: user.bio,
        role: user.role,
        status: user.status,
        lastLogin: user.lastLogin,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login authentication.',
    });
  }
};

// @desc    Logout user & revoke current JWT session on server
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    if (req.token && req.user) {
      // Invalidate current JWT on server-side blacklist
      const expiresAt = req.tokenExpiry || new Date(Date.now() + 7 * 86400 * 1000);
      const tokenHash = crypto.createHash('sha256').update(req.token).digest('hex');
      await RevokedToken.create({
        tokenHash,
        userId: req.user._id,
        reason: 'LOGOUT',
        expiresAt,
      });

      await logAudit({
        req,
        action: 'LOGOUT',
        category: 'AUTH',
        actor: req.user._id,
        actorEmail: req.user.email,
        actorName: req.user.fullName,
        actorRole: req.user.role?.name || 'User',
        targetType: 'Auth',
        status: 'SUCCESS',
        details: { tokenRevoked: true },
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully. Session revoked.',
    });
  } catch (error) {
    console.error('[Logout Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing logout.',
    });
  }
};

// @desc    Get currently authenticated user's profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'role',
      populate: { path: 'permissions', model: 'Permission' },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        employeeId: user.employeeId,
        department: user.department,
        jobTitle: user.jobTitle,
        phone: user.phone,
        location: user.location,
        bio: user.bio,
        role: user.role,
        status: user.status,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current user profile.',
    });
  }
};

// @desc    Change password with complexity enforcement and session invalidation
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current password and new password.',
      });
    }

    // Enforce password complexity
    const pwdCheck = validatePasswordStrength(newPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        success: false,
        message: pwdCheck.message,
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account no longer exists.' });
    }
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      await logAudit({
        req,
        action: 'PASSWORD_CHANGE_FAILED',
        category: 'SECURITY',
        actor: req.user._id,
        actorEmail: req.user.email,
        actorName: req.user.fullName,
        actorRole: req.user.role?.name || 'User',
        targetType: 'User',
        targetId: user._id,
        targetName: user.fullName,
        status: 'FAILED',
        details: { reason: 'Incorrect current password' },
      });

      return res.status(400).json({
        success: false,
        message: 'Current password does not match our records.',
      });
    }

    // Set new password
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    // Increment tokenVersion so all existing tokens issued prior to this are instantly invalid
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.mustChangePassword = false;
    await user.save();

    // Also blacklist current token
    if (req.token) {
      const tokenHash = crypto.createHash('sha256').update(req.token).digest('hex');
      await RevokedToken.create({
        tokenHash,
        userId: user._id,
        reason: 'PASSWORD_CHANGE',
        expiresAt: req.tokenExpiry || new Date(Date.now() + 7 * 86400 * 1000),
      });
    }

    await logAudit({
      req,
      action: 'PASSWORD_CHANGE',
      category: 'SECURITY',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: req.user.role?.name || 'User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.fullName,
      status: 'SUCCESS',
      details: { timestamp: new Date(), sessionsRevoked: true },
    });

    res.json({
      success: true,
      message: 'Password has been updated successfully. All previous sessions have been revoked. Please sign in with your new credentials.',
    });
  } catch (error) {
    console.error('[ChangePassword Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating password.',
    });
  }
};

// @desc    Update employee self personal profile
// @route   PUT /api/auth/update-profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { phone, bio, location } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (phone !== undefined) user.phone = String(phone).slice(0, 30);
    if (bio !== undefined) user.bio = String(bio).slice(0, 500);
    if (location !== undefined) user.location = String(location).slice(0, 100);

    await user.save();
    await user.populate({
      path: 'role',
      populate: { path: 'permissions', model: 'Permission' },
    });

    await logAudit({
      req,
      action: 'PROFILE_UPDATED',
      category: 'USER_MGMT',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: user.fullName,
      actorRole: user.role?.name || 'User',
      targetType: 'User',
      targetId: user._id,
      targetName: user.fullName,
      status: 'SUCCESS',
      details: { updatedFields: { phone: user.phone, bio: user.bio, location: user.location } },
    });

    res.json({
      success: true,
      message: 'Profile information updated successfully.',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        employeeId: user.employeeId,
        department: user.department,
        jobTitle: user.jobTitle,
        phone: user.phone,
        location: user.location,
        bio: user.bio,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating profile.',
    });
  }
};

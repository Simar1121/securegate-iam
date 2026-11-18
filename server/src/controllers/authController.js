import crypto from 'crypto';
import User from '../models/User.js';
import Role from '../models/Role.js';
import RevokedToken from '../models/RevokedToken.js';
import { logAudit } from '../services/auditService.js';
import { validatePasswordStrength } from '../utils/security.js';
import AuthChallenge from '../models/AuthChallenge.js';
import Invitation from '../models/Invitation.js';
import { sendLoginOtpEmail } from '../services/emailService.js';


const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashOtp = (challengeId, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`${challengeId}:${code}`)
    .digest('hex');

const maskEmail = (email) => {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return 'your registered email';
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
};

const serializeAuthenticatedUser = (user) => ({
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
});

const deliverLoginChallenge = async (user, req, res) => {
  const now = new Date();
  await AuthChallenge.updateMany(
    { userId: user._id, purpose: 'LOGIN_OTP', consumedAt: null },
    { $set: { consumedAt: now } }
  );

  const challengeId = crypto.randomBytes(32).toString('hex');
  const code = crypto.randomInt(100000, 1000000).toString();
  const challenge = await AuthChallenge.create({
    userId: user._id,
    challengeIdHash: sha256(challengeId),
    codeHash: hashOtp(challengeId, code),
    purpose: 'LOGIN_OTP',
    attempts: 0,
    lastSentAt: now,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
  });

  try {
    await sendLoginOtpEmail({ to: user.email, firstName: user.firstName, code, expiresInMinutes: 5 });
  } catch (error) {
    await AuthChallenge.updateOne({ _id: challenge._id }, { $set: { consumedAt: new Date() } });
    console.error('[Login OTP Email Error]:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Unable to deliver the sign-in verification email. Contact your administrator or try again later.',
    });
  }

  await logAudit({
    req,
    action: 'LOGIN_OTP_SENT',
    category: 'AUTH',
    actor: user._id,
    actorEmail: user.email,
    actorName: user.fullName,
    actorRole: user.role?.name || 'User',
    targetType: 'Auth',
    targetName: user.email,
    status: 'SUCCESS',
    details: { method: 'EMAIL', expiresInSeconds: 300 },
  });

  return res.status(200).json({
    success: true,
    requiresOtp: true,
    message: 'A verification code has been sent to your registered email address.',
    challengeId,
    maskedEmail: maskEmail(user.email),
    expiresInSeconds: 300,
    resendAfterSeconds: 45,
  });
};


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
    const { email, identifier, password } = req.body || {};
    const loginIdentifier = String(identifier || email || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your registered email or employee ID and password.',
      });
    }

    const normalizedIdentifier = loginIdentifier.toLowerCase();
    const identityQuery = {
      $or: [
        { email: normalizedIdentifier },
        { employeeId: loginIdentifier.toUpperCase() },
      ],
    };

    // Find user including password. Email and employee ID are both supported.
    const user = await User.findOne(identityQuery)
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
        actorEmail: normalizedIdentifier,
        actorName: 'Anonymous / Unknown',
        actorRole: 'None',
        targetType: 'Auth',
        targetName: normalizedIdentifier,
        status: 'FAILED',
        details: { reason: 'User not found' },
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.',
      });
    }

    if (user.invitationPending) {
      return res.status(403).json({
        success: false,
        message: 'Your employee invitation is still pending. Open the invitation email and set your password before signing in.',
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

    // Password verification is only the first factor. No access JWT is
    // issued and lastLogin is not updated until the email OTP is verified.
    return await deliverLoginChallenge(user, req, res);
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

 
// @desc    Verify the email OTP and issue the authenticated session
// @route   POST /api/auth/login/verify-otp
// @access  Public (challenge-bound)
export const verifyLoginOtp = async (req, res) => {
  try {
    const { challengeId, code } = req.body || {};
    if (typeof challengeId !== 'string' || !/^[a-f0-9]{64}$/i.test(challengeId) ||
        typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Enter the six-digit verification code.' });
    }

    const now = new Date();
    const challengeIdHash = sha256(challengeId);
    const challenge = await AuthChallenge.findOne({
      challengeIdHash,
      purpose: 'LOGIN_OTP',
      consumedAt: null,
      expiresAt: { $gt: now },
    });

    if (!challenge) {
      return res.status(400).json({ success: false, message: 'The verification challenge is invalid or has expired. Sign in again.' });
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect verification codes. Sign in again to request a new code.' });
    }

    const expected = Buffer.from(challenge.codeHash, 'hex');
    const supplied = Buffer.from(hashOtp(challengeId, code), 'hex');
    const matches = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);

    if (!matches) {
      const nextAttempts = challenge.attempts + 1;
      const update = { $inc: { attempts: 1 } };
      if (nextAttempts >= OTP_MAX_ATTEMPTS) update.$set = { consumedAt: now };
      await AuthChallenge.updateOne(
        { _id: challenge._id, consumedAt: null, attempts: challenge.attempts },
        update
      );
      await logAudit({
        req, action: 'LOGIN_OTP_FAILED', category: 'SECURITY',
        actor: challenge.userId, actorEmail: 'unknown', actorName: 'Authentication challenge',
        actorRole: 'Unknown', targetType: 'Auth', status: 'FAILED',
        details: { attemptCount: nextAttempts, maxAttempts: OTP_MAX_ATTEMPTS },
      });
      return res.status(nextAttempts >= OTP_MAX_ATTEMPTS ? 429 : 401).json({
        success: false,
        message: nextAttempts >= OTP_MAX_ATTEMPTS
          ? 'Too many incorrect verification codes. Sign in again to request a new code.'
          : `Incorrect verification code. ${OTP_MAX_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
      });
    }

    // Atomic consume ensures a correct OTP can only produce one session.
    const consumed = await AuthChallenge.findOneAndUpdate(
      { _id: challenge._id, codeHash: challenge.codeHash, consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $set: { consumedAt: now } },
      { new: true }
    );
    if (!consumed) {
      return res.status(409).json({ success: false, message: 'This verification code has already been used. Sign in again.' });
    }

    const user = await User.findById(consumed.userId).populate({
      path: 'role',
      populate: { path: 'permissions', model: 'Permission' },
    });
    if (!user || user.invitationPending || user.status !== 'Active' || !user.role || user.role.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'This account is not currently permitted to sign in.' });
    }
    if (user.lockUntil && user.lockUntil > now) {
      return res.status(423).json({ success: false, message: 'This account is temporarily locked. Try again after the lockout period.' });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = now;
    if (!user.emailVerifiedAt) user.emailVerifiedAt = now;
    await user.save();

    const token = user.generateAuthToken();
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
      details: { role: user.role?.name, employeeId: user.employeeId, mfa: 'EMAIL_OTP' },
    });

    return res.json({
      success: true,
      message: 'Multi-factor authentication successful.',
      token,
      user: serializeAuthenticatedUser(user),
    });
  } catch (error) {
    console.error('[Verify Login OTP Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to verify the sign-in code.' });
  }
};

// @desc    Resend the current sign-in OTP
// @route   POST /api/auth/login/resend-otp
// @access  Public (challenge-bound)
export const resendLoginOtp = async (req, res) => {
  try {
    const { challengeId } = req.body || {};
    if (typeof challengeId !== 'string' || !/^[a-f0-9]{64}$/i.test(challengeId)) {
      return res.status(400).json({ success: false, message: 'Invalid verification challenge. Sign in again.' });
    }

    const now = new Date();
    const challenge = await AuthChallenge.findOne({
      challengeIdHash: sha256(challengeId), purpose: 'LOGIN_OTP',
      consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: OTP_MAX_ATTEMPTS },
    });
    if (!challenge) {
      return res.status(400).json({ success: false, message: 'The verification challenge is invalid or expired. Sign in again.' });
    }

    const waitMs = OTP_RESEND_COOLDOWN_MS - (now.getTime() - challenge.lastSentAt.getTime());
    if (waitMs > 0) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another code.',
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      });
    }

    const user = await User.findById(challenge.userId);
    if (!user || user.status !== 'Active' || user.invitationPending) {
      return res.status(403).json({ success: false, message: 'This account is not currently permitted to sign in.' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const updated = await AuthChallenge.updateOne(
      { _id: challenge._id, consumedAt: null, lastSentAt: challenge.lastSentAt },
      { $set: {
        codeHash: hashOtp(challengeId, code),
        attempts: 0,
        lastSentAt: now,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      } }
    );
    if (!updated.modifiedCount) {
      return res.status(409).json({ success: false, message: 'The verification challenge changed. Request a new sign-in.' });
    }

    try {
      await sendLoginOtpEmail({ to: user.email, firstName: user.firstName, code, expiresInMinutes: 5 });
    } catch (error) {
      await AuthChallenge.updateOne({ _id: challenge._id }, { $set: { consumedAt: new Date() } });
      console.error('[Resend Login OTP Email Error]:', error.message);
      return res.status(503).json({ success: false, message: 'Unable to deliver the verification email. Sign in again later.' });
    }

    return res.json({
      success: true,
      message: 'A new verification code has been sent.',
      maskedEmail: maskEmail(user.email),
      expiresInSeconds: 300,
      resendAfterSeconds: 45,
    });
  } catch (error) {
    console.error('[Resend Login OTP Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to resend the verification code.' });
  }
};

// @desc    Accept an employee invitation, verify email and set an initial password
// @route   POST /api/auth/invitations/accept
// @access  Public (one-time invitation token)
export const acceptInvitation = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired invitation link.' });
    }
    if (typeof password !== 'string' || typeof confirmPassword !== 'string' || password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Enter matching password and confirmation.' });
    }
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ success: false, message: passwordCheck.message });
    }

    const now = new Date();
    const invitation = await Invitation.findOneAndUpdate(
      { tokenHash: sha256(token), acceptedAt: null, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { acceptedAt: now } },
      { new: true }
    );
    if (!invitation) {
      return res.status(400).json({ success: false, message: 'This invitation is invalid, expired or already used. Contact your administrator for a new invitation.' });
    }

    const user = await User.findById(invitation.userId).select('+password');
    if (!user || !user.invitationPending) {
      return res.status(409).json({ success: false, message: 'This employee invitation is no longer active.' });
    }

    user.password = password;
    user.invitationPending = false;
    user.emailVerifiedAt = now;
    user.mustChangePassword = false;
    user.passwordChangedAt = now;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await logAudit({
      req, action: 'INVITATION_ACCEPTED', category: 'AUTH',
      actor: user._id, actorEmail: user.email, actorName: user.fullName,
      actorRole: 'Employee', targetType: 'User', targetId: user._id,
      targetName: user.fullName, status: 'SUCCESS',
      details: { emailVerified: true, passwordSet: true },
    });

    return res.json({ success: true, message: 'Your email has been verified and password set. You can now sign in with email OTP verification.' });
  } catch (error) {
    console.error('[Accept Invitation Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to accept the invitation.' });
  }
};

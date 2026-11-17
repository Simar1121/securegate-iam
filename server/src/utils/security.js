import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * Validate password complexity:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character
 */
export const validatePasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      message: 'Password is required and must be a valid string.',
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long.',
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      message: 'Password exceeds maximum allowed length of 128 characters.',
    };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return {
      valid: false,
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    };
  }

  return { valid: true };
};

/**
 * Generates a cryptographically strong, non-predictable temporary password
 * satisfying all password policy rules.
 */
export const generateSecureTemporaryPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const specials = '!@#$%^&*-_=+';
  const all = upper + lower + digits + specials;

  // Ensure at least one of each character category
  let password = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    specials[crypto.randomInt(0, specials.length)],
  ];

  // Fill remaining characters up to 14
  for (let i = 4; i < 14; i++) {
    password.push(all[crypto.randomInt(0, all.length)]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
};

/**
 * Validates whether a given string is a valid MongoDB ObjectId
 */
export const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
};

/**
 * Recursively sanitizes audit log details by scrubbing passwords, tokens, and secrets
 */
export const sanitizeAuditDetails = (obj, visited = new WeakSet()) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) return obj;
  if (Buffer.isBuffer(obj)) return '[BINARY REDACTED]';

  // Prevent circular reference crash
  if (visited.has(obj)) {
    return '[Circular]';
  }
  visited.add(obj);

  const sensitiveKeys = new Set([
    'password',
    'newpassword',
    'currentpassword',
    'confirmpassword',
    'passwordhash',
    'token',
    'refreshtoken',
    'jwt',
    'secret',
    'authorization',
    'bearer',
    'cookie',
    'creditcard',
    'ssn',
  ]);

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeAuditDetails(item, visited));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
    if (sensitiveKeys.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditDetails(value, visited);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

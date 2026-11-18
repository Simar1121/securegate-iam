import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email address',
      ],
    },
    password: {
      type: String,
      required: function passwordRequired() { return !this.invitationPending; },
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Never return password hash by default
    },
    invitationPending: { type: Boolean, default: false, index: true },
    emailVerifiedAt: { type: Date, default: null },
    employeeId: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    department: {
      type: String,
      trim: true,
      default: 'Engineering',
    },
    jobTitle: {
      type: String,
      trim: true,
      default: 'Team Member',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: 'Headquarters',
    },
    bio: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'User role is required'],
    },
    status: {
      type: String,
      enum: ['Active', 'Suspended', 'Deactivated'],
      default: 'Active',
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes for fast searching and filtering
userSchema.index({ status: 1 });
userSchema.index({ department: 1 });
userSchema.index({ role: 1 });

// Pre-save middleware: hash password if modified
userSchema.pre('save', async function (next) {
  if (!this.employeeId) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.employeeId = `SEC-${randomNum}`;
  }

  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method: Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method: Generate JWT token
userSchema.methods.generateAuthToken = function (deviceIdHash) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing or insecure (must be at least 32 characters).');
  }

  if (typeof deviceIdHash !== 'string' || !/^[a-f0-9]{64}$/i.test(deviceIdHash)) {
    throw new Error('A trusted device binding is required before issuing an access token.');
  }

  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
      tokenVersion: this.tokenVersion || 0,
      mfaVerified: true,
      deviceIdHash,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

const User = mongoose.model('User', userSchema);
export default User;

import mongoose from 'mongoose';

const revokedTokenSchema = new mongoose.Schema(
  {
    // SHA-256 digest of the JWT. Do not store reusable bearer tokens in plaintext.
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    // Legacy field retained only so older revocation records remain readable.
    // New code must never write this field.
    token: {
      type: String,
      select: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ['LOGOUT', 'PASSWORD_CHANGE', 'SESSION_REVOCATION', 'STATUS_CHANGE'],
      default: 'LOGOUT',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RevokedToken = mongoose.model('RevokedToken', revokedTokenSchema);
export default RevokedToken;

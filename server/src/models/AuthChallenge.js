import mongoose from 'mongoose';

const authChallengeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  challengeIdHash: { type: String, required: true, unique: true },
  codeHash: { type: String, required: true },
  purpose: { type: String, enum: ['LOGIN_OTP'], default: 'LOGIN_OTP', required: true },
  attempts: { type: Number, default: 0, min: 0 },
  resends: { type: Number, default: 0, min: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });

authChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authChallengeSchema.index({ userId: 1, purpose: 1, consumedAt: 1 });

export default mongoose.model('AuthChallenge', authChallengeSchema);

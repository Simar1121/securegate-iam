import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationSchema.index({ userId: 1, acceptedAt: 1 });

export default mongoose.model('Invitation', invitationSchema);

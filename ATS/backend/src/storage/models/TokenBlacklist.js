import mongoose from 'mongoose';

const TokenBlacklistSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: false },
    expiresAt: { type: Date, required: true, index: true },
    reason: { type: String, default: null }
  },
  { timestamps: true }
);

TokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TokenBlacklist = mongoose.model('TokenBlacklist', TokenBlacklistSchema);

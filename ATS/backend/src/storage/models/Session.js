import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    refreshTokenHash: { type: String, required: true },

    deviceId: { type: String, required: true, index: true },
    ipAddress: { type: String, required: false },
    userAgent: { type: String, required: false },
    deviceType: { type: String, required: false },
    location: { type: String, required: false },

    createdAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },

    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, default: null }
  },
  { timestamps: false }
);

SessionSchema.index({ userId: 1, deviceId: 1 });

export const Session = mongoose.model('Session', SessionSchema);

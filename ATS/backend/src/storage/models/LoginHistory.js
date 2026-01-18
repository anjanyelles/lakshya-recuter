import mongoose from 'mongoose';

const LoginHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },
    loginTime: { type: Date, required: true, default: Date.now, index: true },
    ipAddress: { type: String, required: false },
    userAgent: { type: String, required: false },
    deviceType: { type: String, required: false },
    location: { type: String, required: false },
    success: { type: Boolean, default: true },
    failureReason: { type: String, default: null }
  },
  { timestamps: false }
);

LoginHistorySchema.index({ userId: 1, loginTime: -1 });

export const LoginHistory = mongoose.model('LoginHistory', LoginHistorySchema);

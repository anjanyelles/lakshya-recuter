import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, default: 'recruiter', index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },

    isEmailVerified: { type: Boolean, default: false, index: true },

    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    lastLogin: { type: Date, default: null }
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model('User', UserSchema);

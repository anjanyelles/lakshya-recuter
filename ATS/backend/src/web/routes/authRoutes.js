import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import UAParser from 'ua-parser-js';
import { z } from 'zod';
import crypto from 'crypto';

import {
  findUserByEmail,
  findUserById,
  updateUserLoginFailure,
  updateUserLoginSuccess,
  updateUserPasswordHash
} from '../../storage/repositories/userRepo.js';
import { createSession, findSessionByRefresh, revokeSession } from '../../storage/repositories/sessionRepo.js';
import { recordLoginHistory } from '../../storage/repositories/loginHistoryRepo.js';
import { blacklistToken } from '../../storage/repositories/tokenBlacklistRepo.js';
import {
  createPasswordResetToken,
  findValidPasswordResetToken,
  invalidateAllResetTokensForUser,
  markPasswordResetTokenUsed
} from '../../storage/repositories/passwordResetRepo.js';
import { addPasswordHistory, getRecentPasswordHashes, trimPasswordHistory } from '../../storage/repositories/passwordHistoryRepo.js';
import { sanitizeUserRow } from '../../storage/sanitizeUser.js';
import { sha256 } from '../../security/hash.js';
import { verifyCaptcha } from '../../security/captcha.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../security/tokens.js';
import { evaluatePasswordStrength } from '../../security/passwordPolicy.js';
import { authRequired } from '../middleware/authMiddleware.js';
import { permissionsForRole } from '../../domain/permissions.js';
import { sendEmail } from '../../email/emailSender.js';
import { passwordChangedEmail, passwordResetEmail } from '../../email/templates.js';

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.ip;
}

function tokenTtls({ rememberMe }) {
  const accessSeconds = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  const refreshSeconds = accessSeconds;
  return {
    accessSeconds,
    refreshSeconds
  };
}

export function authRouter({ logger }) {
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Try again later.' }
  });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    rememberMe: z.boolean().optional().default(false),
    captchaToken: z.string().optional()
  });

  const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many password reset requests. Try again later.' }
  });

  const forgotPasswordSchema = z.object({
    email: z.string().email()
  });

  const resetPasswordSchema = z.object({
    token: z.string().uuid(),
    newPassword: z.string().min(1)
  });

  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1)
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const ipAddress = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '');
    const ua = new UAParser(userAgent).getResult();
    const deviceType = ua.device?.type || 'desktop';

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
    }

    const { email, password, rememberMe, captchaToken } = parsed.data;

    const normalizedEmail = email.toLowerCase();
    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      await recordLoginHistory({
        userId: null,
        ipAddress,
        userAgent,
        deviceType,
        location: null,
        success: false,
        failureReason: 'user_not_found'
      });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.lock_until && new Date(user.lock_until).getTime() > Date.now()) {
      return res.status(423).json({ message: 'Account locked. Try later.' });
    }

    if (!user.is_email_verified) {
      return res.status(403).json({ message: 'Email not verified' });
    }

    if ((user.failed_login_attempts || 0) >= 3) {
      const captcha = await verifyCaptcha({ token: captchaToken });
      if (!captcha.ok) {
        await recordLoginHistory({
          userId: user.id,
          ipAddress,
          userAgent,
          deviceType,
          location: null,
          success: false,
          failureReason: `captcha:${captcha.reason}`
        });
        return res.status(412).json({
          message: 'CAPTCHA required',
          captchaRequired: true,
          reason: captcha.reason
        });
      }
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = newFailedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await updateUserLoginFailure({ userId: user.id, lockUntil });

      await recordLoginHistory({
        userId: user.id,
        ipAddress,
        userAgent,
        deviceType,
        location: null,
        success: false,
        failureReason: 'bad_password'
      });

      const captchaRequired = newFailedAttempts >= 3;
      return res.status(401).json({
        message: 'Invalid email or password',
        failedAttempts: newFailedAttempts,
        captchaRequired
      });
    }

    await updateUserLoginSuccess({ userId: user.id });

    const deviceId = sha256(`${user.id}:${userAgent}:${ipAddress}`);

    const { refreshSeconds, accessSeconds } = tokenTtls({ rememberMe });

    const refresh = signRefreshToken({
      payload: {
        userId: String(user.id),
        email: user.email,
        role: user.role,
        companyId: user.company_id ? String(user.company_id) : null
      },
      expiresInSeconds: refreshSeconds
    });

    const session = await createSession({
      userId: user.id,
      refreshTokenHash: sha256(refresh.token),
      deviceId,
      ipAddress,
      userAgent,
      deviceType,
      location: null,
      expiresAt: new Date(Date.now() + refreshSeconds * 1000)
    });

    const access = signAccessToken({
      payload: {
        userId: String(user.id),
        email: user.email,
        role: user.role,
        companyId: user.company_id ? String(user.company_id) : null,
        sid: String(session.id)
      },
      expiresInSeconds: accessSeconds
    });

    await recordLoginHistory({
      userId: user.id,
      ipAddress,
      userAgent,
      deviceType,
      location: null,
      success: true,
      failureReason: null
    });

    res.cookie('refreshToken', refresh.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshSeconds * 1000
    });

    return res.json({
      token: access.token,
      expiresIn: accessSeconds,
      user: {
        ...sanitizeUserRow(user),
        permissions: permissionsForRole(user.role)
      }
    });
  });

  router.post('/logout', authRequired({ logger }), async (req, res) => {
    const { jti, sid, userId } = req.auth;

    await revokeSession({ sessionId: sid, reason: 'logout' });

    const bearer = String(req.headers.authorization || '');
    const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : null;
    let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (token) {
      try {
        const [, payloadB64] = token.split('.');
        const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (decoded?.exp) expiresAt = new Date(decoded.exp * 1000);
      } catch {
        // ignore
      }
    }
    await blacklistToken({ jti, userId, expiresAt, reason: 'logout' });

    res.clearCookie('refreshToken');
    return res.json({ message: 'Logged out' });
  });

  router.get('/me', authRequired({ logger }), async (req, res) => {
    const user = await findUserById(req.auth.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({
      user: {
        ...sanitizeUserRow(user),
        permissions: permissionsForRole(user.role)
      }
    });
  });

  router.post('/refresh', async (req, res) => {
    const token = req.cookies.refreshToken || req.body?.refreshToken;
    if (!token) return res.status(401).json({ message: 'Missing refresh token' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const tokenHash = sha256(token);
    const session = await findSessionByRefresh({
      userId: payload.userId,
      refreshTokenHash: tokenHash
    });

    if (!session || session.revoked_at) return res.status(401).json({ message: 'Session revoked' });
    if (new Date(session.expires_at).getTime() < Date.now()) return res.status(401).json({ message: 'Session expired' });

    const accessMinutes = Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15);
    const accessSeconds = accessMinutes * 60;

    const access = signAccessToken({
      payload: {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId || null,
        sid: String(session.id)
      },
      expiresInSeconds: accessSeconds
    });

    return res.json({ token: access.token, expiresIn: accessSeconds });
  });

  router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(200).json({ message: 'If the email exists, a reset link will be sent.' });
    }

    const email = parsed.data.email.toLowerCase();
    const user = await findUserByEmail(email);

    if (user) {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await invalidateAllResetTokensForUser({ userId: user.id });
      await createPasswordResetToken({ token, userId: user.id, expiresAt });

      const base = process.env.APP_BASE_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173';
      const resetLink = `${base.replace(/\/$/, '')}/reset-password?token=${token}`;

      const msg = passwordResetEmail({ toEmail: user.email, resetLink });
      await sendEmail({ logger, ...msg });
    }

    return res.status(200).json({ message: 'If the email exists, a reset link will be sent.' });
  });

  router.post('/reset-password', async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
    }

    const { token, newPassword } = parsed.data;
    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.ok) {
      return res.status(400).json({ message: 'Password does not meet requirements', details: strength });
    }

    const reset = await findValidPasswordResetToken({ token });
    if (!reset) return res.status(400).json({ message: 'Invalid or expired token' });

    const user = await findUserById(reset.user_id);
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    const recent = await getRecentPasswordHashes({ userId: user.id, limit: 5 });
    const allToCheck = [user.password_hash, ...recent];
    for (const h of allToCheck) {
      // eslint-disable-next-line no-await-in-loop
      const same = await bcrypt.compare(newPassword, h);
      if (same) {
        return res.status(400).json({ message: 'You cannot reuse a recent password' });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await addPasswordHistory({ userId: user.id, passwordHash: user.password_hash });
    await updateUserPasswordHash({ userId: user.id, passwordHash: newHash });
    await addPasswordHistory({ userId: user.id, passwordHash: newHash });
    await trimPasswordHistory({ userId: user.id, keep: 5 });

    await markPasswordResetTokenUsed({ token });
    await invalidateAllResetTokensForUser({ userId: user.id });

    const msg = passwordChangedEmail({ toEmail: user.email });
    await sendEmail({ logger, ...msg });

    return res.json({ message: 'Password reset successful' });
  });

  router.post('/change-password', authRequired({ logger }), async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
    }

    const { currentPassword, newPassword } = parsed.data;
    const user = await findUserById(req.auth.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    const sameAsCurrent = await bcrypt.compare(newPassword, user.password_hash);
    if (sameAsCurrent) return res.status(400).json({ message: 'New password must differ from current password' });

    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.ok) {
      return res.status(400).json({ message: 'Password does not meet requirements', details: strength });
    }

    const recent = await getRecentPasswordHashes({ userId: user.id, limit: 5 });
    const allToCheck = [user.password_hash, ...recent];
    for (const h of allToCheck) {
      // eslint-disable-next-line no-await-in-loop
      const reused = await bcrypt.compare(newPassword, h);
      if (reused) return res.status(400).json({ message: 'You cannot reuse a recent password' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await addPasswordHistory({ userId: user.id, passwordHash: user.password_hash });
    await updateUserPasswordHash({ userId: user.id, passwordHash: newHash });
    await addPasswordHistory({ userId: user.id, passwordHash: newHash });
    await trimPasswordHistory({ userId: user.id, keep: 5 });

    await invalidateAllResetTokensForUser({ userId: user.id });

    const msg = passwordChangedEmail({ toEmail: user.email });
    await sendEmail({ logger, ...msg });

    return res.json({ message: 'Password changed successfully' });
  });

  return router;
}

import { verifyAccessToken } from '../../security/tokens.js';
import { isBlacklisted } from '../../storage/repositories/tokenBlacklistRepo.js';
import { findSessionById, revokeSession, updateSessionActivity } from '../../storage/repositories/sessionRepo.js';

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export function authRequired({ logger }) {
  return async function authMiddleware(req, res, next) {
    try {
      const token = getBearerToken(req);
      if (!token) return res.status(401).json({ message: 'Missing token' });

      const payload = verifyAccessToken(token);

      const blacklisted = await isBlacklisted({ jti: payload.jti });
      if (blacklisted) return res.status(401).json({ message: 'Token revoked' });

      if (!payload.sid) return res.status(401).json({ message: 'Invalid session' });

      const session = await findSessionById(payload.sid);
      if (!session || session.revoked_at) return res.status(401).json({ message: 'Session revoked' });

      const inactivityMinutes = Number(process.env.INACTIVITY_TIMEOUT_MINUTES || 30);
      const now = Date.now();
      const last = session.last_activity_at ? new Date(session.last_activity_at).getTime() : 0;
      const inactiveMs = now - last;
      if (inactiveMs > inactivityMinutes * 60 * 1000) {
        await revokeSession({ sessionId: payload.sid, reason: 'inactivity_timeout' });
        return res.status(401).json({ message: 'Session expired due to inactivity' });
      }

      await updateSessionActivity({ sessionId: payload.sid });

      req.auth = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId || null,
        sid: payload.sid,
        jti: payload.jti
      };

      return next();
    } catch (err) {
      if (logger) logger.warn({ err }, 'auth middleware failed');
      return res.status(401).json({ message: 'Unauthorized' });
    }
  };
}

export function authOptional({ logger }) {
  return async function authOptionalMiddleware(req, _res, next) {
    try {
      const token = getBearerToken(req);
      if (!token) {
        req.auth = null;
        return next();
      }

      const payload = verifyAccessToken(token);
      const blacklisted = await isBlacklisted({ jti: payload.jti });
      if (blacklisted) {
        req.auth = null;
        return next();
      }
      if (!payload.sid) {
        req.auth = null;
        return next();
      }

      const session = await findSessionById(payload.sid);
      if (!session || session.revoked_at) {
        req.auth = null;
        return next();
      }

      const inactivityMinutes = Number(process.env.INACTIVITY_TIMEOUT_MINUTES || 30);
      const now = Date.now();
      const last = session.last_activity_at ? new Date(session.last_activity_at).getTime() : 0;
      const inactiveMs = now - last;
      if (inactiveMs > inactivityMinutes * 60 * 1000) {
        await revokeSession({ sessionId: payload.sid, reason: 'inactivity_timeout' });
        req.auth = null;
        return next();
      }

      await updateSessionActivity({ sessionId: payload.sid });

      req.auth = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId || null,
        sid: payload.sid,
        jti: payload.jti
      };

      return next();
    } catch (err) {
      if (logger) logger.warn({ err }, 'auth optional middleware failed');
      req.auth = null;
      return next();
    }
  };
}

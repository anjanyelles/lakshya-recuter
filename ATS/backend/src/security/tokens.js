import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

export function signAccessToken({ payload, expiresInSeconds }) {
  const jti = nanoid();
  const token = jwt.sign(
    { ...payload, jti, typ: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: expiresInSeconds }
  );
  return { token, jti };
}

export function signRefreshToken({ payload, expiresInSeconds }) {
  const jti = nanoid();
  const token = jwt.sign(
    { ...payload, jti, typ: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: expiresInSeconds }
  );
  return { token, jti };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

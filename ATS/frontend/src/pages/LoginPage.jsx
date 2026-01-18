import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth/useAuth.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, user, captchaRequired } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const roleRedirect = useMemo(() => {
    if (!user?.role) return '/';
    if (user.role === 'admin') return '/';
    if (user.role === 'recruiter') return '/';
    if (user.role === 'hiring_manager') return '/';
    return '/';
  }, [user]);

  async function onSubmit(e) {
    e.preventDefault();
    const ok = await login({ email, password, rememberMe, captchaToken });
    if (ok) navigate(roleRedirect, { replace: true });
  }

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', fontFamily: 'system-ui' }}>
      <h2>Login</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={{ width: '100%', padding: 10 }}
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            style={{ width: '100%', padding: 10 }}
          />
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember me
        </label>

        <button disabled={loading} type="submit" style={{ padding: 10 }}>
          {loading ? 'Signing in...' : 'Login'}
        </button>

        {captchaRequired ? (
          <label>
            CAPTCHA token
            <input
              value={captchaToken}
              onChange={(e) => setCaptchaToken(e.target.value)}
              placeholder="Paste CAPTCHA token here"
              style={{ width: '100%', padding: 10 }}
            />
          </label>
        ) : null}

        <Link to="/forgot-password">Forgot password</Link>

        {error ? (
          <div style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{String(error)}</div>
        ) : null}
      </form>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/auth/useAuth.js';
import PasswordInput from '../components/password/PasswordInput.jsx';

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [search] = useSearchParams();
  const token = search.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const canSubmit = useMemo(() => token && newPassword && newPassword === confirm, [token, newPassword, confirm]);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await resetPassword({ token, newPassword });
      setMessage('Password reset successful. You can now log in.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '60px auto', fontFamily: 'system-ui' }}>
      <h2>Reset password</h2>

      {!token ? <div style={{ color: 'crimson' }}>Missing token.</div> : null}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <PasswordInput label="New password" value={newPassword} onChange={setNewPassword} showStrength />
        <PasswordInput label="Confirm password" value={confirm} onChange={setConfirm} />

        <button disabled={!canSubmit || loading} type="submit" style={{ padding: 10 }}>
          {loading ? 'Resetting...' : 'Reset password'}
        </button>

        <Link to="/login">Back to login</Link>

        {message ? <div style={{ color: 'green' }}>{message}</div> : null}
        {error ? <div style={{ color: 'crimson' }}>{String(error)}</div> : null}
      </form>
    </div>
  );
}

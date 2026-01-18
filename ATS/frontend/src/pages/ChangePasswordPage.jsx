import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth/useAuth.js';
import PasswordInput from '../components/password/PasswordInput.jsx';

export default function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const canSubmit = useMemo(
    () => currentPassword && newPassword && newPassword === confirm,
    [currentPassword, newPassword, confirm]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await changePassword({ currentPassword, newPassword });
      setMessage('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setTimeout(() => navigate('/', { replace: true }), 800);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Change failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '60px auto', fontFamily: 'system-ui' }}>
      <h2>Change password</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <PasswordInput label="Current password" value={currentPassword} onChange={setCurrentPassword} />
        <PasswordInput label="New password" value={newPassword} onChange={setNewPassword} showStrength />
        <PasswordInput label="Confirm password" value={confirm} onChange={setConfirm} />

        <button disabled={!canSubmit || loading} type="submit" style={{ padding: 10 }}>
          {loading ? 'Saving...' : 'Change password'}
        </button>

        {message ? <div style={{ color: 'green' }}>{message}</div> : null}
        {error ? <div style={{ color: 'crimson' }}>{String(error)}</div> : null}
      </form>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/auth/useAuth.js';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await forgotPassword({ email });
      setMessage('If the email exists, a reset link will be sent.');
    } catch (err) {
      setError(err?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: '60px auto', fontFamily: 'system-ui' }}>
      <h2>Forgot password</h2>
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

        <button disabled={loading} type="submit" style={{ padding: 10 }}>
          {loading ? 'Sending...' : 'Send reset link'}
        </button>

        <Link to="/login">Back to login</Link>

        {message ? <div style={{ color: 'green' }}>{message}</div> : null}
        {error ? <div style={{ color: 'crimson' }}>{String(error)}</div> : null}
      </form>
    </div>
  );
}

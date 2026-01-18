import { useAuth } from '../state/auth/useAuth.js';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>Dashboard</h2>
      <pre style={{ background: '#f5f5f5', padding: 12 }}>
        {JSON.stringify(user, null, 2)}
      </pre>
      <button onClick={logout} style={{ padding: 10 }}>
        Logout
      </button>
    </div>
  );
}

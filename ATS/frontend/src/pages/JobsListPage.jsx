import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/auth/useAuth.js';

export default function JobsListPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const api = useMemo(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    async function request(path, opts = {}) {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + path, {
        ...opts,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(opts.headers || {})
        },
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Request failed');
      return data;
    }
    return { request };
  }, []);

  async function loadJobs() {
    const res = await api.request('/api/jobs');
    setJobs(res.jobs || []);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.request('/api/jobs');
        if (!cancelled) setJobs(res.jobs || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (!user) return null;

  async function runAction(job, action) {
    setError(null);
    setBusyId(job.id);
    try {
      if (action === 'duplicate') {
        const res = await api.request(`/api/jobs/${job.id}/duplicate`, { method: 'POST' });
        await loadJobs();
        return res?.job?.id;
      }

      if (action === 'pause') {
        await api.request(`/api/jobs/${job.id}/pause`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
        await loadJobs();
        return null;
      }

      if (action === 'close') {
        await api.request(`/api/jobs/${job.id}/close`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notifyApplicants: true })
        });
        await loadJobs();
        return null;
      }

      if (action === 'reopen') {
        await api.request(`/api/jobs/${job.id}/reopen`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        await loadJobs();
        return null;
      }

      if (action === 'archive') {
        await api.request(`/api/jobs/${job.id}/archive`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        await loadJobs();
        return null;
      }

      if (action === 'delete') {
        await api.request(`/api/jobs/${job.id}`, { method: 'DELETE' });
        await loadJobs();
        return null;
      }

      return null;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Jobs</h2>
        <div style={{ flex: 1 }} />
        <Link to="/jobs/new">Create job</Link>
      </div>

      {error ? <div style={{ color: 'crimson', marginTop: 10 }}>{String(error)}</div> : null}

      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        {jobs.map((j) => (
          <div key={j.id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 600 }}>{j.job_title || '(Untitled draft)'}</div>
              <div style={{ flex: 1 }} />
              <Link to={`/jobs/${j.id}/edit`}>Edit</Link>
              <button
                type="button"
                disabled={busyId === j.id}
                onClick={async () => {
                  if (!window.confirm('Duplicate this job as a new draft?')) return;
                  const newId = await runAction(j, 'duplicate');
                  if (newId) window.location.href = `/jobs/${newId}/edit`;
                }}
              >
                Duplicate
              </button>
              <select
                disabled={busyId === j.id}
                defaultValue=""
                onChange={async (e) => {
                  const v = e.target.value;
                  e.target.value = '';
                  if (!v) return;
                  if (v === 'pause' && !window.confirm('Pause this job?')) return;
                  if (v === 'close' && !window.confirm('Close this job?')) return;
                  if (v === 'reopen' && !window.confirm('Reopen this job?')) return;
                  if (v === 'archive' && !window.confirm('Archive this job?')) return;
                  if (v === 'delete' && !window.confirm('Delete this job? This may archive if applications exist.')) return;
                  await runAction(j, v);
                }}
              >
                <option value="" disabled>
                  Actions
                </option>
                <option value="pause">Pause</option>
                <option value="close">Close</option>
                <option value="reopen">Reopen</option>
                <option value="archive">Archive</option>
                <option value="delete">Delete</option>
              </select>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 6 }}>Status: {j.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

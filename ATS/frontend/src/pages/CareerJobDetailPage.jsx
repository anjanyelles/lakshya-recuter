import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

function getToken() {
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
}

function formatSalary({ salary_min, salary_max, salary_currency }) {
  if (salary_min == null && salary_max == null) return null;
  const cur = salary_currency || 'USD';
  const fmt = (n) => {
    if (n == null) return null;
    const v = Number(n);
    if (!Number.isFinite(v)) return String(n);
    if (v >= 1000) return `${Math.round(v / 1000)}k`;
    return `${Math.round(v)}`;
  };
  const a = fmt(salary_min);
  const b = fmt(salary_max);
  if (a && b) return `${cur} ${a} - ${b}`;
  if (a) return `${cur} ${a}+`;
  if (b) return `${cur} up to ${b}`;
  return null;
}

export default function CareerJobDetailPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const api = useMemo(() => {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
    async function request(path, opts = {}) {
      const token = getToken();
      const res = await fetch(base + path, {
        ...opts,
        headers: {
          ...(opts.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Request failed');
      return data;
    }
    return { request };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.request(`/api/jobs/public/${id}`);
        if (!cancelled) setJob(res.job);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  async function toggleSave() {
    const token = getToken();
    if (!token) {
      window.alert('Log in as a candidate to save jobs.');
      return;
    }
    try {
      if (job.is_saved) {
        await api.request(`/api/candidates/saved-jobs/${job.id}`, { method: 'DELETE' });
        setJob((j) => ({ ...j, is_saved: false }));
      } else {
        await api.request('/api/candidates/saved-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id })
        });
        setJob((j) => ({ ...j, is_saved: true }));
      }
    } catch (e) {
      window.alert(e.message);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <div style={{ color: '#555' }}>Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <Link to="/careers">Back</Link>
        <div style={{ color: 'crimson', marginTop: 10 }}>{String(error)}</div>
      </div>
    );
  }

  if (!job) return null;

  const salary = formatSalary(job);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900, margin: '0 auto' }}>
      <Link to="/careers">Back to jobs</Link>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: 12 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: '#f3f4f6', overflow: 'hidden' }}>
          {job.company_logo_url ? (
            <img src={job.company_logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{job.job_title || 'Job'}</div>
          <div style={{ color: '#555', marginTop: 4 }}>
            {[job.company_name, job.department_name].filter(Boolean).join(' • ')}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {job.employment_type ? <span style={{ border: '1px solid #eee', padding: '4px 8px', borderRadius: 999 }}>{job.employment_type}</span> : null}
            {job.experience_level ? <span style={{ border: '1px solid #eee', padding: '4px 8px', borderRadius: 999 }}>{job.experience_level}</span> : null}
            {job.work_mode ? <span style={{ border: '1px solid #eee', padding: '4px 8px', borderRadius: 999 }}>{job.work_mode}</span> : null}
            {salary ? <span style={{ border: '1px solid #eee', padding: '4px 8px', borderRadius: 999 }}>{salary}</span> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSave}
          style={{
            border: '1px solid #ddd',
            background: job.is_saved ? '#111827' : '#fff',
            color: job.is_saved ? '#fff' : '#111827',
            borderRadius: 10,
            padding: '10px 12px',
            height: 42
          }}
        >
          {job.is_saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div style={{ marginTop: 14, color: '#555' }}>
        <div>{Array.isArray(job.job_locations) ? job.job_locations.join(' • ') : null}</div>
        {job.application_deadline ? <div style={{ marginTop: 6 }}>Deadline: {String(job.application_deadline).slice(0, 10)}</div> : null}
        <div style={{ marginTop: 6 }}>Views: {job.views_count || 0}</div>
      </div>

      <div style={{ marginTop: 18, borderTop: '1px solid #eee', paddingTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Description</div>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{job.job_description || ''}</div>
      </div>

      {Array.isArray(job.required_skills) && job.required_skills.length ? (
        <div style={{ marginTop: 18, borderTop: '1px solid #eee', paddingTop: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Required skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {job.required_skills.map((s) => (
              <span key={s} style={{ border: '1px solid #eee', padding: '4px 8px', borderRadius: 999 }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

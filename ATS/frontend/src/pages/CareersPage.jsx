import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

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

function relativeDate(ts) {
  if (!ts) return '';
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function SkeletonList({ count = 6, viewMode }) {
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: viewMode === 'grid' ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          style={{
            border: '1px solid #eee',
            borderRadius: 14,
            padding: 14,
            background: '#fafafa'
          }}
        >
          <div style={{ height: 14, width: '60%', background: '#e5e7eb', borderRadius: 8, marginBottom: 10 }} />
          <div style={{ height: 12, width: '40%', background: '#e5e7eb', borderRadius: 8, marginBottom: 8 }} />
          <div style={{ height: 12, width: '70%', background: '#e5e7eb', borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}

export default function CareersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState('grid');
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [department, setDepartment] = useState(searchParams.get('department') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [employmentType, setEmploymentType] = useState(searchParams.get('employment_type') || '');
  const [experienceLevel, setExperienceLevel] = useState(searchParams.get('experience_level') || '');
  const [workMode, setWorkMode] = useState(searchParams.get('work_mode') || '');
  const [postedWithin, setPostedWithin] = useState(searchParams.get('posted_within') || '');
  const [salaryMin, setSalaryMin] = useState(searchParams.get('salary_min') || '');
  const [salaryMax, setSalaryMax] = useState(searchParams.get('salary_max') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));

  const limit = 20;

  const api = useMemo(() => {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
    async function request(path) {
      const token = getToken();
      const res = await fetch(base + path, {
        headers: {
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

  const options = useMemo(() => {
    const deps = new Set();
    const locs = new Set();
    jobs.forEach((j) => {
      if (j.department_name) deps.add(j.department_name);
      (j.job_locations || []).forEach((l) => locs.add(l));
    });
    return {
      departments: Array.from(deps).sort(),
      locations: Array.from(locs).sort().slice(0, 12)
    };
  }, [jobs]);

  function syncUrl(nextPage = page) {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (department) sp.set('department', department);
    if (location) sp.set('location', location);
    if (employmentType) sp.set('employment_type', employmentType);
    if (experienceLevel) sp.set('experience_level', experienceLevel);
    if (workMode) sp.set('work_mode', workMode);
    if (postedWithin) sp.set('posted_within', postedWithin);
    if (salaryMin) sp.set('salary_min', salaryMin);
    if (salaryMax) sp.set('salary_max', salaryMax);
    if (sort) sp.set('sort', sort);
    sp.set('page', String(nextPage));
    setSearchParams(sp, { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const hasAnyFilter =
          Boolean(q.trim()) ||
          Boolean(department) ||
          Boolean(location) ||
          Boolean(employmentType) ||
          Boolean(experienceLevel) ||
          Boolean(workMode) ||
          Boolean(postedWithin) ||
          Boolean(salaryMin) ||
          Boolean(salaryMax);

        const sp = new URLSearchParams();
        sp.set('page', String(page));
        sp.set('limit', String(limit));
        if (sort) sp.set('sort', sort);

        if (hasAnyFilter) {
          if (q.trim()) sp.set('q', q.trim());
          if (department) sp.set('department', department);
          if (location) sp.set('location', location);
          if (employmentType) sp.set('employment_type', employmentType);
          if (experienceLevel) sp.set('experience_level', experienceLevel);
          if (workMode) sp.set('work_mode', workMode);
          if (postedWithin) sp.set('posted_within', postedWithin);
          if (salaryMin) sp.set('salary_min', salaryMin);
          if (salaryMax) sp.set('salary_max', salaryMax);

          const res = await api.request(`/api/jobs/public/search?${sp.toString()}`);
          if (!cancelled) {
            setJobs(res.jobs || []);
            setTotal(res.total || 0);
          }
        } else {
          const res = await api.request(`/api/jobs/public?${sp.toString()}`);
          if (!cancelled) {
            setJobs(res.jobs || []);
            setTotal(res.total || 0);
          }
        }
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
  }, [api, q, department, location, employmentType, experienceLevel, workMode, postedWithin, salaryMin, salaryMax, sort, page]);

  async function toggleSave(job) {
    const token = getToken();
    if (!token) {
      window.alert('Log in as a candidate to save jobs.');
      return;
    }

    try {
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
      if (job.is_saved) {
        const res = await fetch(`${base}/api/candidates/saved-jobs/${job.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'Request failed');
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, is_saved: false } : j)));
      } else {
        const res = await fetch(`${base}/api/candidates/saved-jobs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ jobId: job.id })
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'Request failed');
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, is_saved: true } : j)));
      }
    } catch (e) {
      window.alert(e.message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Careers</h2>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}>
          {viewMode === 'grid' ? 'List view' : 'Grid view'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <aside style={{ border: '1px solid #eee', borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Search</div>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search jobs (title, description, skills)"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
          />

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <label>
              Department
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setPage(1);
                }}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
              >
                <option value="">All</option>
                {options.departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Location
              <select
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setPage(1);
                }}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
              >
                <option value="">All</option>
                {options.locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Employment type
              <select
                value={employmentType}
                onChange={(e) => {
                  setEmploymentType(e.target.value);
                  setPage(1);
                }}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
              >
                <option value="">All</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </label>

            <label>
              Experience level
              <select
                value={experienceLevel}
                onChange={(e) => {
                  setExperienceLevel(e.target.value);
                  setPage(1);
                }}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
              >
                <option value="">All</option>
                <option value="entry">Entry</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </label>

            <label>
              Work mode
              <select
                value={workMode}
                onChange={(e) => {
                  setWorkMode(e.target.value);
                  setPage(1);
                }}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
              >
                <option value="">All</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </label>

            <label>
              Posted within
              <select
                value={postedWithin}
                onChange={(e) => {
                  setPostedWithin(e.target.value);
                  setPage(1);
                }}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
              >
                <option value="">Anytime</option>
                <option value="last_24h">Last 24h</option>
                <option value="last_week">Last week</option>
                <option value="last_month">Last month</option>
                <option value="last_3_months">Last 3 months</option>
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>
                Salary min
                <input
                  value={salaryMin}
                  onChange={(e) => {
                    setSalaryMin(e.target.value);
                    setPage(1);
                  }}
                  type="number"
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
                />
              </label>
              <label>
                Salary max
                <input
                  value={salaryMax}
                  onChange={(e) => {
                    setSalaryMax(e.target.value);
                    setPage(1);
                  }}
                  type="number"
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                setQ('');
                setDepartment('');
                setLocation('');
                setEmploymentType('');
                setExperienceLevel('');
                setWorkMode('');
                setPostedWithin('');
                setSalaryMin('');
                setSalaryMax('');
                setSort('newest');
                setPage(1);
                setSearchParams(new URLSearchParams(), { replace: true });
              }}
            >
              Clear filters
            </button>

            <button
              type="button"
              onClick={() => {
                syncUrl(1);
              }}
            >
              Apply to URL
            </button>
          </div>
        </aside>

        <main>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ color: '#555' }}>
              Showing {jobs.length} of {total}
            </div>
            <div style={{ flex: 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: 8, borderRadius: 10, border: '1px solid #ddd' }}>
                <option value="newest">Newest</option>
                <option value="relevance">Relevance</option>
                <option value="salary_high">Salary high</option>
                <option value="salary_low">Salary low</option>
                <option value="deadline">Deadline</option>
              </select>
            </label>
          </div>

          {error ? <div style={{ color: 'crimson', marginBottom: 10 }}>{String(error)}</div> : null}

          {loading ? (
            <SkeletonList viewMode={viewMode} />
          ) : jobs.length === 0 ? (
            <div style={{ border: '1px solid #eee', borderRadius: 14, padding: 18, color: '#444' }}>
              No results. Try changing your filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: viewMode === 'grid' ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}>
              {jobs.map((j) => {
                const salary = formatSalary(j);
                const titleHtml = j.job_title_highlight || j.job_title || '';
                const subtitle = [j.company_name, j.department_name].filter(Boolean).join(' • ');
                return (
                  <div key={j.id} style={{ border: '1px solid #eee', borderRadius: 14, padding: 14 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f3f4f6', overflow: 'hidden' }}>
                        {j.company_logo_url ? (
                          <img src={j.company_logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : null}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Link to={`/careers/${j.id}`} style={{ textDecoration: 'none', color: '#111827' }}>
                          <div style={{ fontWeight: 700 }} dangerouslySetInnerHTML={{ __html: titleHtml }} />
                        </Link>
                        <div style={{ color: '#555', fontSize: 13, marginTop: 2 }}>{subtitle}</div>
                        <div style={{ color: '#555', fontSize: 13, marginTop: 8 }}>
                          {(j.job_locations || []).slice(0, 2).join(' • ')}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, fontSize: 12 }}>
                          {j.employment_type ? <span style={{ border: '1px solid #eee', padding: '4px 8px', borderRadius: 999 }}>{j.employment_type}</span> : null}
                          {j.experience_level ? <span style={{ border: '1px solid #eee', padding: '4px 8px', borderRadius: 999 }}>{j.experience_level}</span> : null}
                          {j.work_mode ? <span style={{ border: '1px solid #eee', padding: '4px 8px', borderRadius: 999 }}>{j.work_mode}</span> : null}
                          {salary ? <span style={{ border: '1px solid #eee', padding: '4px 8px', borderRadius: 999 }}>{salary}</span> : null}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, color: '#6b7280', fontSize: 12 }}>
                          <div>Posted {relativeDate(j.published_at)}</div>
                          {j.application_deadline ? <div>Deadline {String(j.application_deadline).slice(0, 10)}</div> : null}
                          <div style={{ marginLeft: 'auto' }}>Views {j.views_count || 0}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSave(j)}
                        title={j.is_saved ? 'Unsave job' : 'Save job'}
                        style={{
                          border: '1px solid #ddd',
                          background: j.is_saved ? '#111827' : '#fff',
                          color: j.is_saved ? '#fff' : '#111827',
                          borderRadius: 10,
                          padding: '8px 10px',
                          height: 38
                        }}
                      >
                        {j.is_saved ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <div style={{ color: '#555' }}>
              Page {page} / {totalPages}
            </div>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

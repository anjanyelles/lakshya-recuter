import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../state/auth/useAuth.js';

function Stepper({ step, setStep }) {
  const steps = ['Basic', 'Details', 'Compensation', 'Application', 'Team', 'Preview'];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {steps.map((s, i) => (
        <button
          key={s}
          type="button"
          onClick={() => setStep(i)}
          style={{
            padding: '6px 10px',
            border: '1px solid #ddd',
            background: i === step ? '#111827' : '#fff',
            color: i === step ? '#fff' : '#111827',
            borderRadius: 8
          }}
        >
          {i + 1}. {s}
        </button>
      ))}
    </div>
  );
}

function parseCsv(s) {
  return String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function JobWizardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const editId = params?.id || null;

  const [step, setStep] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    jobTitle: '',
    workMode: 'remote',
    employmentType: 'full-time',
    experienceLevel: 'entry',
    jobLocationsCsv: '',
    jobDescription: '',
    keyResponsibilitiesCsv: '',
    requiredQualificationsCsv: '',
    preferredQualificationsCsv: '',
    requiredSkillsCsv: '',
    niceToHaveSkillsCsv: '',
    salaryMin: '',
    salaryMax: '',
    salaryCurrency: 'USD',
    salaryVisible: false,
    benefitsDescription: '',
    bonusDetails: '',
    applicationDeadline: '',
    numberOfOpenings: 1,
    requiredDocumentsCsv: '',
    customQuestionsJson: '[]',
    screeningQuestionsJson: '[]',
    assignedHiringManagerId: '',
    assignedRecruitersCsv: '',
    pipelineStagesJson: ''
  });

  const api = useMemo(() => {
    // reuse the existing apiClient via AuthProvider by just calling fetch directly isn't available.
    // quick approach: use window.fetch with token from local/session storage.
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    async function request(path, opts = {}) {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + path, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          ...(opts.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || 'Request failed';
        const err = new Error(msg);
        err.data = data;
        throw err;
      }
      return data;
    }
    return { request };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadExisting() {
      if (!editId) return;
      setSaving(true);
      setError(null);
      try {
        const res = await api.request(`/api/jobs/${editId}`);
        const j = res.job;
        if (!j) throw new Error('Not found');
        if (cancelled) return;

        setJobId(j.id);
        setForm((prev) => ({
          ...prev,
          jobTitle: j.job_title || '',
          workMode: j.work_mode || 'remote',
          employmentType: j.employment_type || 'full-time',
          experienceLevel: j.experience_level || 'entry',
          jobLocationsCsv: Array.isArray(j.job_locations) ? j.job_locations.join(', ') : '',
          jobDescription: j.job_description || '',
          keyResponsibilitiesCsv: Array.isArray(j.key_responsibilities) ? j.key_responsibilities.join(', ') : '',
          requiredQualificationsCsv: Array.isArray(j.required_qualifications) ? j.required_qualifications.join(', ') : '',
          preferredQualificationsCsv: Array.isArray(j.preferred_qualifications) ? j.preferred_qualifications.join(', ') : '',
          requiredSkillsCsv: Array.isArray(j.required_skills) ? j.required_skills.join(', ') : '',
          niceToHaveSkillsCsv: Array.isArray(j.nice_to_have_skills) ? j.nice_to_have_skills.join(', ') : '',
          salaryMin: j.salary_min == null ? '' : String(j.salary_min),
          salaryMax: j.salary_max == null ? '' : String(j.salary_max),
          salaryCurrency: j.salary_currency || 'USD',
          salaryVisible: Boolean(j.salary_visible),
          benefitsDescription: j.benefits_description || '',
          bonusDetails: j.bonus_details || '',
          applicationDeadline: j.application_deadline ? String(j.application_deadline).slice(0, 10) : '',
          numberOfOpenings: j.number_of_openings || 1,
          requiredDocumentsCsv: Array.isArray(j.required_documents) ? j.required_documents.join(', ') : '',
          customQuestionsJson: JSON.stringify(j.custom_questions || [], null, 2),
          screeningQuestionsJson: JSON.stringify(j.screening_questions || [], null, 2),
          assignedHiringManagerId: j.assigned_hiring_manager_id || '',
          assignedRecruitersCsv: Array.isArray(j.assigned_recruiters) ? j.assigned_recruiters.join(', ') : '',
          pipelineStagesJson: j.pipeline_stages && Array.isArray(j.pipeline_stages) ? JSON.stringify(j.pipeline_stages, null, 2) : ''
        }));
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setSaving(false);
      }
    }

    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [api, editId]);

  const payload = useMemo(() => {
    const p = {
      jobTitle: form.jobTitle || null,
      workMode: form.workMode || null,
      employmentType: form.employmentType || null,
      experienceLevel: form.experienceLevel || null,
      jobLocations: parseCsv(form.jobLocationsCsv),
      jobDescription: form.jobDescription || null,
      keyResponsibilities: parseCsv(form.keyResponsibilitiesCsv),
      requiredQualifications: parseCsv(form.requiredQualificationsCsv),
      preferredQualifications: parseCsv(form.preferredQualificationsCsv),
      requiredSkills: parseCsv(form.requiredSkillsCsv),
      niceToHaveSkills: parseCsv(form.niceToHaveSkillsCsv),
      salaryMin: form.salaryMin === '' ? null : Number(form.salaryMin),
      salaryMax: form.salaryMax === '' ? null : Number(form.salaryMax),
      salaryCurrency: form.salaryCurrency || 'USD',
      salaryVisible: Boolean(form.salaryVisible),
      benefitsDescription: form.benefitsDescription || null,
      bonusDetails: form.bonusDetails || null,
      applicationDeadline: form.applicationDeadline || null,
      numberOfOpenings: Number(form.numberOfOpenings || 1),
      requiredDocuments: parseCsv(form.requiredDocumentsCsv),
      customQuestions: JSON.parse(form.customQuestionsJson || '[]'),
      screeningQuestions: JSON.parse(form.screeningQuestionsJson || '[]'),
      assignedHiringManagerId: form.assignedHiringManagerId || null,
      assignedRecruiters: parseCsv(form.assignedRecruitersCsv),
      pipelineStages: form.pipelineStagesJson ? JSON.parse(form.pipelineStagesJson) : undefined
    };
    return p;
  }, [form]);

  async function saveDraft() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!jobId) {
        const created = await api.request('/api/jobs', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setJobId(created.job.id);
        setSuccess('Draft created');
      } else {
        await api.request(`/api/jobs/${jobId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setSuccess(editId ? 'Changes saved' : 'Draft saved');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function publishNow() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!jobId) throw new Error('Save a draft first');
      await api.request(`/api/jobs/${jobId}/publish`, { method: 'PUT' });
      setSuccess('Published');
      setTimeout(() => navigate('/'), 800);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div style={{ maxWidth: 900, margin: '30px auto', padding: 16, fontFamily: 'system-ui' }}>
      <h2>{editId ? 'Edit Job' : 'Create Job'}</h2>
      <Stepper step={step} setStep={setStep} />

      <div style={{ display: 'grid', gap: 10, border: '1px solid #eee', padding: 14, borderRadius: 12 }}>
        {step === 0 ? (
          <>
            <label>
              Job title
              <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} style={{ width: '100%', padding: 10 }} />
            </label>
            <label>
              Locations (comma separated)
              <input
                value={form.jobLocationsCsv}
                onChange={(e) => setForm({ ...form, jobLocationsCsv: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Work mode
              <select value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value })} style={{ padding: 10 }}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </label>
            <label>
              Employment type
              <select
                value={form.employmentType}
                onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                style={{ padding: 10 }}
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </label>
            <label>
              Experience level
              <select
                value={form.experienceLevel}
                onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}
                style={{ padding: 10 }}
              >
                <option value="entry">Entry</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label>
              Job description
              <textarea
                value={form.jobDescription}
                onChange={(e) => setForm({ ...form, jobDescription: e.target.value })}
                rows={10}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Key responsibilities (comma separated)
              <input
                value={form.keyResponsibilitiesCsv}
                onChange={(e) => setForm({ ...form, keyResponsibilitiesCsv: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Required qualifications (comma separated)
              <input
                value={form.requiredQualificationsCsv}
                onChange={(e) => setForm({ ...form, requiredQualificationsCsv: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Preferred qualifications (comma separated)
              <input
                value={form.preferredQualificationsCsv}
                onChange={(e) => setForm({ ...form, preferredQualificationsCsv: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Required skills (comma separated)
              <input
                value={form.requiredSkillsCsv}
                onChange={(e) => setForm({ ...form, requiredSkillsCsv: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Nice-to-have skills (comma separated)
              <input
                value={form.niceToHaveSkillsCsv}
                onChange={(e) => setForm({ ...form, niceToHaveSkillsCsv: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <label>
              Salary min
              <input
                value={form.salaryMin}
                onChange={(e) => setForm({ ...form, salaryMin: e.target.value })}
                type="number"
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Salary max
              <input
                value={form.salaryMax}
                onChange={(e) => setForm({ ...form, salaryMax: e.target.value })}
                type="number"
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Currency
              <input
                value={form.salaryCurrency}
                onChange={(e) => setForm({ ...form, salaryCurrency: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.salaryVisible}
                onChange={(e) => setForm({ ...form, salaryVisible: e.target.checked })}
              />{' '}
              Salary visible to candidates
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <label>
              Application deadline (YYYY-MM-DD)
              <input
                value={form.applicationDeadline}
                onChange={(e) => setForm({ ...form, applicationDeadline: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Number of openings
              <input
                value={form.numberOfOpenings}
                onChange={(e) => setForm({ ...form, numberOfOpenings: e.target.value })}
                type="number"
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Required documents (comma separated)
              <input
                value={form.requiredDocumentsCsv}
                onChange={(e) => setForm({ ...form, requiredDocumentsCsv: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Custom questions (JSON array)
              <textarea
                value={form.customQuestionsJson}
                onChange={(e) => setForm({ ...form, customQuestionsJson: e.target.value })}
                rows={6}
                style={{ width: '100%', padding: 10, fontFamily: 'monospace' }}
              />
            </label>
            <label>
              Screening questions (JSON array)
              <textarea
                value={form.screeningQuestionsJson}
                onChange={(e) => setForm({ ...form, screeningQuestionsJson: e.target.value })}
                rows={6}
                style={{ width: '100%', padding: 10, fontFamily: 'monospace' }}
              />
            </label>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <label>
              Assigned hiring manager userId (UUID)
              <input
                value={form.assignedHiringManagerId}
                onChange={(e) => setForm({ ...form, assignedHiringManagerId: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Assigned recruiters userIds (comma separated UUIDs)
              <input
                value={form.assignedRecruitersCsv}
                onChange={(e) => setForm({ ...form, assignedRecruitersCsv: e.target.value })}
                style={{ width: '100%', padding: 10 }}
              />
            </label>
            <label>
              Pipeline stages (JSON array, optional)
              <textarea
                value={form.pipelineStagesJson}
                onChange={(e) => setForm({ ...form, pipelineStagesJson: e.target.value })}
                rows={5}
                style={{ width: '100%', padding: 10, fontFamily: 'monospace' }}
              />
            </label>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <div style={{ background: '#f9fafb', border: '1px solid #eee', padding: 12, borderRadius: 10 }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>Preview payload</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(payload, null, 2)}</pre>
            </div>
          </>
        ) : null}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
          <button type="button" disabled={saving} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </button>
          <button type="button" disabled={saving} onClick={() => setStep((s) => Math.min(5, s + 1))}>
            Next
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" disabled={saving} onClick={saveDraft}>
            {saving ? 'Saving…' : jobId ? 'Save draft' : 'Create draft'}
          </button>
          <button type="button" disabled={saving} onClick={publishNow}>
            Publish
          </button>
        </div>

        {error ? <div style={{ color: 'crimson' }}>{String(error)}</div> : null}
        {success ? <div style={{ color: 'green' }}>{String(success)}</div> : null}
      </div>
    </div>
  );
}

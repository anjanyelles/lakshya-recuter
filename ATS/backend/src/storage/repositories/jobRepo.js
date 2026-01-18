import { getPool } from '../postgres.js';

function toJsonb(v) {
  if (v === undefined) return null;
  return JSON.stringify(v);
}

async function insertJobHistory({ jobId, changedBy, fieldChanged, oldValue, newValue, client }) {
  const runner = client || getPool();
  await runner.query(
    `INSERT INTO job_history (job_id, changed_by, field_changed, old_value, new_value)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
    [jobId, changedBy ?? null, fieldChanged, toJsonb(oldValue), toJsonb(newValue)]
  );
}

export async function createJob({
  companyId,
  departmentId,
  createdBy,
  fields,
  status = 'draft',
  scheduledPublishDate = null
}) {
  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO jobs (
      company_id,
      department_id,
      created_by,
      job_title,
      job_locations,
      work_mode,
      employment_type,
      experience_level,
      job_description,
      key_responsibilities,
      required_qualifications,
      preferred_qualifications,
      required_skills,
      nice_to_have_skills,
      salary_min,
      salary_max,
      salary_currency,
      salary_visible,
      benefits_description,
      bonus_details,
      application_deadline,
      number_of_openings,
      required_documents,
      custom_questions,
      screening_questions,
      assigned_hiring_manager_id,
      assigned_recruiters,
      pipeline_stages,
      status,
      scheduled_publish_date,
      created_at,
      updated_at
    ) VALUES (
      $1,$2,$3,
      $4,$5,$6,$7,$8,$9,
      $10,$11,$12,$13,$14,
      $15,$16,$17,$18,$19,$20,$21,$22,
      $23,$24,$25,$26,$27,$28,$29,$30,$31,
      now(), now()
    )
    RETURNING *`,
    [
      companyId,
      departmentId,
      createdBy,
      fields.jobTitle ?? null,
      fields.jobLocations ?? [],
      fields.workMode ?? null,
      fields.employmentType ?? null,
      fields.experienceLevel ?? null,
      fields.jobDescription ?? null,
      fields.keyResponsibilities ?? [],
      fields.requiredQualifications ?? [],
      fields.preferredQualifications ?? [],
      fields.requiredSkills ?? [],
      fields.niceToHaveSkills ?? [],
      fields.salaryMin ?? null,
      fields.salaryMax ?? null,
      fields.salaryCurrency ?? 'USD',
      fields.salaryVisible ?? false,
      fields.benefitsDescription ?? null,
      fields.bonusDetails ?? null,
      fields.applicationDeadline ?? null,
      fields.numberOfOpenings ?? 1,
      fields.requiredDocuments ?? [],
      fields.customQuestions ?? [],
      fields.screeningQuestions ?? [],
      fields.assignedHiringManagerId ?? null,
      fields.assignedRecruiters ?? [],
      fields.pipelineStages ?? [],
      status,
      scheduledPublishDate
    ]
  );

  return res.rows[0];
}

export async function updateJob({ jobId, companyId, updates }) {
  const pool = getPool();

  const res = await pool.query(
    `UPDATE jobs
     SET job_title = COALESCE($3, job_title),
         job_locations = COALESCE($4, job_locations),
         work_mode = COALESCE($5, work_mode),
         employment_type = COALESCE($6, employment_type),
         experience_level = COALESCE($7, experience_level),
         job_description = COALESCE($8, job_description),
         key_responsibilities = COALESCE($9, key_responsibilities),
         required_qualifications = COALESCE($10, required_qualifications),
         preferred_qualifications = COALESCE($11, preferred_qualifications),
         required_skills = COALESCE($12, required_skills),
         nice_to_have_skills = COALESCE($13, nice_to_have_skills),
         salary_min = COALESCE($14, salary_min),
         salary_max = COALESCE($15, salary_max),
         salary_currency = COALESCE($16, salary_currency),
         salary_visible = COALESCE($17, salary_visible),
         benefits_description = COALESCE($18, benefits_description),
         bonus_details = COALESCE($19, bonus_details),
         application_deadline = COALESCE($20, application_deadline),
         number_of_openings = COALESCE($21, number_of_openings),
         required_documents = COALESCE($22, required_documents),
         custom_questions = COALESCE($23, custom_questions),
         screening_questions = COALESCE($24, screening_questions),
         assigned_hiring_manager_id = COALESCE($25, assigned_hiring_manager_id),
         assigned_recruiters = COALESCE($26, assigned_recruiters),
         pipeline_stages = COALESCE($27, pipeline_stages),
         department_id = COALESCE($28, department_id),
         scheduled_publish_date = COALESCE($29, scheduled_publish_date),
         updated_at = now()
     WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2
     RETURNING *`,
    [
      jobId,
      companyId,
      updates.jobTitle ?? null,
      updates.jobLocations,
      updates.workMode,
      updates.employmentType,
      updates.experienceLevel,
      updates.jobDescription,
      updates.keyResponsibilities,
      updates.requiredQualifications,
      updates.preferredQualifications,
      updates.requiredSkills,
      updates.niceToHaveSkills,
      updates.salaryMin,
      updates.salaryMax,
      updates.salaryCurrency,
      updates.salaryVisible,
      updates.benefitsDescription,
      updates.bonusDetails,
      updates.applicationDeadline,
      updates.numberOfOpenings,
      updates.requiredDocuments,
      updates.customQuestions,
      updates.screeningQuestions,
      updates.assignedHiringManagerId,
      updates.assignedRecruiters,
      updates.pipelineStages,
      updates.departmentId,
      updates.scheduledPublishDate
    ]
  );

  return res.rows[0] || null;
}

export async function updateJobWithHistory({ jobId, companyId, changedBy, updates }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const beforeRes = await client.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [jobId]);
    const before = beforeRes.rows[0];
    if (!before) {
      await client.query('ROLLBACK');
      return null;
    }
    if (before.company_id !== companyId) {
      await client.query('ROLLBACK');
      return null;
    }

    const updated = await (async () => {
      const res = await client.query(
        `UPDATE jobs
         SET job_title = COALESCE($3, job_title),
             job_locations = COALESCE($4, job_locations),
             work_mode = COALESCE($5, work_mode),
             employment_type = COALESCE($6, employment_type),
             experience_level = COALESCE($7, experience_level),
             job_description = COALESCE($8, job_description),
             key_responsibilities = COALESCE($9, key_responsibilities),
             required_qualifications = COALESCE($10, required_qualifications),
             preferred_qualifications = COALESCE($11, preferred_qualifications),
             required_skills = COALESCE($12, required_skills),
             nice_to_have_skills = COALESCE($13, nice_to_have_skills),
             salary_min = COALESCE($14, salary_min),
             salary_max = COALESCE($15, salary_max),
             salary_currency = COALESCE($16, salary_currency),
             salary_visible = COALESCE($17, salary_visible),
             benefits_description = COALESCE($18, benefits_description),
             bonus_details = COALESCE($19, bonus_details),
             application_deadline = COALESCE($20, application_deadline),
             number_of_openings = COALESCE($21, number_of_openings),
             required_documents = COALESCE($22, required_documents),
             custom_questions = COALESCE($23, custom_questions),
             screening_questions = COALESCE($24, screening_questions),
             assigned_hiring_manager_id = COALESCE($25, assigned_hiring_manager_id),
             assigned_recruiters = COALESCE($26, assigned_recruiters),
             pipeline_stages = COALESCE($27, pipeline_stages),
             department_id = COALESCE($28, department_id),
             scheduled_publish_date = COALESCE($29, scheduled_publish_date),
             updated_at = now()
         WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2
         RETURNING *`,
        [
          jobId,
          companyId,
          updates.jobTitle ?? null,
          updates.jobLocations,
          updates.workMode,
          updates.employmentType,
          updates.experienceLevel,
          updates.jobDescription,
          updates.keyResponsibilities,
          updates.requiredQualifications,
          updates.preferredQualifications,
          updates.requiredSkills,
          updates.niceToHaveSkills,
          updates.salaryMin,
          updates.salaryMax,
          updates.salaryCurrency,
          updates.salaryVisible,
          updates.benefitsDescription,
          updates.bonusDetails,
          updates.applicationDeadline,
          updates.numberOfOpenings,
          updates.requiredDocuments,
          updates.customQuestions,
          updates.screeningQuestions,
          updates.assignedHiringManagerId,
          updates.assignedRecruiters,
          updates.pipelineStages,
          updates.departmentId,
          updates.scheduledPublishDate
        ]
      );
      return res.rows[0] || null;
    })();

    if (!updated) {
      await client.query('ROLLBACK');
      return null;
    }

    const fieldMap = {
      jobTitle: 'job_title',
      jobLocations: 'job_locations',
      workMode: 'work_mode',
      employmentType: 'employment_type',
      experienceLevel: 'experience_level',
      jobDescription: 'job_description',
      keyResponsibilities: 'key_responsibilities',
      requiredQualifications: 'required_qualifications',
      preferredQualifications: 'preferred_qualifications',
      requiredSkills: 'required_skills',
      niceToHaveSkills: 'nice_to_have_skills',
      salaryMin: 'salary_min',
      salaryMax: 'salary_max',
      salaryCurrency: 'salary_currency',
      salaryVisible: 'salary_visible',
      benefitsDescription: 'benefits_description',
      bonusDetails: 'bonus_details',
      applicationDeadline: 'application_deadline',
      numberOfOpenings: 'number_of_openings',
      requiredDocuments: 'required_documents',
      customQuestions: 'custom_questions',
      screeningQuestions: 'screening_questions',
      assignedHiringManagerId: 'assigned_hiring_manager_id',
      assignedRecruiters: 'assigned_recruiters',
      pipelineStages: 'pipeline_stages',
      departmentId: 'department_id',
      scheduledPublishDate: 'scheduled_publish_date'
    };

    for (const [k, col] of Object.entries(fieldMap)) {
      if (!(k in updates)) continue;
      const oldV = before[col];
      const newV = updated[col];
      const oldJson = JSON.stringify(oldV ?? null);
      const newJson = JSON.stringify(newV ?? null);
      if (oldJson === newJson) continue;
      await insertJobHistory({
        jobId,
        changedBy,
        fieldChanged: col,
        oldValue: oldV,
        newValue: newV,
        client
      });
    }

    await client.query('COMMIT');
    return updated;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function findJobById({ jobId }) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [jobId]);
  return res.rows[0] || null;
}

export async function listJobsForCompany({ companyId, limit = 50 }) {
  const pool = getPool();
  const res = await pool.query(
    'SELECT * FROM jobs WHERE company_id IS NOT DISTINCT FROM $1 ORDER BY created_at DESC LIMIT $2',
    [companyId, limit]
  );
  return res.rows;
}

export async function publishJob({ jobId, companyId }) {
  const pool = getPool();
  const res = await pool.query(
    `UPDATE jobs
     SET status = 'published',
         published_at = now(),
         scheduled_publish_date = NULL,
         updated_at = now()
     WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2
     RETURNING *`,
    [jobId, companyId]
  );
  return res.rows[0] || null;
}

export async function pauseJob({ jobId, companyId, changedBy }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const beforeRes = await client.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [jobId]);
    const before = beforeRes.rows[0];
    if (!before || before.company_id !== companyId) {
      await client.query('ROLLBACK');
      return null;
    }

    const res = await client.query(
      `UPDATE jobs
       SET status = 'paused',
           updated_at = now()
       WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2
       RETURNING *`,
      [jobId, companyId]
    );
    const updated = res.rows[0] || null;
    if (!updated) {
      await client.query('ROLLBACK');
      return null;
    }

    if (before.status !== updated.status) {
      await insertJobHistory({
        jobId,
        changedBy,
        fieldChanged: 'status',
        oldValue: before.status,
        newValue: updated.status,
        client
      });
    }

    await client.query('COMMIT');
    return updated;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function closeJob({ jobId, companyId, changedBy }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const beforeRes = await client.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [jobId]);
    const before = beforeRes.rows[0];
    if (!before || before.company_id !== companyId) {
      await client.query('ROLLBACK');
      return null;
    }

    const res = await client.query(
      `UPDATE jobs
       SET status = 'closed',
           closed_at = now(),
           scheduled_publish_date = NULL,
           updated_at = now()
       WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2
       RETURNING *`,
      [jobId, companyId]
    );
    const updated = res.rows[0] || null;
    if (!updated) {
      await client.query('ROLLBACK');
      return null;
    }

    if (before.status !== updated.status) {
      await insertJobHistory({
        jobId,
        changedBy,
        fieldChanged: 'status',
        oldValue: before.status,
        newValue: updated.status,
        client
      });
    }
    if (String(before.closed_at || '') !== String(updated.closed_at || '')) {
      await insertJobHistory({
        jobId,
        changedBy,
        fieldChanged: 'closed_at',
        oldValue: before.closed_at,
        newValue: updated.closed_at,
        client
      });
    }

    await client.query('COMMIT');
    return updated;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function reopenJob({ jobId, companyId, changedBy, applicationDeadline }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const beforeRes = await client.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [jobId]);
    const before = beforeRes.rows[0];
    if (!before || before.company_id !== companyId) {
      await client.query('ROLLBACK');
      return null;
    }

    const res = await client.query(
      `UPDATE jobs
       SET status = 'published',
           closed_at = NULL,
           application_deadline = COALESCE($3, application_deadline),
           updated_at = now()
       WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2
       RETURNING *`,
      [jobId, companyId, applicationDeadline ?? null]
    );
    const updated = res.rows[0] || null;
    if (!updated) {
      await client.query('ROLLBACK');
      return null;
    }

    if (before.status !== updated.status) {
      await insertJobHistory({
        jobId,
        changedBy,
        fieldChanged: 'status',
        oldValue: before.status,
        newValue: updated.status,
        client
      });
    }
    if (String(before.closed_at || '') !== String(updated.closed_at || '')) {
      await insertJobHistory({
        jobId,
        changedBy,
        fieldChanged: 'closed_at',
        oldValue: before.closed_at,
        newValue: updated.closed_at,
        client
      });
    }
    if (String(before.application_deadline || '') !== String(updated.application_deadline || '')) {
      await insertJobHistory({
        jobId,
        changedBy,
        fieldChanged: 'application_deadline',
        oldValue: before.application_deadline,
        newValue: updated.application_deadline,
        client
      });
    }

    await client.query('COMMIT');
    return updated;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function archiveJob({ jobId, companyId, changedBy }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const beforeRes = await client.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [jobId]);
    const before = beforeRes.rows[0];
    if (!before || before.company_id !== companyId) {
      await client.query('ROLLBACK');
      return null;
    }

    const res = await client.query(
      `UPDATE jobs
       SET status = 'archived',
           updated_at = now()
       WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2
       RETURNING *`,
      [jobId, companyId]
    );
    const updated = res.rows[0] || null;
    if (!updated) {
      await client.query('ROLLBACK');
      return null;
    }

    if (before.status !== updated.status) {
      await insertJobHistory({
        jobId,
        changedBy,
        fieldChanged: 'status',
        oldValue: before.status,
        newValue: updated.status,
        client
      });
    }

    await client.query('COMMIT');
    return updated;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function duplicateJob({ jobId, companyId, createdBy }) {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO jobs (
      company_id,
      department_id,
      created_by,
      job_title,
      job_locations,
      work_mode,
      employment_type,
      experience_level,
      job_description,
      key_responsibilities,
      required_qualifications,
      preferred_qualifications,
      required_skills,
      nice_to_have_skills,
      salary_min,
      salary_max,
      salary_currency,
      salary_visible,
      benefits_description,
      bonus_details,
      application_deadline,
      number_of_openings,
      required_documents,
      custom_questions,
      screening_questions,
      assigned_hiring_manager_id,
      assigned_recruiters,
      pipeline_stages,
      status,
      scheduled_publish_date,
      published_at,
      closed_at,
      views_count,
      applications_count,
      created_at,
      updated_at
    )
    SELECT
      j.company_id,
      j.department_id,
      $3,
      CASE WHEN j.job_title IS NULL OR j.job_title = '' THEN '(Copy)' ELSE (j.job_title || ' (Copy)') END,
      j.job_locations,
      j.work_mode,
      j.employment_type,
      j.experience_level,
      j.job_description,
      j.key_responsibilities,
      j.required_qualifications,
      j.preferred_qualifications,
      j.required_skills,
      j.nice_to_have_skills,
      j.salary_min,
      j.salary_max,
      j.salary_currency,
      j.salary_visible,
      j.benefits_description,
      j.bonus_details,
      j.application_deadline,
      j.number_of_openings,
      j.required_documents,
      j.custom_questions,
      j.screening_questions,
      j.assigned_hiring_manager_id,
      j.assigned_recruiters,
      j.pipeline_stages,
      'draft',
      NULL,
      NULL,
      NULL,
      0,
      0,
      now(),
      now()
    FROM jobs j
    WHERE j.id = $1 AND j.company_id IS NOT DISTINCT FROM $2
    RETURNING *`,
    [jobId, companyId, createdBy]
  );
  return res.rows[0] || null;
}

export async function deleteOrArchiveJob({ jobId, companyId, changedBy }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const beforeRes = await client.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [jobId]);
    const before = beforeRes.rows[0];
    if (!before || before.company_id !== companyId) {
      await client.query('ROLLBACK');
      return { deleted: false, archived: false, job: null };
    }

    if (!(before.status === 'draft' || before.status === 'closed')) {
      await client.query('ROLLBACK');
      return { deleted: false, archived: false, job: null };
    }

    if (Number(before.applications_count || 0) > 0) {
      const res = await client.query(
        `UPDATE jobs
         SET status = 'archived',
             updated_at = now()
         WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2
         RETURNING *`,
        [jobId, companyId]
      );
      const updated = res.rows[0] || null;
      if (!updated) {
        await client.query('ROLLBACK');
        return { deleted: false, archived: false, job: null };
      }
      if (before.status !== updated.status) {
        await insertJobHistory({
          jobId,
          changedBy,
          fieldChanged: 'status',
          oldValue: before.status,
          newValue: updated.status,
          client
        });
      }
      await client.query('COMMIT');
      return { deleted: false, archived: true, job: updated };
    }

    await client.query('DELETE FROM jobs WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2', [jobId, companyId]);
    await insertJobHistory({ jobId, changedBy, fieldChanged: 'deleted', oldValue: before.status, newValue: null, client });
    await client.query('COMMIT');
    return { deleted: true, archived: false, job: null };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function scheduleJob({ jobId, companyId, scheduledPublishDate }) {
  const pool = getPool();
  const res = await pool.query(
    `UPDATE jobs
     SET scheduled_publish_date = $3,
         updated_at = now()
     WHERE id = $1 AND company_id IS NOT DISTINCT FROM $2
     RETURNING *`,
    [jobId, companyId, scheduledPublishDate]
  );
  return res.rows[0] || null;
}

export async function findDueScheduledJobs({ nowTs }) {
  const pool = getPool();
  const res = await pool.query(
    `SELECT * FROM jobs
     WHERE status = 'draft'
       AND scheduled_publish_date IS NOT NULL
       AND scheduled_publish_date <= $1
     ORDER BY scheduled_publish_date ASC
     LIMIT 50`,
    [nowTs]
  );
  return res.rows;
}

function clampInt(v, { min, max, fallback }) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.max(min, Math.min(max, i));
}

function normalizeSort(sort, { isSearch }) {
  const allowed = new Set(['relevance', 'newest', 'salary_high', 'salary_low', 'deadline']);
  if (!allowed.has(sort)) return isSearch ? 'relevance' : 'newest';
  if (!isSearch && sort === 'relevance') return 'newest';
  return sort;
}

function postedWithinToInterval(postedWithin) {
  if (!postedWithin) return null;
  if (postedWithin === 'last_24h') return "24 hours";
  if (postedWithin === 'last_week') return "7 days";
  if (postedWithin === 'last_month') return "30 days";
  if (postedWithin === 'last_3_months') return "90 days";
  return null;
}

function buildPublicSelect({ includeScore, includeHighlights }) {
  const scoreCols = includeScore
    ? `,
       (
         ts_rank(
           to_tsvector(
             'english',
             unaccent(
               coalesce(j.job_title, '') || ' ' ||
               coalesce(j.job_description, '') || ' ' ||
               coalesce((SELECT string_agg(x, ' ') FROM jsonb_array_elements_text(j.required_skills) x), '')
             )
           ),
           websearch_to_tsquery('english', unaccent($1))
         )
         + greatest(similarity(coalesce(j.job_title, ''), $1), 0)
       ) AS relevance_score`
    : '';

  const highlightCols = includeHighlights
    ? `,
       ts_headline(
         'english',
         coalesce(j.job_title, ''),
         websearch_to_tsquery('english', unaccent($1)),
         'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MinWords=1, MaxWords=12'
       ) AS job_title_highlight,
       ts_headline(
         'english',
         coalesce(j.job_description, ''),
         websearch_to_tsquery('english', unaccent($1)),
         'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MinWords=5, MaxWords=24'
       ) AS job_description_highlight`
    : '';

  return `
    SELECT
      j.id,
      j.job_title,
      j.job_locations,
      j.employment_type,
      j.experience_level,
      j.work_mode,
      CASE WHEN j.salary_visible THEN j.salary_min ELSE NULL END AS salary_min,
      CASE WHEN j.salary_visible THEN j.salary_max ELSE NULL END AS salary_max,
      CASE WHEN j.salary_visible THEN j.salary_currency ELSE NULL END AS salary_currency,
      j.salary_visible,
      j.published_at,
      j.application_deadline,
      j.views_count,
      c.name AS company_name,
      c.logo_url AS company_logo_url,
      d.name AS department_name,
      CASE WHEN $2::uuid IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM candidate_saved_jobs s WHERE s.user_id = $2 AND s.job_id = j.id
      ) END AS is_saved
      ${scoreCols}
      ${highlightCols}
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    LEFT JOIN departments d ON d.id = j.department_id
  `;
}

function buildPublicWhere({ hasQuery, filters, baseParamIndex }) {
  const parts = [];
  const params = [];
  let i = baseParamIndex;

  parts.push("j.status = 'published'");

  if (hasQuery) {
    parts.push(
      `(
        to_tsvector(
          'english',
          unaccent(
            coalesce(j.job_title, '') || ' ' ||
            coalesce(j.job_description, '') || ' ' ||
            coalesce((SELECT string_agg(x, ' ') FROM jsonb_array_elements_text(j.required_skills) x), '')
          )
        ) @@ websearch_to_tsquery('english', unaccent($1))
        OR similarity(coalesce(j.job_title, ''), $1) > 0.2
      )`
    );
  }

  if (filters.department) {
    parts.push(`d.name ILIKE $${i}`);
    params.push(`%${filters.department}%`);
    i += 1;
  }

  if (filters.location) {
    parts.push(
      `EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(j.job_locations) loc
        WHERE loc ILIKE $${i}
      )`
    );
    params.push(`%${filters.location}%`);
    i += 1;
  }

  if (filters.employment_type) {
    parts.push(`j.employment_type = $${i}`);
    params.push(filters.employment_type);
    i += 1;
  }

  if (filters.experience_level) {
    parts.push(`j.experience_level = $${i}`);
    params.push(filters.experience_level);
    i += 1;
  }

  if (filters.work_mode) {
    parts.push(`j.work_mode = $${i}`);
    params.push(filters.work_mode);
    i += 1;
  }

  if (filters.salary_min != null || filters.salary_max != null) {
    const min = filters.salary_min != null ? Number(filters.salary_min) : null;
    const max = filters.salary_max != null ? Number(filters.salary_max) : null;
    if (min != null && max != null) {
      parts.push(
        `(
          (j.salary_min IS NULL AND j.salary_max IS NULL)
          OR (j.salary_min IS NOT NULL AND j.salary_max IS NOT NULL AND j.salary_min <= $${i + 1} AND j.salary_max >= $${i})
          OR (j.salary_min IS NULL AND j.salary_max IS NOT NULL AND j.salary_max >= $${i})
          OR (j.salary_min IS NOT NULL AND j.salary_max IS NULL AND j.salary_min <= $${i + 1})
        )`
      );
      params.push(min);
      params.push(max);
      i += 2;
    } else if (min != null) {
      parts.push(`(j.salary_max IS NULL OR j.salary_max >= $${i})`);
      params.push(min);
      i += 1;
    } else if (max != null) {
      parts.push(`(j.salary_min IS NULL OR j.salary_min <= $${i})`);
      params.push(max);
      i += 1;
    }
  }

  if (filters.posted_within) {
    const interval = postedWithinToInterval(filters.posted_within);
    if (interval) {
      parts.push(`j.published_at >= (now() - interval '${interval}')`);
    }
  }

  return { whereSql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

function buildOrderBy({ sort, isSearch }) {
  const s = normalizeSort(sort, { isSearch });
  if (s === 'deadline') return 'ORDER BY j.application_deadline ASC NULLS LAST, j.published_at DESC NULLS LAST';
  if (s === 'salary_high') return 'ORDER BY j.salary_max DESC NULLS LAST, j.published_at DESC NULLS LAST';
  if (s === 'salary_low') return 'ORDER BY j.salary_max ASC NULLS LAST, j.published_at DESC NULLS LAST';
  if (s === 'relevance') return 'ORDER BY relevance_score DESC NULLS LAST, j.published_at DESC NULLS LAST';
  return 'ORDER BY j.published_at DESC NULLS LAST';
}

export async function listPublicJobs({ page = 1, limit = 20, sort = 'newest', userId = null }) {
  const pool = getPool();
  const l = clampInt(limit, { min: 1, max: 100, fallback: 20 });
  const p = clampInt(page, { min: 1, max: 100000, fallback: 1 });
  const offset = (p - 1) * l;

  const baseSelect = buildPublicSelect({ includeScore: false, includeHighlights: false });
  const whereSql = "WHERE j.status = 'published'";
  const orderBy = buildOrderBy({ sort, isSearch: false });

  const countRes = await pool.query(
    `SELECT count(*)::int AS total
     FROM jobs j
     WHERE j.status = 'published'`,
    []
  );
  const total = countRes.rows[0]?.total || 0;

  const res = await pool.query(
    `${baseSelect}
     ${whereSql}
     ${orderBy}
     LIMIT $3 OFFSET $4`,
    ['', userId, l, offset]
  );

  return { jobs: res.rows, total, page: p, limit: l };
}

export async function searchPublicJobs({
  q,
  department,
  location,
  employment_type,
  experience_level,
  salary_min,
  salary_max,
  work_mode,
  posted_within,
  page = 1,
  limit = 20,
  sort,
  userId = null
}) {
  const pool = getPool();
  const query = String(q || '').trim();
  const hasQuery = query.length > 0;
  const l = clampInt(limit, { min: 1, max: 100, fallback: 20 });
  const p = clampInt(page, { min: 1, max: 100000, fallback: 1 });
  const offset = (p - 1) * l;

  const filters = {
    department: department || null,
    location: location || null,
    employment_type: employment_type || null,
    experience_level: experience_level || null,
    salary_min: salary_min != null ? Number(salary_min) : null,
    salary_max: salary_max != null ? Number(salary_max) : null,
    work_mode: work_mode || null,
    posted_within: posted_within || null
  };

  const baseSelect = buildPublicSelect({ includeScore: hasQuery, includeHighlights: hasQuery });
  const { whereSql, params } = buildPublicWhere({ hasQuery, filters, baseParamIndex: 3 });
  const orderBy = buildOrderBy({ sort, isSearch: hasQuery });

  const countRes = await pool.query(
    `SELECT count(*)::int AS total
     FROM jobs j
     LEFT JOIN departments d ON d.id = j.department_id
     ${whereSql}`,
    [query, userId, ...params]
  );
  const total = countRes.rows[0]?.total || 0;

  const res = await pool.query(
    `${baseSelect}
     ${whereSql}
     ${orderBy}
     LIMIT $${params.length + 3} OFFSET $${params.length + 4}`,
    [query, userId, ...params, l, offset]
  );

  return { jobs: res.rows, total, page: p, limit: l };
}

export async function getPublicJobById({ jobId, userId = null }) {
  const pool = getPool();
  const res = await pool.query(
    `SELECT
       j.*, 
       c.name AS company_name,
       c.logo_url AS company_logo_url,
       d.name AS department_name,
       CASE WHEN $2::uuid IS NULL THEN false ELSE EXISTS (
         SELECT 1 FROM candidate_saved_jobs s WHERE s.user_id = $2 AND s.job_id = j.id
       ) END AS is_saved
     FROM jobs j
     LEFT JOIN companies c ON c.id = j.company_id
     LEFT JOIN departments d ON d.id = j.department_id
     WHERE j.id = $1
       AND j.status = 'published'
     LIMIT 1`,
    [jobId, userId]
  );
  return res.rows[0] || null;
}

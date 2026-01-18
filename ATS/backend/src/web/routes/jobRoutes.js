import { Router } from 'express';
import { z } from 'zod';

import { authOptional, authRequired } from '../middleware/authMiddleware.js';
import {
  createJob,
  deleteOrArchiveJob,
  duplicateJob,
  findJobById,
  getPublicJobById,
  listJobsForCompany,
  listPublicJobs,
  pauseJob,
  publishJob,
  reopenJob,
  closeJob,
  archiveJob,
  scheduleJob,
  searchPublicJobs,
  updateJobWithHistory
} from '../../storage/repositories/jobRepo.js';
import { computeViewerHash, recordUniqueJobView } from '../../storage/repositories/jobViewsRepo.js';

function canWriteJobs(role) {
  return role === 'admin' || role === 'recruiter';
}

function isAssignedRecruiter(job, userId) {
  const v = job?.assigned_recruiters;
  if (!v) return false;
  if (Array.isArray(v)) return v.includes(userId);
  return false;
}

function canManageJob({ role, userId, job }) {
  if (role === 'admin') return true;
  if (!job) return false;
  if (job.created_by === userId) return true;
  return isAssignedRecruiter(job, userId);
}

const WorkMode = z.enum(['remote', 'hybrid', 'onsite']);
const EmploymentType = z.enum(['full-time', 'part-time', 'contract', 'internship']);
const ExperienceLevel = z.enum(['entry', 'mid', 'senior', 'lead']);
const Status = z.enum(['draft', 'published', 'paused', 'closed', 'archived']);

const jobPayloadSchema = z
  .object({
    companyId: z.string().uuid().optional().nullable(),
    departmentId: z.string().uuid().optional().nullable(),
    jobTitle: z.string().trim().min(3).max(160).optional().nullable(),
    jobLocations: z.array(z.any()).optional(),
    workMode: WorkMode.optional().nullable(),
    employmentType: EmploymentType.optional().nullable(),
    experienceLevel: ExperienceLevel.optional().nullable(),
    jobDescription: z.string().trim().min(30).optional().nullable(),
    keyResponsibilities: z.array(z.string().trim().min(1)).optional(),
    requiredQualifications: z.array(z.string().trim().min(1)).optional(),
    preferredQualifications: z.array(z.string().trim().min(1)).optional(),
    requiredSkills: z.array(z.string().trim().min(1)).optional(),
    niceToHaveSkills: z.array(z.string().trim().min(1)).optional(),
    salaryMin: z.number().optional().nullable(),
    salaryMax: z.number().optional().nullable(),
    salaryCurrency: z.string().trim().min(3).max(10).optional().nullable(),
    salaryVisible: z.boolean().optional(),
    benefitsDescription: z.string().trim().optional().nullable(),
    bonusDetails: z.string().trim().optional().nullable(),
    applicationDeadline: z.string().trim().optional().nullable(),
    numberOfOpenings: z.number().int().min(1).max(999).optional(),
    requiredDocuments: z.array(z.string().trim().min(1)).optional(),
    customQuestions: z.array(z.any()).optional(),
    screeningQuestions: z.array(z.any()).optional(),
    assignedHiringManagerId: z.string().uuid().optional().nullable(),
    assignedRecruiters: z.array(z.string().uuid()).optional(),
    pipelineStages: z.array(z.any()).optional(),
    status: Status.optional(),
    scheduledPublishDate: z.string().trim().optional().nullable()
  })
  .strict();

function defaultPipelineStages() {
  return [
    { key: 'applied', label: 'Applied' },
    { key: 'screen', label: 'Screen' },
    { key: 'interview', label: 'Interview' },
    { key: 'offer', label: 'Offer' },
    { key: 'hired', label: 'Hired' }
  ];
}

function parseOptionalDateOnly(s) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseOptionalTimestamp(s) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function validateSalary({ salaryMin, salaryMax }) {
  if (salaryMin != null && salaryMax != null && Number(salaryMin) >= Number(salaryMax)) {
    return 'salaryMin must be < salaryMax';
  }
  return null;
}

function validateDeadlineFuture(deadlineDate) {
  if (!deadlineDate) return null;
  const today = new Date();
  if (deadlineDate.getTime() <= today.getTime()) return 'applicationDeadline must be a future date';
  return null;
}

function validatePublishRequiredFields(jobLike) {
  if (!jobLike.job_title) return 'jobTitle is required';
  if (!jobLike.work_mode) return 'workMode is required';
  if (!jobLike.employment_type) return 'employmentType is required';
  if (!jobLike.experience_level) return 'experienceLevel is required';
  if (!jobLike.job_description || String(jobLike.job_description).trim().length < 30) return 'jobDescription is required';
  return null;
}

export function jobRouter({ logger }) {
  const router = Router();

  router.get('/public', authOptional({ logger }), async (req, res) => {
    const page = req.query.page;
    const limit = req.query.limit;
    const sort = req.query.sort;
    const userId = req.auth?.userId || null;

    const result = await listPublicJobs({ page, limit, sort, userId });
    return res.json(result);
  });

  router.get('/public/search', authOptional({ logger }), async (req, res) => {
    const userId = req.auth?.userId || null;
    const result = await searchPublicJobs({
      q: req.query.q,
      department: req.query.department,
      location: req.query.location,
      employment_type: req.query.employment_type,
      experience_level: req.query.experience_level,
      salary_min: req.query.salary_min,
      salary_max: req.query.salary_max,
      work_mode: req.query.work_mode,
      posted_within: req.query.posted_within,
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort,
      userId
    });
    return res.json(result);
  });

  router.get('/public/:id', authOptional({ logger }), async (req, res) => {
    const userId = req.auth?.userId || null;
    const job = await getPublicJobById({ jobId: req.params.id, userId });
    if (!job) return res.status(404).json({ message: 'Not found' });

    try {
      const viewerHash = computeViewerHash({ req, auth: req.auth });
      await recordUniqueJobView({ jobId: req.params.id, viewerHash });
    } catch (err) {
      if (logger) logger.warn({ err }, 'job view tracking failed');
    }

    return res.json({ job });
  });

  router.get('/', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });
    const jobs = await listJobsForCompany({ companyId: req.auth.companyId, limit: 50 });
    return res.json({ jobs });
  });

  router.get('/:id', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });
    const job = await findJobById({ jobId: req.params.id });
    if (!job) return res.status(404).json({ message: 'Not found' });
    if (job.company_id !== req.auth.companyId) return res.status(404).json({ message: 'Not found' });
    return res.json({ job });
  });

  router.post('/', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const parsed = jobPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const salaryErr = validateSalary({ salaryMin: parsed.data.salaryMin, salaryMax: parsed.data.salaryMax });
    if (salaryErr) return res.status(400).json({ message: salaryErr });

    const deadline = parseOptionalDateOnly(parsed.data.applicationDeadline);
    if (parsed.data.applicationDeadline && !deadline) {
      return res.status(400).json({ message: 'Invalid applicationDeadline' });
    }
    const deadlineErr = validateDeadlineFuture(deadline);
    if (deadlineErr) return res.status(400).json({ message: deadlineErr });

    const scheduledTs = parseOptionalTimestamp(parsed.data.scheduledPublishDate);
    if (parsed.data.scheduledPublishDate && !scheduledTs) {
      return res.status(400).json({ message: 'Invalid scheduledPublishDate' });
    }

    const job = await createJob({
      companyId: req.auth.companyId,
      departmentId: parsed.data.departmentId ?? null,
      createdBy: req.auth.userId,
      status: 'draft',
      scheduledPublishDate: scheduledTs,
      fields: {
        ...parsed.data,
        pipelineStages: parsed.data.pipelineStages?.length ? parsed.data.pipelineStages : defaultPipelineStages(),
        applicationDeadline: deadline ? deadline.toISOString().slice(0, 10) : null
      }
    });

    return res.status(201).json({ job });
  });

  router.put('/:id', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const existing = await findJobById({ jobId: req.params.id });
    if (!existing || existing.company_id !== req.auth.companyId) return res.status(404).json({ message: 'Not found' });
    if (!canManageJob({ role: req.auth.role, userId: req.auth.userId, job: existing })) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const parsed = jobPayloadSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const salaryErr = validateSalary({ salaryMin: parsed.data.salaryMin, salaryMax: parsed.data.salaryMax });
    if (salaryErr) return res.status(400).json({ message: salaryErr });

    const deadline = parseOptionalDateOnly(parsed.data.applicationDeadline);
    if (parsed.data.applicationDeadline && !deadline) {
      return res.status(400).json({ message: 'Invalid applicationDeadline' });
    }
    const deadlineErr = validateDeadlineFuture(deadline);
    if (deadlineErr) return res.status(400).json({ message: deadlineErr });

    const scheduledTs = parseOptionalTimestamp(parsed.data.scheduledPublishDate);
    if (parsed.data.scheduledPublishDate && !scheduledTs) {
      return res.status(400).json({ message: 'Invalid scheduledPublishDate' });
    }

    const updates = {
      ...parsed.data,
      applicationDeadline: parsed.data.applicationDeadline ? deadline.toISOString().slice(0, 10) : undefined,
      scheduledPublishDate: parsed.data.scheduledPublishDate ? scheduledTs : undefined
    };

    const updated = await updateJobWithHistory({
      jobId: req.params.id,
      companyId: req.auth.companyId,
      changedBy: req.auth.userId,
      updates
    });

    if (!updated) return res.status(404).json({ message: 'Not found' });

    if (existing.status === 'published') {
      const majorFields = [
        'jobTitle',
        'jobDescription',
        'workMode',
        'employmentType',
        'experienceLevel',
        'salaryMin',
        'salaryMax',
        'jobLocations'
      ];
      const major = majorFields.some((k) => Object.prototype.hasOwnProperty.call(updates, k));
      const notifyApplicants = Boolean(req.body?.notifyApplicants);
      if (major && notifyApplicants && logger) {
        logger.info({ jobId: updated.id }, 'job updated (major changes) - notify applicants');
      }
    }

    return res.json({ job: updated });
  });

  router.put('/:id/pause', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const job = await findJobById({ jobId: req.params.id });
    if (!job || job.company_id !== req.auth.companyId) return res.status(404).json({ message: 'Not found' });
    if (!canManageJob({ role: req.auth.role, userId: req.auth.userId, job })) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updated = await pauseJob({ jobId: req.params.id, companyId: req.auth.companyId, changedBy: req.auth.userId });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    return res.json({ job: updated });
  });

  router.put('/:id/close', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const job = await findJobById({ jobId: req.params.id });
    if (!job || job.company_id !== req.auth.companyId) return res.status(404).json({ message: 'Not found' });
    if (!canManageJob({ role: req.auth.role, userId: req.auth.userId, job })) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const schema = z
      .object({
        autoRejectPendingApplications: z.boolean().optional(),
        notifyApplicants: z.boolean().optional()
      })
      .strict()
      .optional();
    const parsed = schema ? schema.safeParse(req.body) : { success: true, data: {} };
    if (parsed && !parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const updated = await closeJob({ jobId: req.params.id, companyId: req.auth.companyId, changedBy: req.auth.userId });
    if (!updated) return res.status(404).json({ message: 'Not found' });

    const autoReject = Boolean(parsed?.data?.autoRejectPendingApplications);
    const notifyApplicants = Boolean(parsed?.data?.notifyApplicants);
    if ((autoReject || notifyApplicants) && logger) {
      logger.info(
        { jobId: updated.id, autoRejectPendingApplications: autoReject, notifyApplicants },
        'job closed - applicant actions requested (applications table not implemented yet)'
      );
    }

    return res.json({ message: 'Job closed', job: updated });
  });

  router.put('/:id/reopen', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const job = await findJobById({ jobId: req.params.id });
    if (!job || job.company_id !== req.auth.companyId) return res.status(404).json({ message: 'Not found' });
    if (!canManageJob({ role: req.auth.role, userId: req.auth.userId, job })) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const schema = z.object({ applicationDeadline: z.string().trim().optional().nullable() }).strict().optional();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const deadline = parseOptionalDateOnly(parsed.data?.applicationDeadline);
    if (parsed.data?.applicationDeadline && !deadline) {
      return res.status(400).json({ message: 'Invalid applicationDeadline' });
    }
    const deadlineErr = validateDeadlineFuture(deadline);
    if (deadlineErr) return res.status(400).json({ message: deadlineErr });

    const updated = await reopenJob({
      jobId: req.params.id,
      companyId: req.auth.companyId,
      changedBy: req.auth.userId,
      applicationDeadline: parsed.data?.applicationDeadline ? deadline.toISOString().slice(0, 10) : null
    });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    return res.json({ job: updated });
  });

  router.put('/:id/archive', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const job = await findJobById({ jobId: req.params.id });
    if (!job || job.company_id !== req.auth.companyId) return res.status(404).json({ message: 'Not found' });
    if (!canManageJob({ role: req.auth.role, userId: req.auth.userId, job })) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updated = await archiveJob({ jobId: req.params.id, companyId: req.auth.companyId, changedBy: req.auth.userId });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    return res.json({ message: 'Job archived', job: updated });
  });

  router.post('/:id/duplicate', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const job = await findJobById({ jobId: req.params.id });
    if (!job || job.company_id !== req.auth.companyId) return res.status(404).json({ message: 'Not found' });
    if (!canManageJob({ role: req.auth.role, userId: req.auth.userId, job })) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const duplicated = await duplicateJob({ jobId: req.params.id, companyId: req.auth.companyId, createdBy: req.auth.userId });
    if (!duplicated) return res.status(404).json({ message: 'Not found' });
    return res.status(201).json({ job: duplicated });
  });

  router.delete('/:id', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const job = await findJobById({ jobId: req.params.id });
    if (!job || job.company_id !== req.auth.companyId) return res.status(404).json({ message: 'Not found' });
    if (!canManageJob({ role: req.auth.role, userId: req.auth.userId, job })) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const outcome = await deleteOrArchiveJob({ jobId: req.params.id, companyId: req.auth.companyId, changedBy: req.auth.userId });
    if (outcome.deleted) return res.json({ message: 'Job deleted' });
    if (outcome.archived) return res.json({ message: 'Job archived', job: outcome.job });
    return res.status(400).json({ message: 'Job cannot be deleted unless draft or closed' });
  });

  router.put('/:id/publish', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const job = await findJobById({ jobId: req.params.id });
    if (!job || job.company_id !== req.auth.companyId) return res.status(404).json({ message: 'Not found' });

    const salaryErr = validateSalary({ salaryMin: job.salary_min, salaryMax: job.salary_max });
    if (salaryErr) return res.status(400).json({ message: salaryErr });

    const deadlineErr = validateDeadlineFuture(job.application_deadline ? new Date(job.application_deadline) : null);
    if (deadlineErr) return res.status(400).json({ message: deadlineErr });

    const requiredErr = validatePublishRequiredFields(job);
    if (requiredErr) return res.status(400).json({ message: requiredErr });

    const published = await publishJob({ jobId: req.params.id, companyId: req.auth.companyId });
    if (!published) return res.status(404).json({ message: 'Not found' });

    if (logger) {
      logger.info(
        {
          jobId: published.id,
          assignedHiringManagerId: published.assigned_hiring_manager_id,
          assignedRecruiters: published.assigned_recruiters
        },
        'job published - notify assigned team'
      );
    }

    return res.json({ job: published });
  });

  router.put('/:id/schedule', authRequired({ logger }), async (req, res) => {
    if (!canWriteJobs(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });

    const schema = z.object({ scheduledPublishDate: z.string().trim().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const ts = parseOptionalTimestamp(parsed.data.scheduledPublishDate);
    if (!ts) return res.status(400).json({ message: 'Invalid scheduledPublishDate' });
    if (ts.getTime() <= Date.now()) return res.status(400).json({ message: 'scheduledPublishDate must be in the future' });

    const updated = await scheduleJob({ jobId: req.params.id, companyId: req.auth.companyId, scheduledPublishDate: ts });
    if (!updated) return res.status(404).json({ message: 'Not found' });

    return res.json({ job: updated });
  });

  return router;
}

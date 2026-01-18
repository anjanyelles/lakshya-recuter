import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import crypto from 'crypto';

import { authRequired } from '../middleware/authMiddleware.js';
import { upsertCandidateProfessional } from '../../storage/repositories/candidateProfileRepo.js';
import { deleteCandidateSkill, listCandidateSkills, upsertCandidateSkill } from '../../storage/repositories/candidateSkillsRepo.js';
import { addEducation, deleteEducation, listEducation, updateEducation } from '../../storage/repositories/candidateEducationRepo.js';
import {
  addCertification,
  deleteCertification,
  listCertifications,
  updateCertification
} from '../../storage/repositories/candidateCertificationsRepo.js';
import {
  addResume,
  deleteResume,
  findResumeById,
  listResumes,
  setPrimaryResume
} from '../../storage/repositories/candidateResumesRepo.js';
import {
  listSavedJobsForCandidate,
  saveJobForCandidate,
  unsaveJobForCandidate
} from '../../storage/repositories/candidateSavedJobsRepo.js';
import { getPreferences, upsertPreferences } from '../../storage/repositories/candidatePreferencesRepo.js';
import { deleteResumeBlobIfPossible, uploadResumeFile } from '../../uploads/azureBlob.js';
import { extractTextFromResume } from '../../resume/textExtractors.js';

const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

function isResumeType(mimetype, filename) {
  const name = String(filename || '').toLowerCase();
  if (mimetype === 'application/pdf') return true;
  if (mimetype === 'application/msword') return true;
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
  if (name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) return true;
  return false;
}

function isCandidate(req, res) {
  if (req.auth.role !== 'candidate') {
    res.status(403).json({ message: 'Candidate access required' });
    return false;
  }
  return true;
}

export function candidateRouter({ logger }) {
  const router = Router();

  router.post('/saved-jobs', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;

    const schema = z.object({ jobId: z.string().uuid() }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    await saveJobForCandidate({ userId: req.auth.userId, jobId: parsed.data.jobId });
    return res.json({ message: 'Saved' });
  });

  router.get('/saved-jobs', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const jobs = await listSavedJobsForCandidate({ userId: req.auth.userId, limit: 200, offset: 0 });
    return res.json({ jobs });
  });

  router.delete('/saved-jobs/:jobId', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    await unsaveJobForCandidate({ userId: req.auth.userId, jobId: req.params.jobId });
    return res.json({ message: 'Unsaved' });
  });

  const professionalSchema = z.object({
    currentJobTitle: z.string().trim().min(1).max(120).optional().nullable(),
    yearsOfExperience: z.number().int().min(0).max(60).optional().nullable(),
    linkedinUrl: z.string().url().optional().nullable(),
    portfolioUrl: z.string().url().optional().nullable()
  });

  router.put('/profile/professional', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;

    const parsed = professionalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
    }

    const updated = await upsertCandidateProfessional({
      userId: req.auth.userId,
      currentJobTitle: parsed.data.currentJobTitle ?? null,
      yearsOfExperience: parsed.data.yearsOfExperience ?? null,
      linkedinUrl: parsed.data.linkedinUrl ?? null,
      portfolioUrl: parsed.data.portfolioUrl ?? null
    });

    return res.json({ candidate: updated });
  });

  const skillSchema = z.object({
    name: z.string().trim().min(1).max(80),
    proficiency: z.string().trim().min(1).max(40).optional().nullable()
  });

  router.get('/skills', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const skills = await listCandidateSkills({ userId: req.auth.userId });
    return res.json({ skills });
  });

  router.post('/skills', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;

    const parsed = skillSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
    }

    const skill = await upsertCandidateSkill({
      userId: req.auth.userId,
      name: parsed.data.name,
      proficiency: parsed.data.proficiency ?? null
    });

    return res.json({ skill });
  });

  router.delete('/skills/:id', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    await deleteCandidateSkill({ userId: req.auth.userId, id: req.params.id });
    return res.json({ message: 'Deleted' });
  });

  const educationSchema = z.object({
    school: z.string().trim().min(1).max(160),
    degree: z.string().trim().max(120).optional().nullable(),
    fieldOfStudy: z.string().trim().max(120).optional().nullable(),
    startDate: z.string().trim().optional().nullable(),
    endDate: z.string().trim().optional().nullable(),
    grade: z.string().trim().max(40).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable()
  });

  router.get('/education', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const items = await listEducation({ userId: req.auth.userId });
    return res.json({ education: items });
  });

  router.post('/education', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const parsed = educationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const e = await addEducation({
      userId: req.auth.userId,
      school: parsed.data.school,
      degree: parsed.data.degree ?? null,
      fieldOfStudy: parsed.data.fieldOfStudy ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      grade: parsed.data.grade ?? null,
      description: parsed.data.description ?? null
    });
    return res.json({ education: e });
  });

  router.put('/education/:id', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const parsed = educationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const updated = await updateEducation({
      userId: req.auth.userId,
      id: req.params.id,
      school: parsed.data.school,
      degree: parsed.data.degree ?? null,
      fieldOfStudy: parsed.data.fieldOfStudy ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      grade: parsed.data.grade ?? null,
      description: parsed.data.description ?? null
    });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    return res.json({ education: updated });
  });

  router.delete('/education/:id', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    await deleteEducation({ userId: req.auth.userId, id: req.params.id });
    return res.json({ message: 'Deleted' });
  });

  const certificationSchema = z.object({
    name: z.string().trim().min(1).max(160),
    issuer: z.string().trim().max(160).optional().nullable(),
    issueDate: z.string().trim().optional().nullable(),
    expiryDate: z.string().trim().optional().nullable(),
    credentialId: z.string().trim().max(120).optional().nullable(),
    credentialUrl: z.string().url().optional().nullable()
  });

  router.get('/certifications', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const items = await listCertifications({ userId: req.auth.userId });
    return res.json({ certifications: items });
  });

  router.post('/certifications', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const parsed = certificationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const c = await addCertification({
      userId: req.auth.userId,
      name: parsed.data.name,
      issuer: parsed.data.issuer ?? null,
      issueDate: parsed.data.issueDate ?? null,
      expiryDate: parsed.data.expiryDate ?? null,
      credentialId: parsed.data.credentialId ?? null,
      credentialUrl: parsed.data.credentialUrl ?? null
    });
    return res.json({ certification: c });
  });

  router.put('/certifications/:id', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const parsed = certificationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const updated = await updateCertification({
      userId: req.auth.userId,
      id: req.params.id,
      name: parsed.data.name,
      issuer: parsed.data.issuer ?? null,
      issueDate: parsed.data.issueDate ?? null,
      expiryDate: parsed.data.expiryDate ?? null,
      credentialId: parsed.data.credentialId ?? null,
      credentialUrl: parsed.data.credentialUrl ?? null
    });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    return res.json({ certification: updated });
  });

  router.delete('/certifications/:id', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    await deleteCertification({ userId: req.auth.userId, id: req.params.id });
    return res.json({ message: 'Deleted' });
  });

  router.get('/resumes', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const items = await listResumes({ userId: req.auth.userId });
    return res.json({ resumes: items });
  });

  router.post('/resumes', authRequired({ logger }), uploadResume.single('file'), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Missing file' });
    if (!isResumeType(file.mimetype, file.originalname)) {
      return res.status(400).json({ message: 'Invalid file type. Use PDF, DOC, or DOCX.' });
    }

    const blobName = `resumes/${req.auth.userId}/${crypto.randomUUID()}-${file.originalname}`;
    const uploaded = await uploadResumeFile({
      buffer: file.buffer,
      contentType: file.mimetype,
      blobName,
      logger
    });

    let extractedText = '';
    try {
      extractedText = await extractTextFromResume({ buffer: file.buffer, contentType: file.mimetype, filename: file.originalname });
    } catch (err) {
      if (logger) logger.warn({ err }, 'resume text extraction failed');
    }

    const existing = await listResumes({ userId: req.auth.userId });
    const isPrimary = existing.length === 0;

    const saved = await addResume({
      userId: req.auth.userId,
      filename: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
      blobName: uploaded.blobName,
      blobUrl: uploaded.url,
      extractedText,
      isPrimary
    });

    return res.json({ resume: saved });
  });

  router.delete('/resumes/:id', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const resume = await findResumeById({ userId: req.auth.userId, id: req.params.id });
    if (!resume) return res.status(404).json({ message: 'Not found' });

    await deleteResumeBlobIfPossible({ blobName: resume.blob_name, logger });
    await deleteResume({ userId: req.auth.userId, id: req.params.id });
    return res.json({ message: 'Deleted' });
  });

  router.put('/resumes/:id/primary', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const updated = await setPrimaryResume({ userId: req.auth.userId, id: req.params.id });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    return res.json({ resume: updated });
  });

  const preferencesSchema = z.object({
    jobAlertsEnabled: z.boolean().optional(),
    emailNotifications: z.record(z.any()).optional(),
    preferredLocations: z.array(z.string().trim().min(1).max(120)).optional(),
    salaryMin: z.number().int().min(0).optional().nullable(),
    salaryMax: z.number().int().min(0).optional().nullable(),
    employmentTypes: z.array(z.string().trim().min(1).max(60)).optional()
  });

  router.get('/preferences', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const prefs = await getPreferences({ userId: req.auth.userId });
    return res.json({ preferences: prefs || null });
  });

  router.put('/preferences', authRequired({ logger }), async (req, res) => {
    if (!isCandidate(req, res)) return;
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });

    const current = await getPreferences({ userId: req.auth.userId });
    const merged = {
      jobAlertsEnabled: parsed.data.jobAlertsEnabled ?? current?.job_alerts_enabled ?? false,
      emailNotifications: parsed.data.emailNotifications ?? current?.email_notifications ?? {},
      preferredLocations: parsed.data.preferredLocations ?? current?.preferred_locations ?? [],
      salaryMin: parsed.data.salaryMin ?? current?.salary_min ?? null,
      salaryMax: parsed.data.salaryMax ?? current?.salary_max ?? null,
      employmentTypes: parsed.data.employmentTypes ?? current?.employment_types ?? []
    };

    if (merged.salaryMin != null && merged.salaryMax != null && merged.salaryMin > merged.salaryMax) {
      return res.status(400).json({ message: 'salaryMin must be <= salaryMax' });
    }

    const updated = await upsertPreferences({ userId: req.auth.userId, ...merged });
    return res.json({ preferences: updated });
  });

  return router;
}

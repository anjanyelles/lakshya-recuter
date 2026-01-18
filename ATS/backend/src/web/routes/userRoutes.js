import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import crypto from 'crypto';

import { authRequired } from '../middleware/authMiddleware.js';
import { findUserById, updateUserBasicProfile, updateUserProfilePictureUrl } from '../../storage/repositories/userRepo.js';
import { findCompanyById } from '../../storage/repositories/companyRepo.js';
import { getCandidateProfileByUserId } from '../../storage/repositories/candidateProfileRepo.js';
import { listCandidateSkills } from '../../storage/repositories/candidateSkillsRepo.js';
import { listEducation } from '../../storage/repositories/candidateEducationRepo.js';
import { listCertifications } from '../../storage/repositories/candidateCertificationsRepo.js';
import { listResumes } from '../../storage/repositories/candidateResumesRepo.js';
import { getPreferences } from '../../storage/repositories/candidatePreferencesRepo.js';
import { sanitizeUserRow } from '../../storage/sanitizeUser.js';
import { permissionsForRole } from '../../domain/permissions.js';
import { deleteProfilePictureIfPossible, uploadProfilePicture } from '../../uploads/azureBlob.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

function isImageType(mimetype) {
  return mimetype === 'image/jpeg' || mimetype === 'image/png';
}

export function userRouter({ logger }) {
  const router = Router();

  router.get('/profile', authRequired({ logger }), async (req, res) => {
    const user = await findUserById(req.auth.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const base = {
      ...sanitizeUserRow(user),
      permissions: permissionsForRole(user.role)
    };

    if (user.company_id) {
      base.company = await findCompanyById(user.company_id);
    }

    if (user.role === 'candidate') {
      const candidate = await getCandidateProfileByUserId(user.id);
      const skills = await listCandidateSkills({ userId: user.id });

      const education = await listEducation({ userId: user.id });
      const certifications = await listCertifications({ userId: user.id });
      const resumes = await listResumes({ userId: user.id });
      const preferences = await getPreferences({ userId: user.id });

      return res.json({
        profile: {
          ...base,
          candidate: candidate || null,
          skills,
          education,
          certifications,
          resumes,
          preferences: preferences || null
        }
      });
    }

    return res.json({ profile: base });
  });

  const basicSchema = z.object({
    firstName: z.string().trim().min(1).max(80).optional().nullable(),
    lastName: z.string().trim().min(1).max(80).optional().nullable(),
    phoneNumber: z.string().trim().min(5).max(30).optional().nullable(),
    location: z.string().trim().min(1).max(120).optional().nullable()
  });

  router.put('/profile/basic', authRequired({ logger }), async (req, res) => {
    const parsed = basicSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
    }

    const updated = await updateUserBasicProfile({
      userId: req.auth.userId,
      firstName: parsed.data.firstName ?? null,
      lastName: parsed.data.lastName ?? null,
      phoneNumber: parsed.data.phoneNumber ?? null,
      location: parsed.data.location ?? null
    });

    return res.json({ profile: sanitizeUserRow(updated) });
  });

  router.post(
    '/profile/picture',
    authRequired({ logger }),
    upload.single('image'),
    async (req, res) => {
      const file = req.file;
      if (!file) return res.status(400).json({ message: 'Missing image file' });
      if (!isImageType(file.mimetype)) return res.status(400).json({ message: 'Invalid file type. Use JPG or PNG.' });

      const user = await findUserById(req.auth.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const ext = file.mimetype === 'image/png' ? 'png' : 'jpg';
      const blobName = `users/${user.id}/${crypto.randomUUID()}.${ext}`;

      const uploaded = await uploadProfilePicture({
        buffer: file.buffer,
        contentType: file.mimetype,
        blobName,
        logger
      });

      await updateUserProfilePictureUrl({ userId: user.id, url: uploaded.url });

      if (user.profile_picture_url) {
        await deleteProfilePictureIfPossible({ url: user.profile_picture_url, logger });
      }

      return res.json({ profilePictureUrl: uploaded.url });
    }
  );

  return router;
}

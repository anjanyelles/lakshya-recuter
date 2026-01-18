import { Router } from 'express';

import { authRequired } from '../middleware/authMiddleware.js';
import { listDepartmentsByCompany } from '../../storage/repositories/departmentRepo.js';

export function departmentRouter({ logger }) {
  const router = Router();

  router.get('/', authRequired({ logger }), async (req, res) => {
    if (req.auth.role !== 'admin' && req.auth.role !== 'recruiter' && req.auth.role !== 'hiring_manager') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const departments = await listDepartmentsByCompany({ companyId: req.auth.companyId });
    return res.json({ departments });
  });

  return router;
}

export const ROLE_PERMISSIONS = {
  admin: ['*'],
  recruiter: ['candidates:read', 'candidates:write', 'jobs:read', 'jobs:write'],
  hiring_manager: ['candidates:read', 'jobs:read'],
  candidate: ['self:read']
};

export function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

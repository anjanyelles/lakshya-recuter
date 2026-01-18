CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'recruiter',
  company_id uuid NULL,
  first_name text NULL,
  last_name text NULL,
  phone_number text NULL,
  location text NULL,
  department text NULL,
  profile_picture_url text NULL,
  is_email_verified boolean NOT NULL DEFAULT false,
  failed_login_attempts int NOT NULL DEFAULT 0,
  lock_until timestamptz NULL,
  last_login timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS fk_users_company_id
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_job_title text NULL,
  years_of_experience int NULL,
  linkedin_url text NULL,
  portfolio_url text NULL,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumes jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  proficiency text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_candidate_skills_user_id ON candidate_skills(user_id);

CREATE TABLE IF NOT EXISTS candidate_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school text NOT NULL,
  degree text NULL,
  field_of_study text NULL,
  start_date date NULL,
  end_date date NULL,
  grade text NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_education_user_id ON candidate_education(user_id);

CREATE TABLE IF NOT EXISTS candidate_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  issuer text NULL,
  issue_date date NULL,
  expiry_date date NULL,
  credential_id text NULL,
  credential_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_certifications_user_id ON candidate_certifications(user_id);

CREATE TABLE IF NOT EXISTS candidate_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes int NOT NULL,
  blob_name text NOT NULL,
  blob_url text NOT NULL,
  extracted_text text NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_resumes_user_id ON candidate_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_resumes_primary ON candidate_resumes(user_id, is_primary);

CREATE TABLE IF NOT EXISTS candidate_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  job_alerts_enabled boolean NOT NULL DEFAULT false,
  email_notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  salary_min int NULL,
  salary_max int NULL,
  employment_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  department_id uuid NULL REFERENCES departments(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  job_title text NULL,
  job_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  work_mode text NULL CHECK (work_mode IN ('remote','hybrid','onsite')),
  employment_type text NULL CHECK (employment_type IN ('full-time','part-time','contract','internship')),
  experience_level text NULL CHECK (experience_level IN ('entry','mid','senior','lead')),
  job_description text NULL,
  key_responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_qualifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_qualifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  nice_to_have_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  salary_min numeric NULL,
  salary_max numeric NULL,
  salary_currency text NOT NULL DEFAULT 'USD',
  salary_visible boolean NOT NULL DEFAULT false,
  benefits_description text NULL,
  bonus_details text NULL,
  application_deadline date NULL,
  number_of_openings int NOT NULL DEFAULT 1,
  required_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  screening_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_hiring_manager_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  assigned_recruiters jsonb NOT NULL DEFAULT '[]'::jsonb,
  pipeline_stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','closed','archived')),
  scheduled_publish_date timestamptz NULL,
  published_at timestamptz NULL,
  closed_at timestamptz NULL,
  views_count int NOT NULL DEFAULT 0,
  applications_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_publish_date ON jobs(scheduled_publish_date);

CREATE INDEX IF NOT EXISTS idx_jobs_published_at ON jobs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_department_id ON jobs(department_id);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs(employment_type);
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_work_mode ON jobs(work_mode);

CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING gin (job_title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_jobs_search_tsv ON jobs USING gin (
  to_tsvector(
    'english',
    unaccent(
      coalesce(job_title, '') || ' ' ||
      coalesce(job_description, '') || ' ' ||
      coalesce((SELECT string_agg(x, ' ') FROM jsonb_array_elements_text(required_skills) x), '')
    )
  )
);

CREATE TABLE IF NOT EXISTS job_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  changed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  field_changed text NOT NULL,
  old_value jsonb NULL,
  new_value jsonb NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_history_changed_at ON job_history(changed_at DESC);

CREATE TABLE IF NOT EXISTS candidate_saved_jobs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_saved_jobs_user_id ON candidate_saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_saved_jobs_job_id ON candidate_saved_jobs(job_id);

CREATE TABLE IF NOT EXISTS job_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewer_hash text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_views_job_id ON job_views(job_id);
CREATE INDEX IF NOT EXISTS idx_job_views_viewed_at ON job_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_views_job_viewer ON job_views(job_id, viewer_hash);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  device_id text NOT NULL,
  ip_address text NULL,
  user_agent text NULL,
  device_type text NULL,
  location text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  revoke_reason text NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS token_blacklist (
  jti text PRIMARY KEY,
  user_id uuid NULL,
  expires_at timestamptz NOT NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

CREATE TABLE IF NOT EXISTS login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  login_time timestamptz NOT NULL DEFAULT now(),
  ip_address text NULL,
  user_agent text NULL,
  device_type text NULL,
  location text NULL,
  success boolean NOT NULL DEFAULT true,
  failure_reason text NULL
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_time ON login_history(user_id, login_time DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_time ON password_history(user_id, created_at DESC);

import { findDueScheduledJobs, publishJob } from '../storage/repositories/jobRepo.js';

export function startJobScheduler({ logger }) {
  const intervalMs = Number(process.env.JOB_SCHEDULER_INTERVAL_MS || 30000);

  async function tick() {
    try {
      const due = await findDueScheduledJobs({ nowTs: new Date() });
      for (const job of due) {
        // eslint-disable-next-line no-await-in-loop
        const published = await publishJob({ jobId: job.id, companyId: job.company_id });
        if (published && logger) {
          logger.info(
            {
              jobId: published.id,
              scheduledPublishDate: job.scheduled_publish_date,
              assignedHiringManagerId: published.assigned_hiring_manager_id,
              assignedRecruiters: published.assigned_recruiters
            },
            'scheduled job auto-published'
          );
        }
      }
    } catch (err) {
      if (logger) logger.error({ err }, 'job scheduler tick failed');
    }
  }

  const handle = setInterval(tick, intervalMs);
  handle.unref?.();
  tick();

  if (logger) logger.info({ intervalMs }, 'job scheduler started');

  return () => clearInterval(handle);
}

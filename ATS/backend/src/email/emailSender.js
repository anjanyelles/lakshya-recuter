import nodemailer from 'nodemailer';

function smtpEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

export async function sendEmail({ logger, to, subject, text, html }) {
  if (!smtpEnabled()) {
    if (logger) logger.info({ to, subject, text }, 'email (dev fallback)');
    return { ok: true, mocked: true };
  }

  const transport = getTransport();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  await transport.sendMail({ from, to, subject, text, html });
  return { ok: true };
}

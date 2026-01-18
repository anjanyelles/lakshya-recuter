export function passwordResetEmail({ toEmail, resetLink }) {
  return {
    to: toEmail,
    subject: 'Reset your password',
    text: `You requested a password reset. Use this link to reset your password: ${resetLink}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>You requested a password reset.</p><p><a href="${resetLink}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`
  };
}

export function passwordChangedEmail({ toEmail }) {
  return {
    to: toEmail,
    subject: 'Your password was changed',
    text: 'Your password was changed successfully. If you did not perform this action, contact support immediately.',
    html: '<p>Your password was changed successfully.</p><p>If you did not perform this action, contact support immediately.</p>'
  };
}

export function accountSecurityAlertEmail({ toEmail, details }) {
  return {
    to: toEmail,
    subject: 'Account security alert',
    text: `Security alert: ${details}`,
    html: `<p><strong>Security alert:</strong> ${details}</p>`
  };
}

import nodemailer from 'nodemailer';

let transporter;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const getTransporter = () => {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, '');
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

  if (!user || !pass) {
    throw new Error('Email delivery is not configured. Set SMTP_USER and SMTP_APP_PASSWORD in server/.env.');
  }
  if (host !== 'smtp.gmail.com') {
    throw new Error('SecureGate is configured for Gmail SMTP. SMTP_HOST must be smtp.gmail.com.');
  }
  if (![465, 587].includes(port) || (port === 465 && !secure) || (port === 587 && secure)) {
    throw new Error('Invalid Gmail SMTP settings. Use port 587 with SMTP_SECURE=false or port 465 with SMTP_SECURE=true.');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: port === 587,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  if (!from) throw new Error('EMAIL_FROM or SMTP_USER must be configured.');
  return getTransporter().sendMail({ from, to, subject, text, html });
};

export const sendLoginOtpEmail = async ({ to, firstName, code, expiresInMinutes = 5 }) => {
  const safeName = escapeHtml(firstName || 'there');
  return sendMail({
    to,
    subject: 'Your SecureGate sign-in verification code',
    text: `Hello ${firstName || 'there'}, your SecureGate verification code is ${code}. It expires in ${expiresInMinutes} minutes. Do not share this code with anyone.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#172033"><h2>SecureGate sign-in verification</h2><p>Hello ${safeName},</p><p>Use this one-time verification code to finish signing in:</p><div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:18px;background:#f3f4f6;text-align:center;border-radius:10px">${code}</div><p>This code expires in ${expiresInMinutes} minutes and can only be used once.</p><p>Never share this code. SecureGate support will never ask you for it.</p></div>`,
  });
};

export const sendEmployeeInvitationEmail = async ({ to, firstName, invitationUrl, expiresInHours = 24 }) => {
  const safeName = escapeHtml(firstName || 'there');
  const safeUrl = escapeHtml(invitationUrl);
  return sendMail({
    to,
    subject: 'You have been invited to SecureGate',
    text: `Hello ${firstName || 'there'}, you have been invited to join SecureGate. Set your password using this one-time link: ${invitationUrl} . The invitation expires in ${expiresInHours} hours.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#172033"><h2>Welcome to SecureGate</h2><p>Hello ${safeName},</p><p>Your organization has created an account for you. Use the secure invitation link below to verify your email and set your own password.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#6d4aff;color:#fff;text-decoration:none;border-radius:8px">Accept invitation</a></p><p>This link expires in ${expiresInHours} hours and can only be used once.</p><p>If you were not expecting this invitation, you can ignore this email.</p></div>`,
  });
};

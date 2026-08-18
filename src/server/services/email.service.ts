import nodemailer from 'nodemailer';
import { getServerRuntime } from '../utils/runtime-config';

export async function sendMail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const cfg = getServerRuntime();
  if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) {
    throw new Error('SMTP is not configured');
  }

  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: {
      user: cfg.smtpUser,
      pass: cfg.smtpPass,
    },
  });

  await transporter.sendMail({
    from: cfg.smtpFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

import { defineEventHandler, getMethod, getRouterParam, readBody, getHeader } from 'h3';
import {
  forgotPasswordInit,
  getOwnerInfo,
  loginUser,
  registerUser,
  resetPassword,
  sendOtp,
  verifyOtp,
} from '../../../services/auth-repository';
import { createUserSession } from '../../../services/session-repository';
import { sendMail } from '../../../services/email.service';
import { apiResponse } from '../../../utils/api-response';
import {
  getAuthUser,
  getClientIp,
  revokeSessionFromEvent,
  setSessionCookie,
} from '../../../utils/auth-session';

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const path = String(getRouterParam(event, 'path') || '');
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'send-otp' && method === 'POST') {
    const body = await readBody(event);
    const identifier = String(body?.phone ?? body?.email ?? '');
    if (!identifier) return apiResponse(0, 'Phone or email is required');
    const { otp } = await sendOtp(identifier);
    if (identifier.includes('@')) {
      try {
        await sendMail({
          to: identifier,
          subject: 'Roomzo OTP Verification',
          html: `<p>Your Roomzo OTP is <strong>${otp}</strong>. It expires in 5 minutes.</p>`,
        });
      } catch {
        // Preserve current behavior: OTP still created even if email transiently fails.
      }
    }
    return apiResponse(1, 'OTP sent successfully');
  }

  if (segments[0] === 'verify-otp' && method === 'POST') {
    const body = await readBody(event);
    const identifier = String(body?.phone ?? body?.email ?? '');
    const otp = String(body?.otp ?? '');
    const ok = await verifyOtp(identifier, otp);
    return apiResponse(ok ? 1 : 0, ok ? 'OTP verified successfully' : 'Invalid or expired OTP');
  }

  if (segments[0] === 'register' && method === 'POST') {
    const body = await readBody(event);
    const user = await registerUser(body);
    return apiResponse(1, 'Registration successful', { user });
  }

  if (segments[0] === 'register-complete' && method === 'POST') {
    const body = await readBody(event);
    const user = await registerUser(body);
    return apiResponse(1, 'Registration completed successfully', { user });
  }

  if ((segments[0] === 'login' || segments[0] === 'login-password') && method === 'POST') {
    const body = await readBody(event);
    const identifier = String(body?.identifier ?? body?.email ?? body?.phone ?? '');
    const password = String(body?.password ?? '');
    const user = await loginUser(identifier, password);
    if (!user) return apiResponse(0, 'Invalid credentials');

    const token = await createUserSession(user.id, {
      userAgent: getHeader(event, 'user-agent') || undefined,
      ip: getClientIp(event),
    });
    setSessionCookie(event, token);
    return apiResponse(1, 'Login successful', { user });
  }

  if (segments[0] === 'logout' && method === 'POST') {
    await revokeSessionFromEvent(event);
    return apiResponse(1, 'Logged out successfully');
  }

  if (segments[0] === 'me' && method === 'GET') {
    const user = await getAuthUser(event);
    if (!user) {
      return apiResponse(0, 'Not authenticated', null);
    }
    return apiResponse(1, 'Session valid', user);
  }

  if (segments[0] === 'owner-info' && segments[1] && method === 'GET') {
    const viewer = await getAuthUser(event);
    const data = await getOwnerInfo(Number(segments[1]));
    if (!data) return apiResponse(0, 'Owner not found', data);
    const isSelf = viewer && Number(viewer.id) === Number(segments[1]);
    return apiResponse(1, 'Owner info fetched successfully', isSelf
      ? data
      : { name: data.name, email: null, phone: null });
  }

  if (segments[0] === 'forgot-password-init' && method === 'POST') {
    const body = await readBody(event);
    const identifier = String(body?.identifier ?? '');
    const sent = await forgotPasswordInit(identifier);
    if (!sent) return apiResponse(0, 'No account found for this identifier');
    if (identifier.includes('@')) {
      try {
        await sendMail({
          to: identifier,
          subject: 'Roomzo Password Reset OTP',
          html: `<p>Your password reset OTP is <strong>${sent.otp}</strong>. It expires in 5 minutes.</p>`,
        });
      } catch {
        // no-op
      }
    }
    const maskedEmail = identifier.includes('@')
      ? identifier.replace(/(.{2}).+(@.+)/, '$1***$2')
      : identifier.replace(/(\d{2})\d+(\d{2})/, '$1****$2');
    return apiResponse(1, 'OTP sent successfully', { email: identifier, maskedEmail });
  }

  if (segments[0] === 'reset-password' && method === 'POST') {
    const body = await readBody(event);
    const ok = await resetPassword(String(body?.email ?? ''), String(body?.otp ?? ''), String(body?.password ?? ''));
    return apiResponse(ok ? 1 : 0, ok ? 'Password reset successful' : 'Could not reset password');
  }

  return apiResponse(0, 'Endpoint not implemented');
});

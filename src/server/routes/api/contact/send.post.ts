import { defineEventHandler, readBody } from 'h3';
import { sendMail } from '../../../services/email.service';
import { apiResponse } from '../../../utils/api-response';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  await sendMail({
    to: 'support@roomzo.in',
    subject: body?.subject || 'Roomzo Contact Form',
    html: `
      <p><strong>Name:</strong> ${body?.name ?? ''}</p>
      <p><strong>Email:</strong> ${body?.email ?? ''}</p>
      <p><strong>Phone:</strong> ${body?.phone ?? ''}</p>
      <p><strong>Message:</strong></p>
      <p>${body?.message ?? ''}</p>
    `,
  });
  return apiResponse(1, 'Message sent successfully');
});

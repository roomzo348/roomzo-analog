import { defineEventHandler, readBody } from 'h3';
import { submitPropertyReport } from '../../../services/report-repository';
import { sendMail } from '../../../services/email.service';
import { apiResponse } from '../../../utils/api-response';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  await submitPropertyReport(body);

  try {
    await sendMail({
      to: 'support@roomzo.in',
      subject: `Property report: ${body?.propertyName ?? body?.propertyId ?? ''}`,
      html: `
        <p><strong>Property:</strong> ${body?.propertyName ?? ''} (${body?.propertyId ?? ''})</p>
        <p><strong>Owner:</strong> ${body?.ownerId ?? ''}</p>
        <p><strong>Reporter:</strong> ${body?.reporterEmail ?? ''}</p>
        <p><strong>Reason:</strong> ${body?.reason ?? ''}</p>
      `,
    });
  } catch {
    // Preserve API success even if notification email fails.
  }

  return apiResponse(1, 'Report submitted successfully');
});

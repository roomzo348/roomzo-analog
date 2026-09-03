import { defineEventHandler, getMethod, setResponseStatus } from 'h3';
import { handleImageUpload } from '../../utils/image-upload';
import { apiResponse } from '../../utils/api-response';

export default defineEventHandler(async (event) => {
  if (getMethod(event).toUpperCase() !== 'POST') {
    setResponseStatus(event, 405);
    return apiResponse(0, 'Method not allowed');
  }

  try {
    return await handleImageUpload(event);
  } catch (err: any) {
    const status = Number(err?.statusCode || 500);
    setResponseStatus(event, status);
    return {
      status: 0,
      message: err?.statusMessage || err?.message || 'Upload failed',
    };
  }
});

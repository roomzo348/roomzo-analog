import { defineEventHandler, getMethod, getRequestURL, setResponseStatus } from 'h3';
import { handleImageUpload } from '../utils/image-upload';

/** Hostinger Node receives /upload.php instead of PHP, so save the file here. */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (path !== '/upload.php' && path !== '/upload.php/') return;
  if (getMethod(event).toUpperCase() !== 'POST') return;

  try {
    return await handleImageUpload(event);
  } catch (err: any) {
    setResponseStatus(event, Number(err?.statusCode || 500));
    return {
      status: 0,
      message: err?.statusMessage || err?.message || 'Upload failed',
    };
  }
});

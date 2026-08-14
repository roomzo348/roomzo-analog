import { defineEventHandler, getRequestURL, sendRedirect } from 'h3';

/** Permanent redirects for legacy URLs → SEO-friendly paths. */
export default defineEventHandler((event) => {
  const { pathname, search } = getRequestURL(event);

  const propertyMatch = pathname.match(/^\/property-details\/([^/]+)\/?$/);
  if (propertyMatch) {
    sendRedirect(event, `/room/${propertyMatch[1]}${search}`, 301);
  }
});

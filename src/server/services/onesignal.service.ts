import { getServerRuntime } from '../utils/runtime-config';

export async function notifyNewProperty(listingId: number, propertyName: string): Promise<void> {
  const cfg = getServerRuntime();
  if (!cfg.onesignalAppId || !cfg.onesignalApiKey) return;

  await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Basic ${cfg.onesignalApiKey}`,
    },
    body: JSON.stringify({
      app_id: cfg.onesignalAppId,
      included_segments: ['All'],
      headings: { en: 'New property listed on Roomzo' },
      contents: { en: propertyName || 'A new listing is available now.' },
      url: `${cfg.siteUrl}/room/${listingId}`,
    }),
  });
}

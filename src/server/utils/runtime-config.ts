import { useRuntimeConfig } from 'nitropack/runtime';

export interface ServerRuntime {
  mysqlHost: string;
  mysqlPort: number;
  mysqlUser: string;
  mysqlPassword: string;
  mysqlDatabase: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  onesignalAppId: string;
  onesignalApiKey: string;
  siteUrl: string;
  nearbySearchRadiusKm: number;
  cashfreeAppId: string;
  cashfreeSecretKey: string;
  cashfreeEnv: string;
  contactPlansJson: string;
  listingRewardCredits: number;
  listingRewardRupees: number;
  adminEmails: string;
  adminUserIds: string;
  uploadSecretKey: string;
}

export function getServerRuntime(): ServerRuntime {
  const runtime = useRuntimeConfig() as Record<string, unknown>;
  // Nitro runtimeConfig values may be baked during the build. Read this
  // deployment-managed value directly as well so changing plan credits does
  // not require the production server to rely on a local/build-time .env file.
  const env = typeof process !== 'undefined' ? process.env : {};
  const runtimeContactPlans = env['CONTACT_PLANS_JSON'];

  return {
    mysqlHost: String(runtime['mysqlHost'] ?? '127.0.0.1'),
    mysqlPort: Number(runtime['mysqlPort'] ?? 3306),
    mysqlUser: String(runtime['mysqlUser'] ?? 'root'),
    mysqlPassword: String(runtime['mysqlPassword'] ?? ''),
    mysqlDatabase: String(runtime['mysqlDatabase'] ?? 'roomzo'),
    smtpHost: String(runtime['smtpHost'] ?? ''),
    smtpPort: Number(runtime['smtpPort'] ?? 587),
    smtpUser: String(runtime['smtpUser'] ?? ''),
    smtpPass: String(runtime['smtpPass'] ?? ''),
    smtpFrom: String(runtime['smtpFrom'] ?? 'support@roomzo.in'),
    onesignalAppId: String(runtime['onesignalAppId'] ?? ''),
    onesignalApiKey: String(runtime['onesignalApiKey'] ?? ''),
    siteUrl: String(runtime['siteUrl'] ?? 'https://www.roomzo.in'),
    nearbySearchRadiusKm: Number(runtime['nearbySearchRadiusKm'] ?? 25),
    cashfreeAppId: String(runtime['cashfreeAppId'] ?? '').trim(),
    cashfreeSecretKey: String(runtime['cashfreeSecretKey'] ?? '').trim(),
    cashfreeEnv: String(runtime['cashfreeEnv'] ?? 'sandbox').trim(),
    contactPlansJson: String(runtimeContactPlans || runtime['contactPlansJson'] || '').trim(),
    listingRewardCredits: Number(
      env['LISTING_REWARD_CREDITS'] || runtime['listingRewardCredits'] || 3
    ),
    listingRewardRupees: Number(
      env['LISTING_REWARD_RUPEES'] || runtime['listingRewardRupees'] || 19
    ),
    adminEmails: [env['ADMIN_EMAIL'], env['ADMIN_EMAILS'], runtime['adminEmails']]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .join(','),
    adminUserIds: String(env['ADMIN_USER_IDS'] || runtime['adminUserIds'] || '').trim(),
    uploadSecretKey: String(env['UPLOAD_SECRET_KEY'] || runtime['uploadSecretKey'] || '').trim(),
  };
}

export function getListingRewardConfig(): { credits: number; rupees: number } {
  const cfg = getServerRuntime();
  const credits = Number(cfg.listingRewardCredits);
  const rupees = Number(cfg.listingRewardRupees);
  return {
    credits: Number.isFinite(credits) && credits >= 0 ? Math.floor(credits) : 3,
    rupees: Number.isFinite(rupees) && rupees >= 0 ? Math.round(rupees) : 19,
  };
}

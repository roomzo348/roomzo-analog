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
}

export function getServerRuntime(): ServerRuntime {
  const runtime = useRuntimeConfig();
  return {
    mysqlHost: String(runtime.mysqlHost ?? '127.0.0.1'),
    mysqlPort: Number(runtime.mysqlPort ?? 3306),
    mysqlUser: String(runtime.mysqlUser ?? 'root'),
    mysqlPassword: String(runtime.mysqlPassword ?? ''),
    mysqlDatabase: String(runtime.mysqlDatabase ?? 'roomzo'),
    smtpHost: String(runtime.smtpHost ?? ''),
    smtpPort: Number(runtime.smtpPort ?? 587),
    smtpUser: String(runtime.smtpUser ?? ''),
    smtpPass: String(runtime.smtpPass ?? ''),
    smtpFrom: String(runtime.smtpFrom ?? 'support@roomzo.in'),
    onesignalAppId: String(runtime.onesignalAppId ?? ''),
    onesignalApiKey: String(runtime.onesignalApiKey ?? ''),
    siteUrl: String(runtime.siteUrl ?? 'https://www.roomzo.in'),
    nearbySearchRadiusKm: Number(runtime.nearbySearchRadiusKm ?? 25),
    cashfreeAppId: String(runtime.cashfreeAppId ?? '').trim(),
    cashfreeSecretKey: String(runtime.cashfreeSecretKey ?? '').trim(),
    cashfreeEnv: String(runtime.cashfreeEnv ?? 'sandbox').trim(),
  };
}

// Build `environment` from server `process.env` (SSR) or Vite `import.meta.env` (client).
// Priority: server env vars (e.g. Render/process) -> Vite vars prefixed with `VITE_` -> Vite vars without prefix -> fallback.

const serverEnv = typeof process !== 'undefined' && (process as any).env ? (process as any).env : {};
const viteEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};

function getEnv(key: string, fallback = ''): string {
  return (serverEnv[key] as string) ?? (viteEnv[`VITE_${key}`] as string) ?? (viteEnv[key] as string) ?? fallback;
}

export const environment = {
  production: (getEnv('NODE_ENV') === 'production') || getEnv('PRODUCTION') === 'true',
  apiUrl: getEnv('API_URL', ''),
  hostingerUploadUrl: getEnv('HOSTINGER_UPLOAD_URL', 'https://roomzo.in').replace(/\/+$/, ''),
  // Must match public/upload.php. This key is sent from the browser, so it is not a server-only secret.
  uploadSecretKey: getEnv('UPLOAD_SECRET_KEY', 'vK9#mP2$xL5@jR8&qW3'),
  firebaseConfig: {
    apiKey: getEnv('FIREBASE_API_KEY', ''),
    authDomain: getEnv('FIREBASE_AUTH_DOMAIN', ''),
    projectId: getEnv('FIREBASE_PROJECT_ID', ''),
    storageBucket: getEnv('FIREBASE_STORAGE_BUCKET', ''),
    messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID', ''),
    appId: getEnv('FIREBASE_APP_ID', ''),
    measurementId: getEnv('FIREBASE_MEASUREMENT_ID', ''),
  }
};

import mysql from 'mysql2/promise';
import { getServerRuntime } from '../utils/runtime-config';

let pool: mysql.Pool | null = null;

export function getMysqlPool(): mysql.Pool {
  if (pool) return pool;
  const cfg = getServerRuntime();
  pool = mysql.createPool({
    host: cfg.mysqlHost,
    port: cfg.mysqlPort,
    user: cfg.mysqlUser,
    password: cfg.mysqlPassword,
    database: cfg.mysqlDatabase,
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0,
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });
  return pool;
}

function isTransientDbError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  const message = String((error as Error)?.message ?? '');
  return (
    code === 'ECONNRESET' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ETIMEDOUT' ||
    message.includes('ECONNRESET') ||
    message.includes('Connection lost')
  );
}

async function withDbRetry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function sqlQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  return withDbRetry(async () => {
    const db = getMysqlPool();
    const [rows] = await db.query(query, params);
    return rows as T[];
  });
}

export async function sqlExecute(
  query: string,
  params: unknown[] = []
): Promise<mysql.ResultSetHeader> {
  return withDbRetry(async () => {
    const db = getMysqlPool();
    const [result] = await db.execute(query, params);
    return result as mysql.ResultSetHeader;
  });
}

import type { Env } from 'hono';

export interface AppEnv extends Env {
  Variables: {
    accountId: string;
    deviceId: string;
  };
}

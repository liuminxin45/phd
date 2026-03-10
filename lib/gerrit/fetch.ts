import { getRuntimeEnv } from '@/lib/settings/runtime-env';

function isTruthy(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function shouldAllowSelfSigned(): boolean {
  return isTruthy(getRuntimeEnv('GERRIT_TLS_INSECURE'));
}

export async function gerritFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (!shouldAllowSelfSigned()) {
    return fetch(input, init);
  }

  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    return await fetch(input, init);
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
    }
  }
}

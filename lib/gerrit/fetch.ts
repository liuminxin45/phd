import { request as httpRequest, type RequestOptions as HttpRequestOptions } from 'node:http';
import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from 'node:https';
import { getRuntimeEnv } from '@/lib/settings/runtime-env';

function isTruthy(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function shouldAllowSelfSigned(): boolean {
  return isTruthy(getRuntimeEnv('GERRIT_TLS_INSECURE'));
}

function normalizeHeaders(initHeaders?: HeadersInit): Record<string, string> {
  if (!initHeaders) return {};

  if (initHeaders instanceof Headers) {
    return Object.fromEntries(initHeaders.entries());
  }

  if (Array.isArray(initHeaders)) {
    return Object.fromEntries(initHeaders);
  }

  return Object.entries(initHeaders).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = String(value);
    }
    return acc;
  }, {});
}

class GerritFetchHeaders {
  constructor(private readonly headers: Record<string, string[]>) {}

  get(name: string): string | null {
    const values = this.headers[name.toLowerCase()];
    if (!values || values.length === 0) return null;
    return values.join(', ');
  }

  getSetCookie(): string[] {
    return this.headers['set-cookie'] || [];
  }
}

export class GerritFetchResponse {
  public readonly ok: boolean;
  public readonly headers: GerritFetchHeaders;

  constructor(
    public readonly status: number,
    public readonly statusText: string,
    headers: Record<string, string[]>,
    private readonly bodyText: string,
  ) {
    this.ok = status >= 200 && status < 300;
    this.headers = new GerritFetchHeaders(headers);
  }

  async text(): Promise<string> {
    return this.bodyText;
  }
}

export async function gerritFetch(input: string | URL, init?: RequestInit): Promise<GerritFetchResponse> {
  const url = input instanceof URL ? input : new URL(input);
  const headers = normalizeHeaders(init?.headers);
  const body = typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : undefined;
  const isHttps = url.protocol === 'https:';
  const requestOptions: HttpRequestOptions | HttpsRequestOptions = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    path: `${url.pathname}${url.search}`,
    method: init?.method || (body ? 'POST' : 'GET'),
    headers,
  };

  if (isHttps && shouldAllowSelfSigned()) {
    (requestOptions as HttpsRequestOptions).rejectUnauthorized = false;
  }

  return new Promise((resolve, reject) => {
    const requestFn = isHttps ? httpsRequest : httpRequest;
    const req = requestFn(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on('end', () => {
        const responseHeaders = Object.entries(res.headers).reduce<Record<string, string[]>>((acc, [key, value]) => {
          if (Array.isArray(value)) {
            acc[key.toLowerCase()] = value;
          } else if (typeof value === 'string') {
            acc[key.toLowerCase()] = [value];
          }
          return acc;
        }, {});

        resolve(new GerritFetchResponse(
          res.statusCode || 0,
          res.statusMessage || '',
          responseHeaders,
          Buffer.concat(chunks).toString('utf-8'),
        ));
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

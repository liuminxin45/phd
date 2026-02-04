export interface HttpClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function httpClient<T = any>(
  endpoint: string,
  options: HttpClientOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    params,
    body,
    headers = {},
    signal,
  } = options;

  const startTime = Date.now();

  const url = new URL(endpoint, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const finalEndpoint = url.pathname + url.search;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(finalEndpoint, fetchOptions);
    const duration = Date.now() - startTime;

    // Handle error responses
    if (!response.ok) {
      let errorDetails: any = null;
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          errorDetails = await response.json();
        } else {
          errorDetails = await response.text();
        }
      } catch {}

      const error = `HTTP ${response.status}: ${response.statusText}`;
      const errorWithDetails =
        errorDetails !== null && errorDetails !== undefined
          ? `${error} | ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)}`
          : error;

      throw new Error(errorWithDetails);
    }

    const data = await response.json();

    return data;
  } catch (err: any) {
    throw err;
  }
}

export async function httpGet<T = any>(
  endpoint: string,
  params?: Record<string, any>
): Promise<T> {
  return httpClient<T>(endpoint, { method: 'GET', params });
}

export async function httpPost<T = any>(
  endpoint: string,
  body?: any,
  params?: Record<string, any>
): Promise<T> {
  return httpClient<T>(endpoint, { method: 'POST', body, params });
}

export async function httpPut<T = any>(
  endpoint: string,
  body?: any,
  params?: Record<string, any>
): Promise<T> {
  return httpClient<T>(endpoint, { method: 'PUT', body, params });
}

export async function httpDelete<T = any>(
  endpoint: string,
  params?: Record<string, any>
): Promise<T> {
  return httpClient<T>(endpoint, { method: 'DELETE', params });
}

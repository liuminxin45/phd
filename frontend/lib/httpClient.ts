/**
 * Centralized HTTP Client
 * 
 * This module provides a unified HTTP client for all API requests.
 * All API calls in the application MUST use this client.
 */

/**
 * HTTP Client Options
 */
export interface HttpClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Unified HTTP Client with automatic debug logging
 * 
 * @param endpoint - API endpoint (e.g., '/api/tasks')
 * @param options - Request options
 * @returns Promise resolving to response data
 * 
 * @example
 * const data = await httpClient('/api/tasks', {
 *   method: 'GET',
 *   params: { assigned: userPhid }
 * });
 */
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

  // Build URL with query params
  const url = new URL(endpoint, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const finalEndpoint = url.pathname + url.search;

  // Prepare fetch options
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
    // Make the request
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
      } catch {
        // ignore parsing errors
      }

      const error = `HTTP ${response.status}: ${response.statusText}`;
      const errorWithDetails =
        errorDetails !== null && errorDetails !== undefined
          ? `${error} | ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)}`
          : error;

      throw new Error(errorWithDetails);
    }

    // Parse response
    const data = await response.json();

    return data;
  } catch (err: any) {
    throw err;
  }
}

/**
 * Convenience method for GET requests
 */
export async function httpGet<T = any>(
  endpoint: string,
  params?: Record<string, any>
): Promise<T> {
  return httpClient<T>(endpoint, { method: 'GET', params });
}

/**
 * Convenience method for POST requests
 */
export async function httpPost<T = any>(
  endpoint: string,
  body?: any,
  params?: Record<string, any>
): Promise<T> {
  return httpClient<T>(endpoint, { method: 'POST', body, params });
}

/**
 * Convenience method for PUT requests
 */
export async function httpPut<T = any>(
  endpoint: string,
  body?: any,
  params?: Record<string, any>
): Promise<T> {
  return httpClient<T>(endpoint, { method: 'PUT', body, params });
}

/**
 * Convenience method for DELETE requests
 */
export async function httpDelete<T = any>(
  endpoint: string,
  params?: Record<string, any>
): Promise<T> {
  return httpClient<T>(endpoint, { method: 'DELETE', params });
}

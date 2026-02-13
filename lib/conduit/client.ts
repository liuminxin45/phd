import { ConduitResponse } from './types';
import { createConduitAuth } from './auth';

export class ConduitClient {
  private host: string;
  private token: string;

  constructor(host: string, token: string) {
    this.host = host;
    this.token = token;
  }

  async call<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    const url = `${this.host}/api/${method}`;
    
    const authParams = {
      ...params,
      ...createConduitAuth(this.token),
    };

    const formData = new URLSearchParams();
    formData.append('params', JSON.stringify(authParams));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const data: ConduitResponse<T> = await response.json();

      if (data.error_code) {
        throw new Error(`Conduit Error [${data.error_code}]: ${data.error_info}`);
      }

      return data.result;
    } catch (error: any) {
      if (error.message?.includes('Conduit Error')) {
        throw error;
      }
      throw new Error(`Conduit API Error: ${error.message}`);
    }
  }

  async search<T = any>(
    method: string,
    constraints: Record<string, any> = {},
    attachments: Record<string, boolean> = {},
    limit: number = 100,
    after: string | null = null,
    queryKey?: string,
    order?: string | string[]
  ): Promise<T> {
    const params: Record<string, any> = {
      constraints,
      limit,
    };

    if (queryKey) {
      params.queryKey = queryKey;
    }

    if (order) {
      params.order = order;
    }

    if (Object.keys(attachments).length > 0) {
      params.attachments = attachments;
    }

    if (after) {
      params.after = after;
    }

    return this.call<T>(method, params);
  }
}

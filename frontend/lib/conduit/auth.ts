import { ConduitAuth } from './types';

export function createConduitAuth(token: string): { __conduit__: ConduitAuth } {
  return {
    __conduit__: {
      token,
    },
  };
}

export type TokenLikeEntry = {
  phid?: string;
  name?: string;
  authorPHID?: string;
};

export function toConduitList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const maybeData = (raw as { data?: unknown }).data;
    if (Array.isArray(maybeData)) return maybeData as T[];
    return Object.values(raw as Record<string, unknown>) as T[];
  }
  return [];
}

export function findLikeTokenPHID(tokensRaw: unknown): string | null {
  const tokens = toConduitList<TokenLikeEntry>(tokensRaw);
  const likeToken = tokens.find((token) => {
    const name = String(token?.name || '').trim().toLowerCase();
    return name === 'like';
  });
  return likeToken?.phid || null;
}

export function extractLikeState(
  tokensRaw: unknown,
  userPHID: string
): { hasLiked: boolean; likeCount: number } {
  const tokens = toConduitList<TokenLikeEntry>(tokensRaw);
  const hasLiked = tokens.some((token) => token.authorPHID === userPHID);
  return { hasLiked, likeCount: tokens.length };
}

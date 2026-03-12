export async function getServerLocalState<T>(key: string): Promise<T | undefined> {
  const response = await fetch(`/api/local-state?key=${encodeURIComponent(key)}`);
  if (!response.ok) return undefined;
  const payload = (await response.json()) as { value?: T };
  return payload.value;
}

export async function setServerLocalState<T>(key: string, value: T): Promise<void> {
  await fetch('/api/local-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
}

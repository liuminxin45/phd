import { useState, useEffect } from 'react';

/**
 * useState that persists to localStorage.
 * Reads initial value from localStorage on mount; writes back on every change.
 * Falls back to `defaultValue` when SSR or key is absent.
 */
export function useLocalStorageState(key: string, defaultValue: string): [string, React.Dispatch<React.SetStateAction<string>>];
export function useLocalStorageState(key: string, defaultValue: number): [number, React.Dispatch<React.SetStateAction<number>>];
export function useLocalStorageState(key: string, defaultValue: boolean): [boolean, React.Dispatch<React.SetStateAction<boolean>>];
export function useLocalStorageState(key: string, defaultValue: string | number | boolean): [any, any] {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    if (typeof defaultValue === 'number') return Number(stored);
    if (typeof defaultValue === 'boolean') return stored === 'true';
    return stored;
  });

  useEffect(() => {
    localStorage.setItem(key, String(value));
  }, [key, value]);

  return [value, setValue];
}

/**
 * Pagination Utilities
 * 
 * Generic helper functions for fetching paginated data from Phabricator API.
 * All Phabricator search APIs have a limit of 100 items per request.
 */

import { SearchResult } from '@/lib/api';
import { httpGet } from '@/lib/httpClient';

export interface PaginationOptions {
  /** Base URL for the API endpoint */
  endpoint: string;
  /** Query parameters to include in each request */
  params?: Record<string, any>;
  /** Maximum number of items to fetch (default: unlimited) */
  maxItems?: number;
  /** Callback for progress updates */
  onProgress?: (fetched: number, total: number) => void;
  /** Label for console logging */
  label?: string;
}

/**
 * Fetch all items from a paginated API endpoint
 * 
 * @template T - The type of items being fetched
 * @param options - Pagination options
 * @returns Promise resolving to array of all fetched items
 * 
 * @example
 * const tasks = await fetchAllPaginated<Task>({
 *   endpoint: '/api/tasks',
 *   params: { assigned: userPhid },
 *   label: 'tasks'
 * });
 */
export async function fetchAllPaginated<T>(
  options: PaginationOptions
): Promise<T[]> {
  const {
    endpoint,
    params = {},
    maxItems,
    onProgress,
    label = 'items',
  } = options;

  const allItems: T[] = [];
  let after: string | null = null;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore) {
    try {
      pageCount++;
      
      // Build query parameters
      const queryParams = { ...params };
      if (after) {
        queryParams.after = after;
      }

      // Fetch page using httpGet (automatically logs to debug panel)
      const data: SearchResult<T> = await httpGet<SearchResult<T>>(endpoint, queryParams);

      // Add items to collection
      if (data.data && data.data.length > 0) {
        allItems.push(...data.data);

        // Call progress callback
        if (onProgress) {
          onProgress(allItems.length, maxItems || allItems.length);
        }

        // Check if we've reached max items
        if (maxItems && allItems.length >= maxItems) {
          hasMore = false;
          break;
        }
      } else {
        // No data returned, stop pagination
        hasMore = false;
        break;
      }

      // Check if there's more data
      if (data.cursor?.after && data.cursor.after !== after) {
        // Only continue if we have a new cursor (different from current)
        after = data.cursor.after;
      } else {
        // No cursor or same cursor means no more data
        hasMore = false;
      }

      // Safety check: prevent infinite loops (max 1000 pages = 100,000 items)
      if (pageCount >= 1000) {
        hasMore = false;
      }
    } catch (err) {
      hasMore = false;
    }
  }

  // Trim to max items if specified
  if (maxItems && allItems.length > maxItems) {
    return allItems.slice(0, maxItems);
  }
  
  return allItems;
}

/**
 * Fetch paginated data with automatic retry on failure
 * 
 * @template T - The type of items being fetched
 * @param options - Pagination options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise resolving to array of all fetched items
 */
export async function fetchAllPaginatedWithRetry<T>(
  options: PaginationOptions,
  maxRetries: number = 3
): Promise<T[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchAllPaginated<T>(options);
    } catch (err) {
      lastError = err as Error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to fetch paginated data');
}

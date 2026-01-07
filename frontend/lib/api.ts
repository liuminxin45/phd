import { httpGet } from './httpClient';

async function fetchAPI<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
  return httpGet<T>(endpoint, params);
}

export interface User {
  phid: string;
  userName: string;
  realName: string;
  image: string;
  uri: string;
  roles: string[];
  primaryEmail: string;
  team: string;
}

export interface Project {
  id: number;
  phid: string;
  fields: {
    name: string;
    slug: string;
    description: string;
    color: {
      key: string;
      name: string;
    };
    icon: {
      key: string;
      name: string;
    };
  };
}

export interface Task {
  id: number;
  phid: string;
  fields: {
    name: string;
    description: string | { raw: string };
    status: {
      value: string;
      name: string;
      color?: string | { raw: string } | null;
    };
    priority: {
      value: number;
      name: string;
      color: string | { raw: string };
    };
    points: number | null;
  };
}

export interface SearchResult<T> {
  data: T[];
  cursor?: {
    limit: number;
    after: string | null;
    before: string | null;
  };
}

export const api = {
  users: {
    me: () => fetchAPI<User>('/api/users/me'),
    list: () => fetchAPI<SearchResult<User>>('/api/users'),
  },
  projects: {
    list: (params?: { members?: string }) => {
      return fetchAPI<SearchResult<Project>>('/api/projects', params);
    },
  },
  tasks: {
    list: (params?: { status?: string; assigned?: string }) => {
      return fetchAPI<SearchResult<Task>>('/api/tasks', params);
    },
  },
};

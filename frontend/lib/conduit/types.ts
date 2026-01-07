export interface ConduitResponse<T = any> {
  result: T;
  error_code?: string;
  error_info?: string;
}

export interface ConduitAuth {
  token: string;
}

export interface ConduitSearchResult<T> {
  data: T[];
  maps: Record<string, any>;
  query: {
    queryKey: string | null;
  };
  cursor: {
    limit: number;
    after: string | null;
    before: string | null;
    order: string | null;
  };
}

export interface User {
  id: number;
  type: string;
  phid: string;
  fields: {
    username: string;
    realName: string;
    roles: string[];
    dateCreated: number;
    dateModified: number;
    policy: {
      view: string;
      edit: string;
    };
  };
  attachments: Record<string, any>;
}

export interface Project {
  id: number;
  type: string;
  phid: string;
  fields: {
    name: string;
    slug: string;
    milestone: number | null;
    depth: number;
    parent: any;
    icon: {
      key: string;
      name: string;
      icon: string;
    };
    color: {
      key: string;
      name: string;
    };
    spacePHID: string | null;
    dateCreated: number;
    dateModified: number;
    policy: {
      view: string;
      edit: string;
      join: string;
    };
    description: string;
  };
  attachments: Record<string, any>;
}

export interface Task {
  id: number;
  type: string;
  phid: string;
  fields: {
    name: string;
    description: string;
    authorPHID: string;
    ownerPHID: string | null;
    status: {
      value: string;
      name: string;
      color: string | null;
    };
    priority: {
      value: number;
      subpriority: number;
      name: string;
      color: string;
    };
    points: number | null;
    subtype: string;
    closerPHID: string | null;
    dateClosed: number | null;
    spacePHID: string | null;
    dateCreated: number;
    dateModified: number;
    policy: {
      view: string;
      interact: string;
      edit: string;
    };
  };
  attachments: Record<string, any>;
  subtasks?: Task[];
  depth?: number;
}

export interface BlogPost {
  id: number;
  type: string;
  phid: string;
  fields: {
    name: string;
    subtitle: string;
    body: string;
    authorPHID: string;
    blogPHID: string;
    datePublished: number | null;
    visibility: string;
    dateCreated: number;
    dateModified: number;
    policy: {
      view: string;
      edit: string;
    };
  };
  attachments: Record<string, any>;
}

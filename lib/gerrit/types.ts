// ─── Gerrit REST API Types ───────────────────────────────────────────────────

export interface GerritAccount {
  _account_id: number;
  name?: string;
  email?: string;
  username?: string;
  avatars?: { url: string; height: number }[];
}

export interface GerritLabelInfo {
  approved?: GerritAccount;
  rejected?: GerritAccount;
  recommended?: GerritAccount;
  disliked?: GerritAccount;
  all?: GerritApproval[];
  default_value?: number;
  values?: Record<string, string>;
}

export interface GerritApproval {
  _account_id: number;
  name?: string;
  email?: string;
  value: number;
  date?: string;
}

export interface GerritChange {
  id: string;
  project: string;
  branch: string;
  topic?: string;
  change_id: string;
  subject: string;
  status: 'NEW' | 'MERGED' | 'ABANDONED' | 'DRAFT';
  created: string;
  updated: string;
  submitted?: string;
  insertions: number;
  deletions: number;
  _number: number;
  owner: GerritAccount;
  labels?: Record<string, GerritLabelInfo>;
  permitted_labels?: Record<string, string[]>;
  reviewers?: {
    REVIEWER?: GerritAccount[];
    CC?: GerritAccount[];
  };
  submittable?: boolean;
  mergeable?: boolean;
  unresolved_comment_count?: number;
  total_comment_count?: number;
  current_revision?: string;
  revisions?: Record<string, GerritRevision>;
  messages?: GerritMessage[];
  _more_changes?: boolean;
}

export interface GerritRevision {
  _number: number;
  created: string;
  uploader: GerritAccount;
  ref: string;
  commit?: {
    subject: string;
    message: string;
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
  };
  files?: Record<string, GerritFileInfo>;
}

export interface GerritFileInfo {
  status?: 'A' | 'D' | 'M' | 'R' | 'C' | 'W';
  old_path?: string;
  lines_inserted?: number;
  lines_deleted?: number;
  size_delta?: number;
  size?: number;
  binary?: boolean;
}

export interface GerritDiffContent {
  a?: string[];
  b?: string[];
  ab?: string[];
  skip?: number;
}

export interface GerritDiffInfo {
  meta_a?: { name: string; content_type: string; lines: number };
  meta_b?: { name: string; content_type: string; lines: number };
  change_type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED' | 'COPIED' | 'REWRITE';
  content: GerritDiffContent[];
  binary?: boolean;
}

export interface GerritMessage {
  id: string;
  author?: GerritAccount;
  real_author?: GerritAccount;
  date: string;
  message: string;
  tag?: string;
  _revision_number?: number;
}

export interface GerritRelatedChange {
  _change_number: number;
  _revision_number: number;
  _current_revision_number?: number;
  change_id?: string;
  commit?: string;
  subject: string;
  status: 'NEW' | 'MERGED' | 'ABANDONED' | 'DRAFT';
  project?: string;
  branch?: string;
}

export interface GerritCommentInfo {
  id: string;
  path?: string;
  patch_set?: number;
  line?: number;
  range?: { start_line: number; start_character: number; end_line: number; end_character: number };
  in_reply_to?: string;
  message: string;
  updated: string;
  author?: GerritAccount;
  unresolved?: boolean;
}

// ─── Frontend / API response types ──────────────────────────────────────────

export interface DashboardSection {
  title: string;
  query: string;
  changes: GerritChange[];
}

export interface DashboardResponse {
  sections: DashboardSection[];
  account?: GerritAccount;
}

export interface FileEntry {
  path: string;
  status?: string;
  linesInserted?: number;
  linesDeleted?: number;
  binary?: boolean;
}

export interface ReviewInput {
  changeId: number;
  revisionId: string;
  message?: string;
  labels?: Record<string, number>;
  comments?: Record<string, { line?: number; message: string; unresolved?: boolean }[]>;
}

export interface ApiBlogPost {
  id: number;
  phid: string;
  title: string;
  slug: string;
  body: string;
  category?: string;
  summary: string;
  authorPHID: string;
  authorName: string;
  authorImage: string | null;
  blogPHID: string;
  datePublished: number;
  dateCreated: number;
  dateModified: number;
  readTime: string;
  tokenCount: number;
  projectPHIDs: string[];
  projectTags: string[];
}

export interface BlogPost {
  id: number;
  title: string;
  summary: string;
  author: string;
  publishedAt: string;
  category: string;
  tags: string[];
  readTime: string;
  featured?: boolean;
  tokenCount: number;
}

export interface PostsResponse {
  data: ApiBlogPost[];
  cursor: { after: string | null };
}

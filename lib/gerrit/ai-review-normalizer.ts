import type {
  AiIssue,
  AiOverview,
  ChangeType,
  IssueCategory,
  RiskLevel,
} from './ai-types';
import type { FileDiffInput } from './ai-diff';

const VALID_RISK_LEVELS = new Set<RiskLevel>(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set<IssueCategory>(['bug', 'performance', 'maintainability', 'style']);
const VALID_CHANGE_TYPES = new Set<ChangeType>([
  'refactor',
  'new-feature',
  'bugfix',
  'config',
  'test',
  'docs',
  'dependency',
  'mixed',
]);

const SEVERITY_WEIGHT: Record<RiskLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const CATEGORY_WEIGHT: Record<IssueCategory, number> = {
  bug: 4,
  performance: 3,
  maintainability: 2,
  style: 1,
};

export interface DiffReferenceIndex {
  changedFiles: Set<string>;
  addedLinesByFile: Map<string, Set<number>>;
  diffLinesByFile: Map<string, string[]>;
  evidenceSnippetsByFile: Map<string, string[]>;
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/^\s*```(?:json)?/gi, '')
    .replace(/```\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampSnippet(snippet: string): string {
  return snippet.trim().slice(0, 200);
}

function normalizeRiskLevel(value: unknown, fallback: RiskLevel = 'low'): RiskLevel {
  return typeof value === 'string' && VALID_RISK_LEVELS.has(value as RiskLevel)
    ? (value as RiskLevel)
    : fallback;
}

function normalizeCategory(value: unknown): IssueCategory {
  return typeof value === 'string' && VALID_CATEGORIES.has(value as IssueCategory)
    ? (value as IssueCategory)
    : 'maintainability';
}

function normalizeChangeTypes(value: unknown): ChangeType[] {
  if (!Array.isArray(value)) return ['mixed'];
  const types = value
    .map((entry) => (typeof entry === 'string' && VALID_CHANGE_TYPES.has(entry as ChangeType) ? entry as ChangeType : null))
    .filter((entry): entry is ChangeType => Boolean(entry));
  return types.length > 0 ? Array.from(new Set(types)).slice(0, 4) : ['mixed'];
}

function normalizeLine(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function normalizeConfidence(value: unknown): RiskLevel | undefined {
  if (typeof value === 'string' && VALID_RISK_LEVELS.has(value as RiskLevel)) {
    return value as RiskLevel;
  }
  return undefined;
}

function isWeakFinding(title: string, description: string): boolean {
  const titleLower = title.toLowerCase();
  const descriptionLower = description.toLowerCase();
  if (title.length < 4 || description.length < 12) return true;
  if (titleLower.includes('建议关注') || titleLower.includes('可进一步确认')) return true;
  if (descriptionLower.includes('可能需要更多上下文') && description.length < 24) return true;
  return false;
}

function pickBestSnippet(index: DiffReferenceIndex, file?: string, line?: number): string | undefined {
  if (!file) return undefined;
  const snippets = index.evidenceSnippetsByFile.get(file) || [];
  if (!snippets.length) return undefined;
  if (!line) return snippets[0];
  const diffLines = index.diffLinesByFile.get(file) || [];
  const matched = diffLines.find((entry) => entry.startsWith(`+${line} | `) || entry.startsWith(` ${line}:`));
  if (matched) {
    const pipeIndex = matched.indexOf('|');
    if (pipeIndex >= 0) return clampSnippet(matched.slice(pipeIndex + 1));
  }
  return snippets[0];
}

function hasSnippetEvidence(index: DiffReferenceIndex, file: string | undefined, snippet: string | undefined): boolean {
  if (!file || !snippet) return false;
  const normalized = snippet.trim();
  if (!normalized) return false;
  return (index.evidenceSnippetsByFile.get(file) || []).some((candidate) => candidate.includes(normalized) || normalized.includes(candidate));
}

function isValidChangedLine(index: DiffReferenceIndex, file: string | undefined, line: number | undefined): boolean {
  if (!file || !line) return false;
  return index.addedLinesByFile.get(file)?.has(line) || false;
}

function sortIssues(issues: AiIssue[]): AiIssue[] {
  return [...issues].sort((a, b) => {
    const severityGap = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (severityGap !== 0) return severityGap;
    const categoryGap = CATEGORY_WEIGHT[b.category] - CATEGORY_WEIGHT[a.category];
    if (categoryGap !== 0) return categoryGap;
    const fileCompare = String(a.file || '').localeCompare(String(b.file || ''));
    if (fileCompare !== 0) return fileCompare;
    return (a.line || 0) - (b.line || 0);
  });
}

export function buildDiffReferenceIndex(files: FileDiffInput[]): DiffReferenceIndex {
  const changedFiles = new Set<string>();
  const addedLinesByFile = new Map<string, Set<number>>();
  const diffLinesByFile = new Map<string, string[]>();
  const evidenceSnippetsByFile = new Map<string, string[]>();

  for (const file of files) {
    changedFiles.add(file.path);
    const addedLines = new Set<number>();
    const diffLines: string[] = [];
    const snippets: string[] = [];
    let oldLine = 1;
    let newLine = 1;

    for (const chunk of file.diff.content || []) {
      if (chunk.skip) {
        oldLine += chunk.skip;
        newLine += chunk.skip;
        continue;
      }

      if (chunk.ab) {
        for (const line of chunk.ab) {
          const normalized = cleanText(line);
          diffLines.push(` ${oldLine}:${newLine} | ${normalized}`);
          if (normalized) snippets.push(normalized);
          oldLine += 1;
          newLine += 1;
        }
      }

      if (chunk.a) {
        for (const line of chunk.a) {
          const normalized = cleanText(line);
          diffLines.push(`-${oldLine} | ${normalized}`);
          if (normalized) snippets.push(normalized);
          oldLine += 1;
        }
      }

      if (chunk.b) {
        for (const line of chunk.b) {
          const normalized = cleanText(line);
          diffLines.push(`+${newLine} | ${normalized}`);
          if (normalized) snippets.push(normalized);
          addedLines.add(newLine);
          newLine += 1;
        }
      }
    }

    addedLinesByFile.set(file.path, addedLines);
    diffLinesByFile.set(file.path, diffLines);
    evidenceSnippetsByFile.set(file.path, snippets.slice(0, 400));
  }

  return {
    changedFiles,
    addedLinesByFile,
    diffLinesByFile,
    evidenceSnippetsByFile,
  };
}

export function normalizeOverview(rawOverview: any, fallbackSummary = ''): AiOverview {
  const summary = cleanText(rawOverview?.summary) || fallbackSummary || '本次变更已完成结构化评审。';
  const focusPoints = Array.isArray(rawOverview?.focusPoints)
    ? rawOverview.focusPoints.map(cleanText).filter(Boolean).slice(0, 3)
    : [];

  return {
    riskLevel: normalizeRiskLevel(rawOverview?.riskLevel, 'low'),
    changeTypes: normalizeChangeTypes(rawOverview?.changeTypes),
    summary,
    focusPoints,
  };
}

export function normalizeIssues(params: {
  rawIssues: any[];
  changeNumber: number;
  diffIndex: DiffReferenceIndex;
}): AiIssue[] {
  const { rawIssues, changeNumber, diffIndex } = params;
  const dedupe = new Set<string>();
  const result: AiIssue[] = [];

  for (const [idx, rawIssue] of (Array.isArray(rawIssues) ? rawIssues : []).entries()) {
    const title = cleanText(rawIssue?.title);
    const description = cleanText(rawIssue?.description);
    if (isWeakFinding(title, description)) continue;

    const category = normalizeCategory(rawIssue?.category);
    const severity = normalizeRiskLevel(rawIssue?.severity, category === 'style' ? 'low' : 'medium');
    const confidence = normalizeConfidence(rawIssue?.confidence);
    const file = cleanText(rawIssue?.file);
    const rawLine = normalizeLine(rawIssue?.line) ?? normalizeLine(rawIssue?.evidence?.line);
    const line = isValidChangedLine(diffIndex, file, rawLine) ? rawLine : undefined;

    if (file && !diffIndex.changedFiles.has(file)) continue;

    const rawSnippet = clampSnippet(cleanText(rawIssue?.evidence?.snippet));
    const evidenceSnippet = hasSnippetEvidence(diffIndex, file, rawSnippet)
      ? rawSnippet
      : pickBestSnippet(diffIndex, file, line);

    const suggestion = cleanText(rawIssue?.suggestion);
    const dedupeKey = [
      category,
      severity,
      file || '',
      line || 0,
      title.replace(/\s+/g, '').toLowerCase(),
    ].join('|');
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    result.push({
      id: `ai-${changeNumber}-${idx}`,
      category,
      severity,
      confidence,
      title,
      description,
      file: file || undefined,
      line,
      suggestion: suggestion && suggestion !== description ? suggestion : undefined,
      evidence: file && evidenceSnippet
        ? {
            file,
            line,
            snippet: evidenceSnippet,
          }
        : undefined,
    });
  }

  return sortIssues(result);
}

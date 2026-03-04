import assert from 'node:assert/strict';
import type { ApiBlogPost } from '../lib/blog/types';
import {
  calcAutoLikeStats,
  clampAutoLikeInterval,
  pickAutoLikeCandidates,
  shuffled,
  trimAutoLikeRecords,
} from '../lib/blog/autoLike';
import { extractLikeState, findLikeTokenPHID, toConduitList } from '../lib/blog/tokenState';

function makePost(id: number, tokenCount: number): ApiBlogPost {
  return {
    id,
    phid: `PHID-POST-${id}`,
    title: `Post ${id}`,
    slug: `post-${id}`,
    body: 'body',
    summary: 'summary',
    authorPHID: 'PHID-USER-test',
    authorName: 'tester',
    authorImage: null,
    blogPHID: 'PHID-BLOG-test',
    datePublished: 0,
    dateCreated: 0,
    dateModified: 0,
    readTime: '1 min',
    tokenCount,
    projectPHIDs: [],
    projectTags: [],
  };
}

function run() {
  assert.equal(clampAutoLikeInterval(0), 1);
  assert.equal(clampAutoLikeInterval(8.9), 8);
  assert.equal(clampAutoLikeInterval(999), 720);

  const posts = [makePost(1, 0), makePost(2, 1), makePost(3, 5)];
  const candidates = pickAutoLikeCandidates(posts);
  assert.deepEqual(candidates.map((p) => p.id), [2, 3]);

  const shuffledCandidates = shuffled(candidates, () => 0);
  assert.equal(shuffledCandidates.length, 2);
  assert.deepEqual(shuffledCandidates.map((p) => p.id), [3, 2]);

  const stats = calcAutoLikeStats([
    { id: '1', time: '2026-01-01T00:00:00.000Z', result: 'success' },
    { id: '2', time: '2026-01-01T00:00:00.000Z', result: 'skipped-liked' },
    { id: '3', time: '2026-01-01T00:00:00.000Z', result: 'error' },
  ]);
  assert.deepEqual(stats, { total: 3, success: 1, skipped: 1, errors: 1 });

  const trimmed = trimAutoLikeRecords(
    Array.from({ length: 80 }).map((_, i) => ({
      id: String(i),
      time: '2026-01-01T00:00:00.000Z',
      result: 'success' as const,
    }))
  );
  assert.equal(trimmed.length, 50);

  const tokenList = toConduitList<{ phid: string; name: string }>({
    data: [
      { phid: 'PHID-TOKN-heart', name: 'Heart' },
      { phid: 'PHID-TOKN-like', name: 'Like' },
    ],
  });
  assert.equal(tokenList.length, 2);
  assert.equal(findLikeTokenPHID(tokenList), 'PHID-TOKN-like');

  const likeState = extractLikeState(
    [
      { authorPHID: 'PHID-USER-a' },
      { authorPHID: 'PHID-USER-test' },
    ],
    'PHID-USER-test'
  );
  assert.deepEqual(likeState, { hasLiked: true, likeCount: 2 });

  console.log(
    JSON.stringify({
      smoke: 'auto-like',
      cases: 7,
      result: 'pass',
    })
  );
}

run();

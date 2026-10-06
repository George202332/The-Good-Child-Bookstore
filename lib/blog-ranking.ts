/**
 * Homepage "From the Journal" selection — pure logic, no database access,
 * so it can be unit tested on its own (tests/blog-ranking.test.ts).
 *
 * Engagement is measured with data that already exists: every read of a
 * post (BlogRead row) and every comment on it (BlogComment row). There is
 * no rating model, so ratings are not part of the score.
 *
 * HOW THE SWITCH WORKS (fully automatic, no admin action or deploy):
 *  1. Each post gets a score: reads + COMMENT_WEIGHT * comments.
 *  2. "Engaged" posts are those scoring at least MIN_ENGAGEMENT_SCORE.
 *  3. If there are HOME_BLOG_COUNT (6) or more engaged posts, the homepage
 *     shows the 6 highest-scoring posts (ties: newest first, then slug).
 *  4. Otherwise the homepage shows the 6 most recently published posts.
 *  The next time the homepage loads after enough posts cross the
 *  threshold, it switches itself from "newest" to "most engaged", and it
 *  switches back the same way if that stops being true.
 *  Never more than 6 posts, never a duplicate, and fewer than 6 when
 *  fewer posts exist.
 */

export const HOME_BLOG_COUNT = 6;
export const MIN_ENGAGEMENT_SCORE = 10;
export const COMMENT_WEIGHT = 3;

export interface RankablePost {
  slug: string;
  publishAt: Date | null;
  createdAt: Date;
  reads: number;
  comments: number;
}

export function engagementScore({ reads, comments }: { reads: number; comments: number }): number {
  return reads + COMMENT_WEIGHT * comments;
}

function publishedTime(p: { publishAt: Date | null; createdAt: Date }): number {
  return (p.publishAt ?? p.createdAt).getTime();
}

function newestFirstThenSlug(a: RankablePost, b: RankablePost): number {
  const diff = publishedTime(b) - publishedTime(a);
  if (diff !== 0) return diff;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

export function selectHomeBlogs<T extends RankablePost>(posts: T[], now: Date = new Date()): T[] {
  // Only posts already live (a future publishAt is not live yet), and
  // only one entry per slug.
  const seen = new Set<string>();
  const live: T[] = [];
  for (const p of posts) {
    if (seen.has(p.slug)) continue;
    if (p.publishAt && p.publishAt.getTime() > now.getTime()) continue;
    seen.add(p.slug);
    live.push(p);
  }

  const ranked = live.filter((p) => engagementScore(p) >= MIN_ENGAGEMENT_SCORE);
  if (ranked.length >= HOME_BLOG_COUNT) {
    return ranked
      .sort((a, b) => engagementScore(b) - engagementScore(a) || newestFirstThenSlug(a, b))
      .slice(0, HOME_BLOG_COUNT);
  }
  return live.sort(newestFirstThenSlug).slice(0, HOME_BLOG_COUNT);
}

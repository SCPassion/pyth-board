export type ForumCategoryTopic = {
  id: number;
  slug: string;
  title: string;
  created_at: string;
  last_posted_at?: string | null;
  highest_post_number?: number;
};

export type KnownDouroTopic = {
  lastPostedAtMs: number;
  highestPostNumber: number;
};

export function selectChangedDouroTopics(
  topics: ForumCategoryTopic[],
  knownTopics: Map<number, KnownDouroTopic>,
  options: { force?: boolean } = {}
): ForumCategoryTopic[] {
  return topics.filter((topic) => {
    if (!/^Pyth Pro:\s+Douro Labs Report\b/i.test(topic.title)) return false;
    if (options.force) return true;

    const known = knownTopics.get(topic.id);
    if (!known) return true;

    const lastPostedAtMs = Date.parse(topic.last_posted_at ?? topic.created_at);
    const highestPostNumber = topic.highest_post_number ?? 1;

    return (
      lastPostedAtMs !== known.lastPostedAtMs ||
      highestPostNumber !== known.highestPostNumber
    );
  });
}

type TopicLike = {
  id: number;
  slug: string;
  title: string;
  created_at: string;
  last_posted_at: string;
};

type PostLike = {
  id: number;
  post_number: number;
  created_at: string;
  username: string;
  name?: string | null;
  cooked: string;
};

type Window = {
  startMs: number;
  endMs: number;
};

export function getCandidateTopicsForWindow(
  topics: TopicLike[],
  { startMs, endMs }: Window
) {
  return topics.filter((topic) => {
    const createdAtMs = Date.parse(topic.created_at);
    const lastPostedAtMs = Date.parse(topic.last_posted_at);

    return (
      (createdAtMs >= startMs && createdAtMs < endMs) ||
      (lastPostedAtMs >= startMs && lastPostedAtMs < endMs)
    );
  });
}

export function stripCookedHtmlToText(cooked: string) {
  return cooked.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeTopicPostToSourceItem({
  category,
  weekKey,
  topic,
  post,
  rangeStartMs,
}: {
  category: string;
  weekKey: string;
  topic: Pick<TopicLike, "id" | "slug" | "title" | "created_at">;
  post: PostLike;
  rangeStartMs: number;
}) {
  const createdAtMs = Date.parse(post.created_at);
  const topicCreatedAtMs = Date.parse(topic.created_at);
  const contentText = stripCookedHtmlToText(post.cooked);

  return {
    source: "forum",
    category,
    topicId: topic.id,
    postId: post.id,
    topicTitle: topic.title,
    topicSlug: topic.slug,
    url: `https://forum.pyth.network/t/${topic.slug}/${topic.id}/${post.post_number}`,
    authorUsername: post.username,
    authorName: post.name ?? undefined,
    createdAtMs,
    weekKey,
    isTopicOp: post.post_number === 1,
    isNewTopicThisWeek: topicCreatedAtMs >= rangeStartMs,
    contentText,
    rawJson: JSON.stringify(post),
    signalScore: Math.min(contentText.length, 1000),
  };
}

export function getDigestWindowPosts<
  T extends {
    created_at: string;
  },
>(posts: T[], { startMs, endMs }: Window) {
  return posts.filter((post) => {
    const createdAtMs = Date.parse(post.created_at);
    return createdAtMs >= startMs && createdAtMs < endMs;
  });
}

export function summarizeSourceCounts(
  items: Array<{ topicId: number; category?: string }>
) {
  return {
    forumPosts: items.length,
    forumTopics: new Set(items.map((item) => item.topicId)).size,
  };
}

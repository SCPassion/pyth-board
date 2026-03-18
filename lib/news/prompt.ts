type PromptSourceItem = {
  topicTitle?: string;
  authorUsername?: string;
  contentText?: string;
  url?: string;
};

export function buildDigestPrompt(input: {
  weekLabel: string;
  sourceItems: PromptSourceItem[];
}) {
  const items =
    input.sourceItems.length === 0
      ? "No source items were collected for this week."
      : input.sourceItems
          .map((item, index) => {
            return [
              `Source ${index + 1}`,
              `Title: ${item.topicTitle ?? "Untitled"}`,
              `Author: ${item.authorUsername ?? "unknown"}`,
              `URL: ${item.url ?? "missing"}`,
              `Content: ${item.contentText ?? ""}`,
            ].join("\n");
          })
          .join("\n\n");

  return [
    `Generate a weekly Pyth digest for ${input.weekLabel}.`,
    "Only use the supplied forum content.",
    "Do not use outside knowledge or speculate.",
    "Return a concise factual digest with sections.",
    "Every section must include source links taken directly from the supplied URLs.",
    "Write each section as clean prose, not bullets.",
    "Do not put URLs or source references in the summary text.",
    "",
    items,
  ].join("\n");
}

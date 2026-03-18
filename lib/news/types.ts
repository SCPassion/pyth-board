export type NewsDigestSectionSource = {
  label: string;
  url: string;
};

export type NewsDigestSection = {
  title: string;
  summary: string;
  bullets?: string[];
  sources?: NewsDigestSectionSource[];
};

export type NewsDigest = {
  _id?: string;
  weekKey: string;
  rangeStartMs: number;
  rangeEndMs: number;
  status: string;
  title: string;
  summary: string;
  sections: NewsDigestSection[];
  sourceCounts: {
    forumPosts: number;
    forumTopics: number;
  };
  model: string;
  promptVersion: string;
  generatedAtMs: number;
  errorMessage?: string;
};

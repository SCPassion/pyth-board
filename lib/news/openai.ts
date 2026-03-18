export type DigestSectionSource = {
  label: string;
  url: string;
};

export type DigestSection = {
  title: string;
  summary?: string;
  bullets?: string[];
  sources?: DigestSectionSource[];
};

export type DigestOutput = {
  title: string;
  summary: string;
  sections: DigestSection[];
};

function cleanBulletText(text: string) {
  return text
    .replace(/\s*\(Sources?:[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSourceOnlyBullet(text: string) {
  return /^sources?:\s+/i.test(text.trim());
}

function cleanSummaryText(text: string) {
  return text
    .replace(/\s*\(Sources?:[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDigestResponse(response: DigestOutput) {
  return {
    title: response.title,
    summary: response.summary,
    sections: response.sections.map((section) => ({
      title: section.title,
      summary:
        "summary" in section && typeof section.summary === "string"
          ? cleanSummaryText(section.summary)
          : (section.bullets ?? [])
              .filter((bullet) => !isSourceOnlyBullet(bullet))
              .map(cleanBulletText)
              .filter(Boolean)
              .join(" "),
      sources: section.sources ?? [],
    })),
  };
}

export function getDigestResponseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary", "sections"],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "summary", "sources"],
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            sources: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "url"],
                properties: {
                  label: { type: "string" },
                  url: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

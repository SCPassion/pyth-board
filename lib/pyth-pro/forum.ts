export type DouroReportPostInput = {
  topicId: number;
  title: string;
  slug: string;
  url: string;
  authorUsername: string;
  createdAt: string;
  lastPostedAt: string;
  highestPostNumber: number;
  cooked: string;
};

export type RevenueRow = {
  product: string;
  splitLabel?: string;
  grossRevenueUsd?: number;
  daoShareUsd?: number;
  daoSharePyth?: number;
  douroLabsUsd?: number;
  isTotal: boolean;
};

export type LegacySummaryRow = {
  label: string;
  usdValue: number;
};

export type DouroDistribution = {
  tokenAmount?: number;
  usdValue?: number;
  tokenSymbol: "PYTH" | "USDC";
  twapUsd?: number;
  pythPerUsd?: number;
};

export type ParsedDouroReport = {
  topicId: number;
  title: string;
  slug: string;
  url: string;
  authorUsername: string;
  createdAtMs: number;
  lastPostedAtMs: number;
  highestPostNumber: number;
  reportPeriodLabel?: string;
  distribution?: DouroDistribution;
  monthlyRevenueRows: RevenueRow[];
  cumulativeRevenueRows: RevenueRow[];
  legacySummaryRows: LegacySummaryRow[];
  monthlyGrossRevenueUsd?: number;
  monthlyDaoShareUsd?: number;
  monthlyDouroLabsUsd?: number;
  cumulativeGrossRevenueUsd?: number;
  cumulativeDaoShareUsd?: number;
  cumulativeDouroLabsUsd?: number;
};

export function parseDouroReportPost(input: DouroReportPostInput): ParsedDouroReport {
  const tables = extractTables(input.cooked);
  const revenueTables = tables.filter((table) =>
    isRevenueBreakdownHeader(table.rows[0] ?? [])
  );
  const monthlyTable =
    tables.find((table) => /revenue breakdown/i.test(table.heading)) ??
    revenueTables.find((table) => hasPythShare(table.rows));
  const cumulativeTable =
    tables.find((table) => /cumulative revenue/i.test(table.heading)) ??
    revenueTables.find((table) => table !== monthlyTable && !hasPythShare(table.rows));
  const legacyTable = cumulativeTable ?? tables.find((table) =>
    isLegacySummaryHeader(table.rows[0] ?? [])
  );
  const monthlyAndCumulativeTable = tables.find((table) =>
    isMonthlyAndCumulativeHeader(table.rows[0] ?? [])
  );
  const monthlyRevenueRows = monthlyTable ? parseRevenueRows(monthlyTable.rows) : [];
  const cumulativeRevenueRows = cumulativeTable
    ? parseRevenueRows(cumulativeTable.rows)
    : [];
  const legacySummaryRows =
    cumulativeRevenueRows.length === 0 && legacyTable
      ? parseLegacySummaryRows(legacyTable.rows)
      : [];
  const monthlyTotal = findTotalRow(monthlyRevenueRows);
  const cumulativeTotal = findTotalRow(cumulativeRevenueRows);
  const legacyTotals = summarizeLegacyRows(legacySummaryRows);
  const metricTableTotals = monthlyAndCumulativeTable
    ? summarizeMonthlyAndCumulativeRows(monthlyAndCumulativeTable.rows)
    : {};

  return {
    topicId: input.topicId,
    title: input.title,
    slug: input.slug,
    url: input.url,
    authorUsername: input.authorUsername,
    createdAtMs: Date.parse(input.createdAt),
    lastPostedAtMs: Date.parse(input.lastPostedAt),
    highestPostNumber: input.highestPostNumber,
    reportPeriodLabel: extractReportPeriod(input.cooked),
    distribution: extractDistribution(input.cooked),
    monthlyRevenueRows,
    cumulativeRevenueRows,
    legacySummaryRows,
    monthlyGrossRevenueUsd:
      monthlyTotal?.grossRevenueUsd ?? metricTableTotals.monthlyGrossRevenueUsd,
    monthlyDaoShareUsd:
      monthlyTotal?.daoShareUsd ?? metricTableTotals.monthlyDaoShareUsd,
    monthlyDouroLabsUsd:
      monthlyTotal?.douroLabsUsd ?? metricTableTotals.monthlyDouroLabsUsd,
    cumulativeGrossRevenueUsd:
      cumulativeTotal?.grossRevenueUsd ??
      legacyTotals.grossRevenueUsd ??
      metricTableTotals.cumulativeGrossRevenueUsd,
    cumulativeDaoShareUsd:
      cumulativeTotal?.daoShareUsd ??
      legacyTotals.daoShareUsd ??
      metricTableTotals.cumulativeDaoShareUsd,
    cumulativeDouroLabsUsd:
      cumulativeTotal?.douroLabsUsd ??
      legacyTotals.douroLabsUsd ??
      metricTableTotals.cumulativeDouroLabsUsd,
  };
}

type ExtractedTable = {
  heading: string;
  rows: string[][];
};

function extractTables(html: string): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  const blockPattern =
    /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>|<p>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>|<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>|<table[^>]*>([\s\S]*?)<\/table>/gi;
  let currentHeading = "";
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(html)) !== null) {
    if (match[2] !== undefined) {
      currentHeading = decodeText(stripTags(match[2]));
      continue;
    }
    if (match[3] !== undefined) {
      currentHeading = decodeText(stripTags(match[3]));
      continue;
    }

    const rows =
      match[4] !== undefined
        ? parseMarkdownPipeTable(decodeEntities(match[4]))
        : parseHtmlTable(match[5] ?? "");
    if (rows.length > 0) {
      tables.push({ heading: currentHeading, rows });
    }
  }

  return tables;
}

function parseMarkdownPipeTable(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => normalizePipeTableLine(line))
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .filter((line) => !/^\|[\s:-]+\|/.test(line.replace(/\|/g, "|")))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => decodeText(stripTags(cell)).trim())
    )
    .filter((cells) => !cells.every((cell) => /^[-:\s]+$/.test(cell)));
}

function normalizePipeTableLine(line: string): string {
  return line.trim().replace(/^`+/, "").replace(/`+$/, "").trim();
}

function parseHtmlTable(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) =>
      [...rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(
        (cellMatch) => decodeText(stripTags(cellMatch[1]))
      )
    )
    .filter((row) => row.length > 0);
}

function parseRevenueRows(tableRows: string[][]): RevenueRow[] {
  const [header, ...bodyRows] = tableRows;
  if (!isRevenueBreakdownHeader(header ?? [])) return [];
  return bodyRows.map((cells) => {
    const productCell = cells[0] ?? "";
    const productMatch = productCell.match(/^(.+?)\s*\(([^)]+)\)$/);
    const product = (productMatch?.[1] ?? productCell).trim();
    const splitLabel = productMatch?.[2]?.trim();
    const daoShare = cells[2] ?? "";
    const row: RevenueRow = {
      product,
      isTotal: /^total$/i.test(product),
    };

    if (splitLabel) {
      row.splitLabel = splitLabel;
    }

    const grossRevenueUsd = parseUsd(cells[1] ?? "");
    const daoSharePyth = parsePyth(daoShare);
    const daoShareUsd = parseUsd(daoShare);
    const douroLabsUsd = parseUsd(cells[3] ?? "");

    if (grossRevenueUsd !== undefined) row.grossRevenueUsd = grossRevenueUsd;
    if (daoSharePyth !== undefined) row.daoSharePyth = daoSharePyth;
    if (daoShareUsd !== undefined) row.daoShareUsd = daoShareUsd;
    if (douroLabsUsd !== undefined) row.douroLabsUsd = douroLabsUsd;

    return row;
  });
}

function isRevenueBreakdownHeader(header: string[]): boolean {
  const normalized = header.map((cell) => cell.toLowerCase());
  return (
    normalized.some((cell) => cell === "product") &&
    normalized.some((cell) => /gross revenue/.test(cell)) &&
    normalized.some((cell) => /dao share/.test(cell)) &&
    normalized.some((cell) => /douro labs/.test(cell))
  );
}

function hasPythShare(rows: string[][]): boolean {
  return rows.some((cells) =>
    cells.slice(1).some((cell) => /\bPYTH\b/i.test(cell))
  );
}

function findTotalRow(rows: RevenueRow[]): RevenueRow | undefined {
  return rows.find((row) => row.isTotal);
}

function parseLegacySummaryRows(tableRows: string[][]): LegacySummaryRow[] {
  const firstRowIsHeader = isRevenueBreakdownHeader(tableRows[0] ?? []);
  const bodyRows = firstRowIsHeader ? tableRows.slice(1) : tableRows;
  return bodyRows.flatMap((cells) => {
    const usdValue = parseUsd(cells[1] ?? "");
    if (usdValue === undefined) return [];
    return [{ label: cells[0] ?? "", usdValue }];
  });
}

function isLegacySummaryHeader(header: string[]): boolean {
  return header.length === 2 && parseUsd(header[1] ?? "") !== undefined;
}

function isMonthlyAndCumulativeHeader(header: string[]): boolean {
  return (
    header.length >= 3 &&
    /total\s*\(since/i.test(header[2] ?? "") &&
    !isRevenueBreakdownHeader(header)
  );
}

function summarizeLegacyRows(rows: LegacySummaryRow[]): {
  grossRevenueUsd?: number;
  daoShareUsd?: number;
  douroLabsUsd?: number;
} {
  const find = (pattern: RegExp) =>
    rows.find((row) => pattern.test(row.label))?.usdValue;
  return {
    grossRevenueUsd: find(/total subscribed revenue|gross revenue/i),
    daoShareUsd: find(/^dao(?: share)?$/i),
    douroLabsUsd: find(/douro labs/i),
  };
}

function summarizeMonthlyAndCumulativeRows(tableRows: string[][]): {
  monthlyGrossRevenueUsd?: number;
  monthlyDaoShareUsd?: number;
  monthlyDouroLabsUsd?: number;
  cumulativeGrossRevenueUsd?: number;
  cumulativeDaoShareUsd?: number;
  cumulativeDouroLabsUsd?: number;
} {
  const [, ...bodyRows] = tableRows;
  const findRow = (pattern: RegExp) =>
    bodyRows.find((cells) => pattern.test(cells[0] ?? ""));
  const revenue = findRow(/subscribed revenue|gross revenue/i);
  const dao = findRow(/^dao/i);
  const douro = findRow(/douro labs/i);

  return {
    monthlyGrossRevenueUsd: parseUsd(revenue?.[1] ?? ""),
    monthlyDaoShareUsd: parseUsd(dao?.[1] ?? ""),
    monthlyDouroLabsUsd: parseUsd(douro?.[1] ?? ""),
    cumulativeGrossRevenueUsd: parseUsd(revenue?.[2] ?? ""),
    cumulativeDaoShareUsd: parseUsd(dao?.[2] ?? ""),
    cumulativeDouroLabsUsd: parseUsd(douro?.[2] ?? ""),
  };
}

function extractDistribution(html: string): DouroDistribution | undefined {
  const text = decodeText(stripTags(html));
  const pythMatch = text.match(
    /distribution of\s+\**([\d,]+)\s+PYTH\**\s+\(\$\s*([\d,]+)(?:\s+USD equivalent)?\)/i
  );
  if (pythMatch) {
    const twapMatch = text.match(
      /TWAP of\s+\**\$([\d.]+)\s+\(\$1\s*=\s*([\d.]+)\s+PYTH\)\**/i
    );
    return {
      tokenAmount: parseNumber(pythMatch[1]),
      usdValue: parseNumber(pythMatch[2]),
      tokenSymbol: "PYTH",
      twapUsd: twapMatch ? Number(twapMatch[1]) : undefined,
      pythPerUsd: twapMatch ? Number(twapMatch[2]) : undefined,
    };
  }

  const usdcMatch = text.match(/distribution of\s+\**\$?([\d,]+)\s+USDC/i);
  if (!usdcMatch) return undefined;
  return {
    tokenAmount: parseNumber(usdcMatch[1]),
    usdValue: parseNumber(usdcMatch[1]),
    tokenSymbol: "USDC",
  };
}

function extractReportPeriod(html: string): string | undefined {
  const text = decodeText(stripTags(html));
  const match = text.match(/for\s+(.+?\d{4}\s+to\s+.+?\d{4})[,.\s]/i);
  return match?.[1]?.trim();
}

function parseUsd(value: string): number | undefined {
  const parenthesized = value.match(/\(\$\s*([\d,]+)\)/);
  const plain = value.match(/\$\s*([\d,]+)/);
  return parseNumber(parenthesized?.[1] ?? plain?.[1]);
}

function parsePyth(value: string): number | undefined {
  const match = value.match(/([\d,]+)\s+PYTH/i);
  return parseNumber(match?.[1]);
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  return Number(value.replace(/,/g, ""));
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeText(value: string): string {
  return decodeEntities(value)
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

import { describe, expect, it } from "vitest";

import { parseDouroReportPost } from "@/lib/pyth-pro/forum";

describe("parseDouroReportPost", () => {
  it("extracts a dynamic monthly revenue breakdown with DAO PYTH amounts", () => {
    const report = parseDouroReportPost({
      topicId: 2660,
      title: "Pyth Pro: Douro Labs Report - July 2026",
      slug: "pyth-pro-douro-labs-report-july-2026",
      url: "https://forum.pyth.network/t/2660",
      authorUsername: "zenyas",
      createdAt: "2026-08-04T12:00:00.000Z",
      lastPostedAt: "2026-08-04T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `
        <p>Today, Douro Labs made the ninth distribution of <strong>7,662,509 PYTH</strong> ($340,384 USD equivalent) to the DAO.
        Per CO-PIP-104, this distribution is paid in PYTH tokens at the July monthly TWAP of <strong>$0.044422 ($1 = 22.51 PYTH)</strong>.</p>
        <p>This distribution covers revenue from Pyth Pro subscriptions, Listing as a Service (LaaS), and Index Revenue Share for July 1st 2026 to August 1st 2026.</p>
        <h3>July Revenue Breakdown</h3>
        <pre><code>| Product       | Gross Revenue | DAO Share                 | Douro Labs |
|---------------|---------------|---------------------------|------------|
| Pyth Pro (60/40) | $538,391   | 7,271,937 PYTH ($323,034) | $215,356   |
| LaaS (90/10)     | $9,500     | 192,472 PYTH ($8,550)     | $950       |
| Indices (60/40)  | $14,667    | 198,100 PYTH ($8,800)     | $5,867     |
| Total            | $562,557   | 7,662,509 PYTH ($340,384) | $222,173   |</code></pre>
        <h3>Cumulative Revenue (since Sept 2025)</h3>
        <pre><code>| Product | Gross Revenue | DAO Share | Douro Labs |
|---------|---------------|-----------|------------|
| Pyth Pro | $2,425,079 | $1,455,047 | $970,031 |
| LaaS | $59,500 | $53,550 | $5,950 |
| Indices | $17,667 | $10,600 | $7,067 |
| Total | $2,502,246 | $1,519,197 | $983,048 |</code></pre>
      `,
    });

    expect(report.distribution).toEqual({
      tokenAmount: 7_662_509,
      usdValue: 340_384,
      tokenSymbol: "PYTH",
      twapUsd: 0.044422,
      pythPerUsd: 22.51,
    });
    expect(report.reportPeriodLabel).toBe("July 1st 2026 to August 1st 2026");
    expect(report.monthlyRevenueRows).toEqual([
      {
        product: "Pyth Pro",
        splitLabel: "60/40",
        grossRevenueUsd: 538_391,
        daoShareUsd: 323_034,
        daoSharePyth: 7_271_937,
        douroLabsUsd: 215_356,
        isTotal: false,
      },
      {
        product: "LaaS",
        splitLabel: "90/10",
        grossRevenueUsd: 9_500,
        daoShareUsd: 8_550,
        daoSharePyth: 192_472,
        douroLabsUsd: 950,
        isTotal: false,
      },
      {
        product: "Indices",
        splitLabel: "60/40",
        grossRevenueUsd: 14_667,
        daoShareUsd: 8_800,
        daoSharePyth: 198_100,
        douroLabsUsd: 5_867,
        isTotal: false,
      },
      {
        product: "Total",
        grossRevenueUsd: 562_557,
        daoShareUsd: 340_384,
        daoSharePyth: 7_662_509,
        douroLabsUsd: 222_173,
        isTotal: true,
      },
    ]);
    expect(report.cumulativeRevenueRows.at(-1)).toMatchObject({
      product: "Total",
      grossRevenueUsd: 2_502_246,
      daoShareUsd: 1_519_197,
      douroLabsUsd: 983_048,
      isTotal: true,
    });
    expect(report.monthlyGrossRevenueUsd).toBe(562_557);
    expect(report.monthlyDaoShareUsd).toBe(340_384);
    expect(report.monthlyDouroLabsUsd).toBe(222_173);
    expect(report.cumulativeGrossRevenueUsd).toBe(2_502_246);
    expect(report.cumulativeDaoShareUsd).toBe(1_519_197);
    expect(report.cumulativeDouroLabsUsd).toBe(983_048);
  });

  it("extracts revenue rows from Discourse HTML tables", () => {
    const report = parseDouroReportPost({
      topicId: 2508,
      title: "Pyth Pro: Douro Labs Report - April 2026",
      slug: "pyth-pro-douro-labs-report-april-2026",
      url: "https://forum.pyth.network/t/2508",
      authorUsername: "zenyas",
      createdAt: "2026-05-06T12:00:00.000Z",
      lastPostedAt: "2026-05-06T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `
        <p>Today, Douro Labs made the sixth distribution of <strong>5,059,107 PYTH</strong> ($229,132 USD equivalent) to the DAO.
        Per CO-PIP-104, this distribution is paid in PYTH tokens at the April monthly TWAP of <strong>$0.045291 ($1 = 22.08 PYTH)</strong>.</p>
        <h3>April Revenue Breakdown</h3>
        <table>
          <thead><tr><th>Product</th><th>Gross Revenue</th><th>DAO Share</th><th>Douro Labs</th></tr></thead>
          <tbody>
            <tr><td>Pyth Pro (60/40)</td><td>$320,387</td><td>4,244,656 PYTH ($192,232)</td><td>$128,155</td></tr>
            <tr><td>LaaS (90/10)</td><td>$41,000</td><td>814,451 PYTH ($36,900)</td><td>$4,100</td></tr>
            <tr><td>Marketplace</td><td>$0</td><td>$0</td><td>$0</td></tr>
            <tr><td>Total</td><td>$361,387</td><td>5,059,107 PYTH ($229,132)</td><td>$132,255</td></tr>
          </tbody>
        </table>
      `,
    });

    expect(report.monthlyRevenueRows).toEqual([
      {
        product: "Pyth Pro",
        splitLabel: "60/40",
        grossRevenueUsd: 320_387,
        daoShareUsd: 192_232,
        daoSharePyth: 4_244_656,
        douroLabsUsd: 128_155,
        isTotal: false,
      },
      {
        product: "LaaS",
        splitLabel: "90/10",
        grossRevenueUsd: 41_000,
        daoShareUsd: 36_900,
        daoSharePyth: 814_451,
        douroLabsUsd: 4_100,
        isTotal: false,
      },
      {
        product: "Marketplace",
        grossRevenueUsd: 0,
        daoShareUsd: 0,
        douroLabsUsd: 0,
        isTotal: false,
      },
      {
        product: "Total",
        grossRevenueUsd: 361_387,
        daoShareUsd: 229_132,
        daoSharePyth: 5_059_107,
        douroLabsUsd: 132_255,
        isTotal: true,
      },
    ]);
  });

  it("associates Discourse strong-paragraph headings with attributed code tables", () => {
    const report = parseDouroReportPost({
      topicId: 2660,
      title: "Pyth Pro: Douro Labs Report — July 2026",
      slug: "pyth-pro-douro-labs-report-july-2026",
      url: "https://forum.pyth.network/t/pyth-pro-douro-labs-report-july-2026/2660",
      authorUsername: "zenyas",
      createdAt: "2026-08-04T12:00:00.000Z",
      lastPostedAt: "2026-08-04T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `
        <p>Today, Douro Labs made the ninth distribution of <a href="https://explorer.solana.com/tx/abc">**7,662,509</a> PYTH** ($340,384 USD equivalent) to the DAO.
        Per CO-PIP-104, this distribution is paid in PYTH tokens at the July monthly TWAP of <strong>$0.044422 ($1 = 22.51 PYTH)</strong>.</p>
        <p><strong>July Revenue Breakdown</strong></p>
        <pre><code class="lang-auto">| Product          | Gross Revenue | DAO Share                 | Douro Labs |
| ---------------- | ------------- | ------------------------- | ---------- |
| Pyth Pro (60/40) | $538,391      | 7,271,937 PYTH ($323,034) | $215,356   |
| Total            | $562,557      | 7,662,509 PYTH ($340,384) | $222,173   |

</code></pre>
      `,
    });

    expect(report.monthlyRevenueRows).toEqual([
      {
        product: "Pyth Pro",
        splitLabel: "60/40",
        grossRevenueUsd: 538_391,
        daoShareUsd: 323_034,
        daoSharePyth: 7_271_937,
        douroLabsUsd: 215_356,
        isTotal: false,
      },
      {
        product: "Total",
        grossRevenueUsd: 562_557,
        daoShareUsd: 340_384,
        daoSharePyth: 7_662_509,
        douroLabsUsd: 222_173,
        isTotal: true,
      },
    ]);
  });

  it("parses backtick-prefixed pipe tables from Discourse code blocks", () => {
    const report = parseDouroReportPost({
      topicId: 2660,
      title: "Pyth Pro: Douro Labs Report — July 2026",
      slug: "pyth-pro-douro-labs-report-july-2026",
      url: "https://forum.pyth.network/t/pyth-pro-douro-labs-report-july-2026/2660",
      authorUsername: "zenyas",
      createdAt: "2026-08-04T12:00:00.000Z",
      lastPostedAt: "2026-08-04T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `
        <p><strong>July Revenue Breakdown</strong></p>
        <pre><code class="lang-auto">\`| Product          | Gross Revenue | DAO Share                 | Douro Labs |
| ---------------- | ------------- | ------------------------- | ---------- |
| Pyth Pro (60/40) | $538,391      | 7,271,937 PYTH ($323,034) | $215,356   |
| Total            | $562,557      | 7,662,509 PYTH ($340,384) | $222,173   |\`</code></pre>
      `,
    });

    expect(report.monthlyGrossRevenueUsd).toBe(562_557);
    expect(report.monthlyRevenueRows[0]).toMatchObject({
      product: "Pyth Pro",
      grossRevenueUsd: 538_391,
      daoSharePyth: 7_271_937,
    });
  });

  it("infers monthly and cumulative revenue tables from headers when headings are absent", () => {
    const report = parseDouroReportPost({
      topicId: 2660,
      title: "Pyth Pro: Douro Labs Report — July 2026",
      slug: "pyth-pro-douro-labs-report-july-2026",
      url: "https://forum.pyth.network/t/pyth-pro-douro-labs-report-july-2026/2660",
      authorUsername: "zenyas",
      createdAt: "2026-08-04T12:00:00.000Z",
      lastPostedAt: "2026-08-04T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `
        <pre><code class="lang-auto">| Product          | Gross Revenue | DAO Share                 | Douro Labs |
| ---------------- | ------------- | ------------------------- | ---------- |
| Pyth Pro (60/40) | $538,391      | 7,271,937 PYTH ($323,034) | $215,356   |
| Total            | $562,557      | 7,662,509 PYTH ($340,384) | $222,173   |</code></pre>
        <pre><code class="lang-auto">| Product  | Gross Revenue | DAO Share  | Douro Labs |
| -------- | ------------- | ---------- | ---------- |
| Pyth Pro | $2,425,079    | $1,455,047 | $970,031   |
| Total    | $2,502,246    | $1,519,197 | $983,048   |</code></pre>
      `,
    });

    expect(report.monthlyGrossRevenueUsd).toBe(562_557);
    expect(report.cumulativeGrossRevenueUsd).toBe(2_502_246);
  });

  it("keeps legacy summary reports when no product breakdown exists", () => {
    const report = parseDouroReportPost({
      topicId: 2339,
      title: "Pyth Pro: Douro Labs Report - January 2026",
      slug: "pyth-pro-douro-labs-report-january-2026",
      url: "https://forum.pyth.network/t/2339",
      authorUsername: "zenyas",
      createdAt: "2026-02-03T12:00:00.000Z",
      lastPostedAt: "2026-02-03T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `
        <p>Today, Douro Labs made the fourth distribution of <strong>$73,700 USDC</strong> to the DAO.</p>
        <p>This distribution covers revenue from Pyth Pro subscriptions for January 1st 2026 to February 1st 2026.</p>
        <h3>Cumulative Revenue (since Sept 2025)</h3>
        <pre><code>| Metric | Amount |
|--------|--------|
| Total Subscribed Revenue | $475,312 |
| DAO Share | $285,187 |
| Douro Labs Share | $190,125 |</code></pre>
      `,
    });

    expect(report.distribution).toEqual({
      usdValue: 73_700,
      tokenSymbol: "USDC",
    });
    expect(report.monthlyRevenueRows).toEqual([]);
    expect(report.legacySummaryRows).toEqual([
      { label: "Total Subscribed Revenue", usdValue: 475_312 },
      { label: "DAO Share", usdValue: 285_187 },
      { label: "Douro Labs Share", usdValue: 190_125 },
    ]);
    expect(report.cumulativeGrossRevenueUsd).toBe(475_312);
    expect(report.cumulativeDaoShareUsd).toBe(285_187);
    expect(report.cumulativeDouroLabsUsd).toBe(190_125);
  });

  it("extracts legacy summaries from two-column HTML tables without headings", () => {
    const report = parseDouroReportPost({
      topicId: 2339,
      title: "Pyth Pro: Douro Labs Report – January 2026",
      slug: "pyth-pro-douro-labs-report-january-2026",
      url: "https://forum.pyth.network/t/pyth-pro-douro-labs-report-january-2026/2339",
      authorUsername: "zenyas",
      createdAt: "2026-02-03T12:00:00.000Z",
      lastPostedAt: "2026-02-03T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `
        <p>Since the launch of Pyth Pro in September 2025, Douro Labs has collected $475,312 from selling Pyth Pro subscriptions.</p>
        <div class="md-table">
          <table>
            <thead><tr><th>Total Subscribed Revenue</th><th>$475,312</th></tr></thead>
            <tbody>
              <tr><td>DAO</td><td>$285,187</td></tr>
              <tr><td>Douro Labs</td><td>$190,125</td></tr>
            </tbody>
          </table>
        </div>
      `,
    });

    expect(report.legacySummaryRows).toEqual([
      { label: "Total Subscribed Revenue", usdValue: 475_312 },
      { label: "DAO", usdValue: 285_187 },
      { label: "Douro Labs", usdValue: 190_125 },
    ]);
    expect(report.cumulativeGrossRevenueUsd).toBe(475_312);
    expect(report.cumulativeDaoShareUsd).toBe(285_187);
    expect(report.cumulativeDouroLabsUsd).toBe(190_125);
  });

  it("parses spaced USD amounts in legacy summary tables", () => {
    const report = parseDouroReportPost({
      topicId: 2315,
      title: "Pyth Pro: Douro Labs Report -- December 2025",
      slug: "pyth-pro-douro-labs-report-december-2025",
      url: "https://forum.pyth.network/t/pyth-pro-douro-labs-report-december-2025/2315",
      authorUsername: "zenyas",
      createdAt: "2026-01-05T12:00:00.000Z",
      lastPostedAt: "2026-01-05T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `
        <table>
          <thead><tr><th>Total Subscribed Revenue</th><th>$ 352,628</th></tr></thead>
          <tbody>
            <tr><td>DAO</td><td>$ 211,577</td></tr>
            <tr><td>Douro Labs</td><td>$ 141,051</td></tr>
          </tbody>
        </table>
      `,
    });

    expect(report.cumulativeGrossRevenueUsd).toBe(352_628);
    expect(report.cumulativeDaoShareUsd).toBe(211_577);
    expect(report.cumulativeDouroLabsUsd).toBe(141_051);
  });

  it("extracts monthly and cumulative totals from March-style three-column tables", () => {
    const report = parseDouroReportPost({
      topicId: 2444,
      title: "Pyth Pro: Douro Labs Report — March 2026",
      slug: "pyth-pro-douro-labs-report-march-2026",
      url: "https://forum.pyth.network/t/pyth-pro-douro-labs-report-march-2026/2444",
      authorUsername: "zenyas",
      createdAt: "2026-04-02T12:00:00.000Z",
      lastPostedAt: "2026-04-02T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `
        <p>March gross revenue was $253,833 (DAO share: $135,500 at 60%), with credits applied for uncollectable receivables.</p>
        <table>
          <thead><tr><th></th><th>March</th><th>Total (since Sept 2025)</th></tr></thead>
          <tbody>
            <tr><td>Subscribed Revenue</td><td>$225,833</td><td>$833,228</td></tr>
            <tr><td>DAO (60%)</td><td>$135,500</td><td>$499,937</td></tr>
            <tr><td>Douro Labs (40%)</td><td>$90,333</td><td>$333,291</td></tr>
          </tbody>
        </table>
      `,
    });

    expect(report.monthlyGrossRevenueUsd).toBe(225_833);
    expect(report.monthlyDaoShareUsd).toBe(135_500);
    expect(report.monthlyDouroLabsUsd).toBe(90_333);
    expect(report.cumulativeGrossRevenueUsd).toBe(833_228);
    expect(report.cumulativeDaoShareUsd).toBe(499_937);
    expect(report.cumulativeDouroLabsUsd).toBe(333_291);
  });

  it("parses PYTH distributions when the USD value omits the equivalent suffix", () => {
    const report = parseDouroReportPost({
      topicId: 2627,
      title: "Pyth Pro: Douro Labs Report — June 2026",
      slug: "pyth-pro-douro-labs-report-june-2026",
      url: "https://forum.pyth.network/t/pyth-pro-douro-labs-report-june-2026/2627",
      authorUsername: "zenyas",
      createdAt: "2026-07-03T12:00:00.000Z",
      lastPostedAt: "2026-07-03T12:00:00.000Z",
      highestPostNumber: 1,
      cooked: `<p>Today, Douro Labs made the eighth distribution of <strong>7,674,095 PYTH</strong> ($273,075) to the DAO. Per CO-PIP-104, this distribution is paid in PYTH tokens at the June monthly TWAP of <strong>$0.035584 ($1 = 28.10 PYTH)</strong>.</p>`,
    });

    expect(report.distribution).toEqual({
      tokenAmount: 7_674_095,
      usdValue: 273_075,
      tokenSymbol: "PYTH",
      twapUsd: 0.035584,
      pythPerUsd: 28.1,
    });
  });
});

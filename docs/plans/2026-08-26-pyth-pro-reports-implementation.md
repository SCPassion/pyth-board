# Pyth Pro Reports Dashboard Implementation

## Goal

Add a dedicated `/pyth-pro` dashboard that follows the reserve page's editorial dashboard language, presents Douro Labs report revenue with line charts and tables, and incrementally syncs changed report topics from the Pyth Forum through Convex.

## Global Constraints

- Follow strict red-green-refactor TDD for production behavior.
- Use the category slug URL; do not hard-code category id 11.
- Fetch the category feed on schedule, but fetch full topic JSON only for new or changed Douro report topics.
- Support report structures that vary over time and arbitrary future product names.
- Keep missing fields absent rather than inventing zero values.
- Preserve source links and raw report HTML for auditability.
- Match the reserve page's masthead, numbered sections, restrained cards, responsive tables, and chart styling.
- Use line charts for trends.

## Task 1: Parser And Chart Model

Create pure Pyth Pro report types, a Discourse cooked-HTML parser, and chart-model helpers. Tests must first fail for legacy summary reports, March's credit adjustment, HTML and markdown revenue tables, PYTH distributions and TWAP, arbitrary product rows, and cumulative-delta fallback.

## Task 2: Convex Storage And Incremental Sync

Add the report schema, indexed public queries, internal cursor/upsert functions, a forum sync action, and a daily cron. Tests must first fail for topic filtering and changed-topic selection. Every Convex function must use object syntax with argument and return validators.

## Task 3: Dashboard UI

Add `/pyth-pro`, summary metrics, line charts, a latest revenue table, cumulative table, and report archive. Add sidebar navigation. Tests must first fail for any pure presentation models introduced by the UI.

## Task 4: Verification And Initial Sync

Run focused tests, the full test suite, TypeScript, production build, Convex codegen/push where available, the initial live sync, and browser verification at desktop and mobile sizes. Keep unrelated baseline failures separate.

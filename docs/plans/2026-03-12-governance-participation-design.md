# Pyth Governance Participation Design

Date: 2026-03-12
Status: Approved
Scope: Network-wide governance concentration and participation analytics subpage

## 1. Problem Statement
Pyth Board currently helps users inspect their own staking positions and the strategic reserve, but it does not answer network-wide governance questions.

Goal: add a new subpage that helps users understand how concentrated PYTH governance power is and whether large stakers have been participating in governance over the last 12 months.

## 2. Decisions Confirmed
- Scope: network-wide governance analysis, not wallet-portfolio analysis.
- Participation definition: both staking presence and proposal voting behavior matter.
- Time window: last 12 months only.
- Presentation style: cohort-first, not address-first.
- Detail level: optional anonymized drill-down is allowed; raw addresses should not be the default UI.
- Tone: neutral and analytical, avoiding direct public callouts.

## 3. Recommended Approach
Use precomputed analytics snapshots as the system of record for the governance page.

Rationale:
- Network-wide governance data is heavier than the current wallet and reserve views.
- Precomputation keeps page loads predictable and enables stable cohort metrics.
- Snapshot-based analytics create a clean path for future trend views without forcing expensive recomputation per request.

## 4. Architecture
### 4.1 Data Model
Store a derived per-snapshot governance analysis result built from raw staking and proposal participation data.

Recommended entities:

`governanceParticipationSnapshots`
- `timestampMs: number`
- `windowStartMs: number`
- `windowEndMs: number`
- `walletsAnalyzed: number`
- `totalStakedPyth: number`
- `top10SharePct: number`
- `top50SharePct: number`
- `top1PctSharePct: number`
- `whaleWalletCount: number`
- `activeWhaleRatePct: number`
- `cohortSummary: GovernanceCohortSummary[]`
- `proposalSummary: GovernanceProposalSummary[]`
- `anonymizedHolders: GovernanceHolderSummary[]` (optional lightweight drill-down payload)

Supporting derived shapes:

`GovernanceHolderSummary`
- `holderId: string` (`Holder #01`, etc.)
- `stakeRank: number`
- `stakePercentile: number`
- `stakedPyth: number`
- `stakeSharePct: number`
- `proposalCountEligible: number`
- `proposalCountVoted: number`
- `participationRatePct: number`
- `lastVoteAtMs: number | null`
- `whaleBand: string`
- `participationBand: string`
- `knownEntityLabel?: string`

`GovernanceCohortSummary`
- `cohortKey: string`
- `label: string`
- `walletCount: number`
- `totalStakedPyth: number`
- `stakeSharePct: number`
- `avgParticipationRatePct: number`

`GovernanceProposalSummary`
- `proposalId: string`
- `title: string`
- `startAtMs: number`
- `endAtMs: number`
- `eligibleStakePyth: number`
- `participatingStakePyth: number`
- `turnoutPct: number`

### 4.2 Job Flow
Add a periodic pipeline that:
1. Fetches the current staking distribution for all relevant governance participants.
2. Fetches proposal history and vote participation for the last 12 months.
3. Computes per-holder derived metrics:
   - stake rank
   - stake percentile
   - share of total stake
   - proposal eligibility count
   - proposals voted
   - participation rate
   - recent activity timestamp
4. Buckets holders into cohort bands:
   - top 0.1%, top 1%, top 5%, long tail
   - high / medium / low recent participation
5. Produces page-level aggregates and anonymized drill-down rows.
6. Persists the latest snapshot for page reads.

### 4.3 Query Layer
Expose a read-optimized endpoint for the new governance page:
- latest headline metrics
- cohort summaries
- concentration distribution series
- recent proposal turnout data
- anonymized cohort drill-down rows

The page should read the latest prepared snapshot rather than recomputing from raw chain data during render.

### 4.4 Refresh Cadence
Default cadence: hourly.

Rationale:
- Governance participation does not need second-by-second freshness.
- Hourly updates are consistent with existing analytics behavior and keep compute bounded.

## 5. Classification Rules
### 5.1 Whale Definition
Use percentile-first classification rather than absolute token thresholds.

Default bands:
- `top_0_1_pct`
- `top_1_pct`
- `top_5_pct`
- `rest`

Optional future enhancement:
- combine percentile with minimum stake floor to avoid edge cases when the distribution is unusually thin.

### 5.2 Participation Definition
Use a simple transparent metric:

`participation_rate = proposals_voted / eligible_proposals`

Default activity framing:
- `high_recent_participation`
- `moderate_recent_participation`
- `low_recent_participation`

Avoid black-box scoring in phase 1.

### 5.3 Entity Treatment
Primary unit of analysis is the wallet or staking account.

Optional labeling is allowed only when confidence is high, such as:
- known multisigs
- known foundation-controlled accounts
- known program-owned accounts

No speculative clustering or broad entity inference in phase 1.

## 6. Page Structure
Add a dedicated governance analytics route and sidebar entry.

### 6.1 Hero Metrics
Show:
- wallets/accounts analyzed
- total staked PYTH represented
- top 10 share
- top 50 share
- whale participation rate over last 12 months

### 6.2 Concentration View
Show the distribution of governance power across stake bands.

Recommended visuals:
- percentile distribution chart
- concentration cards for top 0.1%, top 1%, top 5%
- short methodology note

### 6.3 Whale Activity Matrix
Primary insight block:
- high stake / high participation
- high stake / low participation
- low stake / high participation
- low stake / low participation

This section should answer the core question at a glance without naming individual holders.

### 6.4 Proposal Participation View
Show recent proposal-level turnout and stake-band participation trends for the last 12 months.

Recommended fields:
- proposal title
- date
- turnout %
- participation by whale band

### 6.5 Optional Anonymized Drill-Down
Allow users to inspect a selected cohort via anonymized rows such as `Holder #01`.

Rules:
- not visible as the default first impression
- no raw addresses in the default experience
- no accusatory labels like `inactive whale`

## 7. UX and Language Safeguards
- Use neutral terminology: `recent participation`, `turnout`, `stake concentration`, `cohort`.
- Make clear that on-chain wallets do not perfectly map to real-world entities.
- Make clear that low recent participation is descriptive, not moral judgment.
- Include visible methodology and limitations notes.

## 8. Error Handling and Reliability
- If upstream governance or staking data fails to refresh, continue serving the last successful snapshot.
- If proposal metadata is partially unavailable, keep concentration analytics visible and scope the failure to proposal detail sections.
- If the snapshot is stale, display a `last updated` timestamp rather than masking freshness issues.

## 9. Testing Strategy
### 9.1 Data Tests
- stake ranking and percentile assignment
- whale band classification
- proposal eligibility and participation-rate calculations
- anonymization stability and ordering

### 9.2 Query Tests
- latest snapshot response shape
- cohort aggregation correctness
- proposal turnout aggregation correctness

### 9.3 UI Tests
- governance page renders headline metrics from snapshot payload
- cohort cards and charts render with expected data
- anonymized drill-down opens only after explicit user interaction
- stale or partial data states show scoped warnings without breaking the whole page

## 10. Future Extensions (Out of Scope for Phase 1)
- historical trend comparison across multiple 12-month windows
- opt-in trusted internal/admin view with raw addresses
- delegation-aware metrics if governance mechanics expand
- richer known-entity labeling with curated registry support

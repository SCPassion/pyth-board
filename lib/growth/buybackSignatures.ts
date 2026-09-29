import type { Connection, PublicKey } from "@solana/web3.js";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const MAX_SIGNATURES_PER_RUN = 300;

/** Scan back to the saved cursor, then process the oldest signatures first.
 * Advancing the cursor after a bounded batch cannot skip the remaining backlog.
 */
export async function fetchNewBuybackSignatures(
  connection: Pick<Connection, "getSignaturesForAddress">,
  owner: PublicKey,
  latestProcessedSignature: string,
): Promise<string[]> {
  const signatures: string[] = [];
  let before: string | undefined;

  for (let pageNumber = 0; pageNumber <= MAX_PAGES; pageNumber++) {
    const page = await connection.getSignaturesForAddress(owner, {
      limit: pageNumber === MAX_PAGES ? 1 : PAGE_SIZE,
      before,
      until: latestProcessedSignature,
    });
    if (pageNumber === MAX_PAGES) {
      if (page.length === 0) return signatures.slice(-MAX_SIGNATURES_PER_RUN);
      break;
    }
    signatures.push(...page.map(entry => entry.signature));
    if (page.length < PAGE_SIZE) return signatures.slice(-MAX_SIGNATURES_PER_RUN);
    const nextBefore = page[page.length - 1].signature;
    if (nextBefore === before) throw new Error("Buyback signature pagination did not advance");
    before = nextBefore;
  }

  // Preserve the saved cursor if the backlog cannot be scanned in one run.
  throw new Error("Buyback signature backlog exceeded the safe scan limit");
}

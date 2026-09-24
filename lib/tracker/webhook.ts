import { record, array } from "./helius-format";
export function webhookSignatures(payload: unknown): string[] {
  if (!Array.isArray(payload) || payload.length > 100 || !payload.length)
    throw new Error("Expected 1–100 transactions");
  const result = payload.map((item) => {
    const r = record(item);
    const tx = record(r.transaction);
    const signature =
      typeof r.signature === "string" ? r.signature : array(tx.signatures)[0];
    if (
      typeof signature !== "string" ||
      !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)
    )
      throw new Error("Invalid signature");
    return signature;
  });
  return [...new Set(result)];
}
export async function readBoundedBody(
  request: Request,
  maxBytes = 1048576,
): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("Request too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

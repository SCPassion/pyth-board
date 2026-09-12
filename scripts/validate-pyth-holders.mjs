// Run with node --env-file=.env.local scripts/validate-pyth-holders.mjs
// Never print the endpoint or API key. This probe does not store snapshots.
const start = Date.now();
try {
  if (!process.env.PRIMARY_SOLANA_RPC_URL) throw new Error('Missing PRIMARY_SOLANA_RPC_URL');
  const response = await fetch(process.env.PRIMARY_SOLANA_RPC_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getProgramAccounts', params: [
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', {
        encoding: 'base64', commitment: 'confirmed',
        filters: [{ memcmp: { offset: 0, bytes: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3' } }, { dataSize: 165 }],
        dataSlice: { offset: 32, length: 40 },
      },
    ] }),
  });
  const body = await response.text();
  console.log(JSON.stringify({ status: response.status, bytes: Buffer.byteLength(body), elapsedMs: Date.now() - start }));
  const data = JSON.parse(body);
  if (data.error) {
    console.log(JSON.stringify({ rpcErrorCode: data.error.code, rpcErrorMessage: String(data.error.message).replace(/https?:\/\/\S+/g, '[URL redacted]') }));
    process.exitCode = 1;
  } else if (response.ok && Array.isArray(data.result)) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync('/tmp/pyth-holder-validation.json', body);
    console.log(JSON.stringify({ accounts: data.result.length, savedTo: '/tmp/pyth-holder-validation.json' }));
  } else throw new Error('Invalid RPC response');
} catch (error) {
  console.error(JSON.stringify({ error: error.name, cause: error.cause?.code, elapsedMs: Date.now() - start }));
  process.exitCode = 1;
}

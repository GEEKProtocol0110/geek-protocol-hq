// Provider logs receive only fixed categories, never exception text or payment data.
const stages = new Set(['scheduled-run', 'claim', 'verify', 'prepare', 'persist-journal', 'reconcile-before-submit',
  'submit-commit', 'submit-reveal', 'mark-submitted', 'reconcile-after-submit', 'release']);
const reasons = new Set(['RPC_TIMEOUT', 'INDEXER_UNAVAILABLE', 'DEDICATED_SIGNER_KEY_REQUIRED', 'WORKER_TOKEN_REQUIRED',
  'CANONICAL_HQ_REQUIRED', 'TN10_SYNCED_NODE_REQUIRED', 'SIGNER_POLICY_MISMATCH', 'PINNED_ASSET_REQUIRED',
  'GEEKT_FUNDING_REQUIRED', 'FUNDED_UTXO_REQUIRED', 'CONSOLIDATION_NOT_ALLOWED', 'COMMIT_OUTPUT_INVALID',
  'FEE_LIMIT_EXCEEDED', 'JOURNAL_LIMIT_EXCEEDED', 'JOURNAL_HASH_MISMATCH', 'RPC_HASH_MISMATCH', 'HQ_REQUEST_FAILED']);
const outcomes = new Set(['idle', 'busy', 'indexed-confirmed', 'reconciling', 'awaiting-indexer']);
const write = event => console[event.event === 'tn10-worker-failure' ? 'error' : 'info'](JSON.stringify(event));
const emit = (event, report) => { try { report(event); } catch { /* Logging must not change payment recovery. */ } };
export function reportFailure(stage, error, report = write) {
  const message = (typeof error === 'string' ? error : typeof error?.message === 'string' ? error.message : '').slice(0, 4096);
  let code = reasons.has(message) ? message : 'UNCLASSIFIED';
  if (code === 'UNCLASSIFIED') {
    if (['TimeoutError', 'AbortError'].includes(error?.name) || /timed?\s*out|timeout/i.test(message)) code = 'REQUEST_TIMEOUT';
    else if (error?.name === 'SyntaxError') code = 'INVALID_JSON_RESPONSE';
    else if (/already.*(?:accepted|mempool|pool|mined)|duplicate transaction/i.test(message)) code = 'RPC_ALREADY_KNOWN';
    else if (/(?:signature|script).*(?:invalid|fail)|(?:invalid|fail).*signature/i.test(message)) code = 'RPC_SCRIPT_REJECTED';
    else if (/orphan|missing.*(?:utxo|outpoint|parent)|(?:utxo|outpoint|parent).*not found/i.test(message)) code = 'RPC_INPUT_UNAVAILABLE';
    else if (/(?:websocket|connection|connect).*(?:closed|fail|refused|reset|error)/i.test(message)) code = 'RPC_CONNECTION_FAILED';
  }
  const event = { event: 'tn10-worker-failure', stage: stages.has(stage) ? stage : 'scheduled-run', code };
  if (code === 'HQ_REQUEST_FAILED' && Number.isInteger(error?.httpStatus) && error.httpStatus >= 400 && error.httpStatus <= 599) event.httpStatus = error.httpStatus;
  emit(event, report);
}
export function reportOutcome(state, report = write) {
  emit({ event: 'tn10-worker-result', state: outcomes.has(state) ? state : 'unknown' }, report);
}

// Provider logs receive only fixed categories, never exception text or payment data.
const stages = new Set(['scheduled-run', 'claim', 'verify', 'prepare', 'persist-journal', 'reconcile-before-submit',
  'submit-commit', 'submit-reveal', 'inspect-journal', 'mark-submitted', 'reconcile-after-submit', 'release']);
const reasons = new Set(['RPC_TIMEOUT', 'INDEXER_UNAVAILABLE', 'DEDICATED_SIGNER_KEY_REQUIRED', 'WORKER_TOKEN_REQUIRED',
  'RPC_CONNECT_TIMEOUT', 'RPC_CONNECT_FAILED', 'RPC_SERVER_INFO_TIMEOUT', 'RPC_SERVER_INFO_FAILED', 'RPC_DISCONNECT_FAILED',
  'JOURNAL_LINK_MISMATCH', 'JOURNAL_INSPECTION_FAILED',
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
    else if (/already spent by transaction|double spending|double spend/i.test(message)) code = 'RPC_DOUBLE_SPEND';
    else if (/already.*(?:accepted|mempool|pool|mined)|duplicate transaction/i.test(message)) code = 'RPC_ALREADY_KNOWN';
    // Match node RuleError/NonStandardError display text before the broad
    // script/orphan cases. Emit fixed categories only, never upstream values.
    else if (/fees which is under the required amount|insufficient.*fee|fee rate.*not greater/i.test(message)) code = 'RPC_INSUFFICIENT_FEE';
    else if (/calculated.*mass.*not equal.*committed mass|WrongMass/i.test(message)) code = 'RPC_MASS_MISMATCH';
    else if (/mass.*(?:larger than max|exceeds maximum|incomputable)|incomputable.*mass/i.test(message)) code = 'RPC_MASS_LIMIT';
    else if (/immature (?:UTXO|spend)|coinbase maturity|ImmatureCoinbaseSpend/i.test(message)) code = 'RPC_IMMATURE_INPUT';
    else if (/transaction version.*(?:unknown|not in the valid range)/i.test(message)) code = 'RPC_VERSION_UNSUPPORTED';
    else if (/sequence locks conditions was not met|input.*not finalized/i.test(message)) code = 'RPC_SEQUENCE_LOCKED';
    else if (/non-standard script form|scriptPublicKey.*higher than the known version|signature script.*(?:above|larger than)/i.test(message)) code = 'RPC_NONSTANDARD';
    else if (/(?:signature|script).*(?:invalid|fail)|(?:invalid|fail).*signature/i.test(message)) code = 'RPC_SCRIPT_REJECTED';
    else if (/orphan|missing.*(?:utxo|outpoint|parent)|(?:utxo|outpoint|parent).*not found|outpoint.*lacking a matching UTXO|outpoints.*missing from current utxo/i.test(message)) code = 'RPC_INPUT_UNAVAILABLE';
    else if (/(?:websocket|connection|connect).*(?:closed|fail|refused|reset|error)/i.test(message)) code = 'RPC_CONNECTION_FAILED';
  }
  const event = { event: 'tn10-worker-failure', stage: stages.has(stage) ? stage : 'scheduled-run', code };
  if (code === 'HQ_REQUEST_FAILED' && Number.isInteger(error?.httpStatus) && error.httpStatus >= 400 && error.httpStatus <= 599) event.httpStatus = error.httpStatus;
  emit(event, report);
  return code;
}
export function reportOutcome(state, report = write) {
  emit({ event: 'tn10-worker-result', state: outcomes.has(state) ? state : 'unknown' }, report);
}
export function reportJournalState(state, report = write) {
  if (typeof state?.commitInputsAvailable !== 'boolean' || typeof state?.revealInputAvailable !== 'boolean') return;
  emit({ event: 'tn10-worker-inputs', commitInputsAvailable: state.commitInputsAvailable, revealInputAvailable: state.revealInputAvailable }, report);
}

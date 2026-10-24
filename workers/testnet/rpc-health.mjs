// Bound read-only node discovery before any signing or journal recovery.
export async function rpcDeadline(action, code = 'RPC_TIMEOUT', duration = 12000) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(code)), duration);
    })]);
  } finally { clearTimeout(timer); }
}
export async function readRpcHealth(rpc) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (!rpc.isConnected && typeof rpc.connect === 'function') {
        try {
          await rpcDeadline(() => rpc.connect({ blockAsyncConnect: true, strategy: 'fallback', timeoutDuration: 5000 }), 'RPC_CONNECT_TIMEOUT', 6000);
        } catch (error) { throw new Error(error?.message === 'RPC_CONNECT_TIMEOUT' ? 'RPC_CONNECT_TIMEOUT' : 'RPC_CONNECT_FAILED'); }
      }
      try { return await rpcDeadline(() => rpc.getServerInfo(), 'RPC_SERVER_INFO_TIMEOUT', 6000); }
      catch (error) { throw new Error(error?.message === 'RPC_SERVER_INFO_TIMEOUT' ? 'RPC_SERVER_INFO_TIMEOUT' : 'RPC_SERVER_INFO_FAILED'); }
    } catch (error) {
      // Stop the SDK reconnect task before asking the resolver for another node.
      // An unacknowledged disconnect cannot safely start another attempt.
      try { await rpcDeadline(() => rpc.disconnect(), 'RPC_DISCONNECT_TIMEOUT', 2000); }
      catch { throw new Error('RPC_DISCONNECT_FAILED'); }
      if (attempt === 1) throw error;
    }
  }
}

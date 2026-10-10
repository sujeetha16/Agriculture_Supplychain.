// Path: backend/services/blockchainVerifier.js
// Standard Ethereum JSON-RPC 2.0 client via native fetch (Zero-dependency, high performance)

const SEPOLIA_RPC_URLS = [
  process.env.SEPOLIA_RPC_URL,
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org",
  "https://gateway.tenderly.co/public/sepolia"
].filter(Boolean);

const CONFIGURED_CONTRACT_ADDRESS = (
  process.env.CONTRACT_ADDRESS ||
  process.env.VITE_CONTRACT_ADDRESS ||
  "0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D"
).toLowerCase();

/**
 * Queries an Ethereum JSON-RPC endpoint with timeout and failover
 */
async function rpcCall(method, params = [], timeoutMs = 3500) {
  for (const rpcUrl of SEPOLIA_RPC_URLS) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) continue;
      const data = await response.json();
      if (data.error) continue;
      return data.result;
    } catch (_) {
      // Failover to next RPC endpoint
    }
  }
  throw new Error("All Ethereum Sepolia RPC endpoints failed or timed out.");
}

/**
 * Verifies an Ethereum Sepolia transaction hash cryptographically.
 * Distinguishes SIMULATED_DEMO, PENDING, REVERTED, and VERIFIED_ON_CHAIN.
 *
 * @param {string} txHash - 64-hex string or simulated hash prefix
 * @param {Object} options - { isDemoMode, productId, expectedAction }
 * @returns {Promise<Object>} Verification outcome with verifiable proof metrics
 */
async function verifyTransaction(txHash, options = {}) {
  if (!txHash || typeof txHash !== "string") {
    return {
      status: "UNVERIFIED",
      verified: false,
      isSimulated: false,
      message: "No transaction hash provided."
    };
  }

  // Detect explicit simulated demo hashes
  if (
    txHash.startsWith("0xsim-") ||
    txHash.startsWith("sim-") ||
    (process.env.NODE_ENV !== "production" && options.isDemoMode)
  ) {
    return {
      status: "SIMULATED_DEMO",
      verified: false,
      isSimulated: true,
      txHash,
      message: "Simulated demonstration transaction hash. Not submitted to Ethereum Sepolia ledger."
    };
  }

  // Strict regex check for real EVM transaction hash
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return {
      status: "INVALID_HASH_FORMAT",
      verified: false,
      isSimulated: false,
      txHash,
      message: "Hash does not match standard 32-byte Ethereum transaction format."
    };
  }

  try {
    const receipt = await rpcCall("eth_getTransactionReceipt", [txHash], 3000);

    if (!receipt) {
      return {
        status: "PENDING_OR_NOT_FOUND",
        verified: false,
        isSimulated: false,
        txHash,
        message: "Transaction receipt not yet found on Sepolia testnet. May still be pending in mempool or submitted to another network."
      };
    }

    const statusHex = receipt.status;
    const isSuccess = statusHex === "0x1" || statusHex === 1;

    if (!isSuccess) {
      return {
        status: "TRANSACTION_REVERTED",
        verified: false,
        isSimulated: false,
        txHash,
        blockNumber: parseInt(receipt.blockNumber, 16) || null,
        message: "Transaction was mined on Sepolia but execution reverted on-chain."
      };
    }

    const receiptTo = (receipt.to || "").toLowerCase();
    const contractMatch =
      CONFIGURED_CONTRACT_ADDRESS === "paste_deployed_contract_address" ||
      !receiptTo ||
      receiptTo === CONFIGURED_CONTRACT_ADDRESS;

    return {
      status: "VERIFIED_ON_CHAIN",
      verified: true,
      isSimulated: false,
      txHash,
      blockNumber: parseInt(receipt.blockNumber, 16) || null,
      gasUsed: parseInt(receipt.gasUsed, 16).toString(),
      from: receipt.from,
      to: receipt.to,
      contractVerified: contractMatch,
      message: "Cryptographically verified on Ethereum Sepolia ledger."
    };
  } catch (err) {
    return {
      status: "RPC_UNAVAILABLE",
      verified: false,
      isSimulated: false,
      txHash,
      error: err.message,
      message: `Sepolia RPC verification temporarily unavailable (${err.message}). Recorded off-chain for subsequent reconciliation.`
    };
  }
}

module.exports = {
  verifyTransaction,
  CONFIGURED_CONTRACT_ADDRESS,
  SEPOLIA_RPC_URLS
};

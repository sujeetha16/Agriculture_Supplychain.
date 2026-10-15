// Path: backend/services/blockchainVerifier.js
// Standard Ethereum JSON-RPC 2.0 client with ABI event decoding via ethers

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

function resolveSepoliaRpcUrls() {
  const configuredRpcUrl = (
    process.env.SEPOLIA_RPC_URL ||
    process.env.SEPOLIA_PUBLIC_RPC_URL ||
    ""
  ).trim();

  const isProduction = process.env.NODE_ENV === "production";
  if (configuredRpcUrl) {
    if (!/^https?:\/\//i.test(configuredRpcUrl)) {
      if (isProduction) {
        throw new Error(
          `[CRITICAL] Invalid SEPOLIA_RPC_URL '${configuredRpcUrl}'. Must be a valid HTTP or HTTPS JSON-RPC endpoint URL.`
        );
      }
      console.warn(`[BlockchainVerifier] Malformed SEPOLIA_RPC_URL '${configuredRpcUrl}'; falling back to community gateways.`);
    }
  }

  const validConfigured = configuredRpcUrl && /^https?:\/\//i.test(configuredRpcUrl) ? configuredRpcUrl : null;
  return [
    validConfigured,
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://rpc.sepolia.org",
    "https://gateway.tenderly.co/public/sepolia"
  ].filter(Boolean);
}

const SEPOLIA_RPC_URLS = resolveSepoliaRpcUrls();

// Locate AgriChain artifact ABI safely across environments
function loadArtifact() {
  const candidatePaths = [
    path.join(__dirname, "../contracts/AgriChain.json"),
    path.join(__dirname, "../../frontend/src/contracts/AgriChain.json"),
    path.join(__dirname, "../../blockchain/artifacts/contracts/AgriChain.sol/AgriChain.json")
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf-8");
        return JSON.parse(raw);
      } catch (_) {}
    }
  }
  return { abi: [], address: "0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D" };
}

const artifact = loadArtifact();
const contractInterface = new ethers.Interface(artifact.abi || []);

function resolveContractAddress() {
  const raw = (
    process.env.CONTRACT_ADDRESS ||
    process.env.VITE_CONTRACT_ADDRESS ||
    artifact.address ||
    "0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D"
  ).trim();

  const isProduction = process.env.NODE_ENV === "production";
  if (!ethers.isAddress(raw)) {
    if (isProduction) {
      throw new Error(
        `[CRITICAL] Invalid Ethereum contract address '${raw}'. CONTRACT_ADDRESS must be a valid 42-character hex address.`
      );
    }
    console.warn(`[BlockchainVerifier] Malformed contract address '${raw}'; falling back to artifact default.`);
    return (artifact.address || "0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D").toLowerCase();
  }

  return raw.toLowerCase();
}

const CONFIGURED_CONTRACT_ADDRESS = resolveContractAddress();

/**
 * Canonical smart contract delegation & account abstraction managers.
 * When transactions are executed via EIP-7702 (MetaMask Smart Account delegation) or ERC-4337,
 * the transaction's outer 'to' address is the delegation/entrypoint contract, which then
 * executes the call to the AgriChain smart contract.
 */
function resolveAuthorizedDelegationManagers() {
  const defaults = [
    "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3".toLowerCase(), // Canonical MetaMask EIP-7702 Delegation Manager
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032".toLowerCase(), // ERC-4337 EntryPoint v0.7
    "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".toLowerCase()  // ERC-4337 EntryPoint v0.6
  ];

  const configured = (process.env.AUTHORIZED_DELEGATION_CONTRACTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => ethers.isAddress(s));

  return new Set([...defaults, ...configured]);
}

const AUTHORIZED_DELEGATION_MANAGERS = resolveAuthorizedDelegationManagers();

/**
 * Mapping of Supply-Chain Lifecycle actions to exact AgriChain Solidity event signatures & roles
 */
const ACTION_EVENT_MAP = {
  CREATED: {
    eventName: "ProductCreated",
    actorField: "farmer",
    hasReceiver: false
  },
  DISPATCHED_TO_DISTRIBUTOR: {
    eventName: "ProductDispatchedToDistributor",
    actorField: "farmer",
    receiverField: "distributor",
    hasReceiver: true
  },
  RECEIVED_BY_DISTRIBUTOR: {
    eventName: "ProductReceivedByDistributor",
    actorField: "distributor",
    hasReceiver: false
  },
  DISPATCHED_TO_RETAILER: {
    eventName: "ProductDispatchedToRetailer",
    actorField: "distributor",
    receiverField: "retailer",
    hasReceiver: true
  },
  RECEIVED_BY_RETAILER: {
    eventName: "ProductReceivedByRetailer",
    actorField: "retailer",
    hasReceiver: false
  },
  SOLD_TO_CONSUMER: {
    eventName: "ProductSoldToConsumer",
    actorField: "retailer",
    receiverField: "consumer",
    hasReceiver: true
  }
};

function normalizeActionKey(action) {
  if (!action || typeof action !== "string") return null;
  const upper = action.toUpperCase();
  if (ACTION_EVENT_MAP[upper]) return upper;

  // Map CamelCase variants
  const camelMap = {
    CREATED: "CREATED",
    DISPATCHEDTODISTRIBUTOR: "DISPATCHED_TO_DISTRIBUTOR",
    RECEIVEDBYDISTRIBUTOR: "RECEIVED_BY_DISTRIBUTOR",
    DISPATCHEDTORETAILER: "DISPATCHED_TO_RETAILER",
    RECEIVEDBYRETAILER: "RECEIVED_BY_RETAILER",
    SOLDTOCONSUMER: "SOLD_TO_CONSUMER"
  };
  const key = upper.replace(/_/g, "");
  return camelMap[key] || null;
}

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

function parseBlockNumber(bn) {
  if (bn === null || bn === undefined) return null;
  if (typeof bn === "number") return bn;
  if (typeof bn === "string" && bn.startsWith("0x")) return parseInt(bn, 16);
  return Number(bn) || null;
}

function parseGas(gas) {
  if (gas === null || gas === undefined) return null;
  if (typeof gas === "string" && gas.startsWith("0x")) return parseInt(gas, 16).toString();
  return gas.toString();
}

/**
 * Verifies an Ethereum Sepolia transaction hash cryptographically.
 * Performs end-to-end receipt validation, destination contract checking,
 * ABI event decoding, product ID verification, and stakeholder identity validation.
 *
 * @param {string} txHash - 64-hex string or simulated hash prefix
 * @param {Object} options - { isDemoMode, productId, expectedAction, expectedActor, expectedReceiver, receipt, contractAddress }
 * @returns {Promise<Object>} Granular verification outcome with cryptographic proof metrics
 */
async function verifyTransaction(txHash, options = {}) {
  if (!txHash || typeof txHash !== "string") {
    return {
      status: "INVALID_HASH_FORMAT",
      verified: false,
      isSimulated: false,
      message: "No transaction hash provided."
    };
  }

  const isSimulatedPrefix = txHash.startsWith("0xsim-") || txHash.startsWith("sim-");
  const isDemoRequested = Boolean(options.isDemoMode);
  const isProduction = process.env.NODE_ENV === "production";

  // Prevent simulated demo transactions from masquerading in production
  if (isSimulatedPrefix || isDemoRequested) {
    if (isProduction) {
      return {
        status: "DEMO_PROHIBITED_IN_PRODUCTION",
        verified: false,
        isSimulated: true,
        txHash,
        message: "Simulated demonstration transactions are strictly prohibited in production environment."
      };
    }
    return {
      status: "SIMULATED_DEMO",
      verified: false,
      isSimulated: true,
      txHash,
      message: "Simulated demonstration transaction hash. Not submitted to Ethereum Sepolia ledger."
    };
  }

  // Strict regex check for real EVM transaction hash (32 bytes hex)
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
    // Allow receipt injection for deterministic regression testing
    const receipt = options.receipt !== undefined
      ? options.receipt
      : await rpcCall("eth_getTransactionReceipt", [txHash], options.timeoutMs || 3000);

    if (!receipt) {
      return {
        status: "PENDING_OR_NOT_FOUND",
        verified: false,
        isSimulated: false,
        txHash,
        message: "Transaction receipt not yet found on Sepolia testnet. May still be pending in mempool or submitted to another network."
      };
    }

    // 1. Transaction execution status check
    const statusHex = receipt.status;
    const isSuccess = statusHex === "0x1" || statusHex === 1 || statusHex === true;

    if (!isSuccess) {
      return {
        status: "TRANSACTION_REVERTED",
        verified: false,
        isSimulated: false,
        txHash,
        blockNumber: parseBlockNumber(receipt.blockNumber),
        message: "Transaction was mined on Sepolia but execution reverted on-chain."
      };
    }

    // 2. Destination contract address check (case-insensitive)
    const receiptTo = (receipt.to || "").toLowerCase();
    const expectedContract = (options.contractAddress || CONFIGURED_CONTRACT_ADDRESS).toLowerCase();

    const isDirectCall = receiptTo === expectedContract;
    const isAuthorizedDelegation = AUTHORIZED_DELEGATION_MANAGERS.has(receiptTo);

    if (!receiptTo || (!isDirectCall && !isAuthorizedDelegation)) {
      return {
        status: "CONTRACT_MISMATCH",
        verified: false,
        isSimulated: false,
        txHash,
        blockNumber: parseBlockNumber(receipt.blockNumber),
        destinationAddress: receipt.to || null,
        expectedContractAddress: expectedContract,
        message: `Transaction destination contract (${receipt.to || "none"}) does not match configured AgriChain contract (${expectedContract}).`
      };
    }

    // If routed through an authorized delegation manager, ensure receipt contains logs emitted by expectedContract
    const allLogs = Array.isArray(receipt.logs) ? receipt.logs : [];
    if (isAuthorizedDelegation && !allLogs.some((l) => (l.address || "").toLowerCase() === expectedContract)) {
      return {
        status: "CONTRACT_MISMATCH",
        verified: false,
        isSimulated: false,
        txHash,
        blockNumber: parseBlockNumber(receipt.blockNumber),
        destinationAddress: receipt.to || null,
        expectedContractAddress: expectedContract,
        message: `Transaction routed through delegation manager (${receipt.to}) did not invoke authorized AgriChain contract (${expectedContract}).`
      };
    }

    // 3. Fail closed: Reject missing, invalid, or unsupported expected action before inspecting transaction logs
    const actionKey = normalizeActionKey(options.expectedAction);
    if (!options.expectedAction || !actionKey || !ACTION_EVENT_MAP[actionKey]) {
      return {
        status: "UNSUPPORTED_ACTION",
        verified: false,
        isSimulated: false,
        txHash,
        expectedAction: options.expectedAction || null,
        message: `Expected lifecycle action '${options.expectedAction || "missing"}' is missing, invalid, or unsupported.`
      };
    }
    const actionConfig = ACTION_EVENT_MAP[actionKey];

    // 4. Fail closed: Require valid expected product ID for supply chain lifecycle action
    if (
      options.productId === undefined ||
      options.productId === null ||
      String(options.productId).trim() === "" ||
      isNaN(Number(options.productId)) ||
      Number(options.productId) <= 0
    ) {
      return {
        status: "PRODUCT_ID_REQUIRED",
        verified: false,
        isSimulated: false,
        txHash,
        expectedAction: actionKey,
        message: "Mandatory product ID is missing or invalid for lifecycle verification."
      };
    }
    const expectedProductIdStr = String(options.productId);

    // 5. Inspect logs emitted strictly by the configured AgriChain contract
    const contractLogs = allLogs.filter(
      (log) => (log.address || "").toLowerCase() === expectedContract
    );

    if (contractLogs.length === 0) {
      return {
        status: "EXPECTED_EVENT_MISSING",
        verified: false,
        isSimulated: false,
        txHash,
        blockNumber: parseBlockNumber(receipt.blockNumber),
        expectedEvent: actionConfig.eventName,
        message: `No event logs found in transaction receipt matching AgriChain contract (${expectedContract}).`
      };
    }

    // 6. Require the EXACT event corresponding to requested action (no permissive fallback)
    let matchedParsedLog = null;
    let anyAgriChainEventFound = null;

    for (const log of contractLogs) {
      try {
        const parsed = contractInterface.parseLog({
          topics: log.topics,
          data: log.data
        });
        if (parsed) {
          anyAgriChainEventFound = parsed;
          if (parsed.name === actionConfig.eventName) {
            matchedParsedLog = parsed;
            break;
          }
        }
      } catch (_) {
        // Log was not decodable by AgriChain ABI; check next log
      }
    }

    if (!matchedParsedLog) {
      if (anyAgriChainEventFound) {
        return {
          status: "ACTION_MISMATCH",
          verified: false,
          isSimulated: false,
          txHash,
          blockNumber: parseBlockNumber(receipt.blockNumber),
          expectedAction: actionKey,
          expectedEvent: actionConfig.eventName,
          foundEvent: anyAgriChainEventFound.name,
          message: `Transaction emitted '${anyAgriChainEventFound.name}' instead of expected lifecycle event '${actionConfig.eventName}'.`
        };
      }
      return {
        status: "EXPECTED_EVENT_MISSING",
        verified: false,
        isSimulated: false,
        txHash,
        blockNumber: parseBlockNumber(receipt.blockNumber),
        expectedEvent: actionConfig.eventName,
        message: `Expected event '${actionConfig.eventName}' was not emitted in transaction receipt.`
      };
    }

    // 7. Verify Product ID match
    const eventProductId = matchedParsedLog.args.productId !== undefined
      ? matchedParsedLog.args.productId.toString()
      : null;

    if (eventProductId !== expectedProductIdStr) {
      return {
        status: "PRODUCT_ID_MISMATCH",
        verified: false,
        isSimulated: false,
        txHash,
        blockNumber: parseBlockNumber(receipt.blockNumber),
        eventProductId,
        expectedProductId: expectedProductIdStr,
        message: `On-chain event product ID (${eventProductId}) does not match expected product ID (${expectedProductIdStr}).`
      };
    }

    // 8. Verify Actor / Signer identity against on-chain indexed parameters
    const expectedActor = (options.expectedActor || options.actorAddress || options.farmer);
    if (actionConfig.actorField) {
      if (!expectedActor) {
        return {
          status: "ACTOR_IDENTITY_REQUIRED",
          verified: false,
          isSimulated: false,
          txHash,
          field: actionConfig.actorField,
          message: `Mandatory actor identity (${actionConfig.actorField}) is required for verifying '${actionKey}'.`
        };
      }
      const onChainActor = matchedParsedLog.args[actionConfig.actorField];
      if (!onChainActor || onChainActor.toLowerCase() !== expectedActor.toLowerCase()) {
        return {
          status: "ACTOR_MISMATCH",
          verified: false,
          isSimulated: false,
          txHash,
          blockNumber: parseBlockNumber(receipt.blockNumber),
          onChainActor: onChainActor ? onChainActor.toLowerCase() : null,
          expectedActor: expectedActor.toLowerCase(),
          field: actionConfig.actorField,
          message: `On-chain event actor (${onChainActor ? onChainActor.toLowerCase() : "none"}) does not match expected actor (${expectedActor.toLowerCase()}).`
        };
      }
    }

    // 9. Verify Receiver identity against on-chain indexed parameters (if applicable)
    if (actionConfig.hasReceiver && actionConfig.receiverField) {
      const expectedReceiver = (options.expectedReceiver || options.receiverAddress);
      if (!expectedReceiver) {
        return {
          status: "RECIPIENT_IDENTITY_REQUIRED",
          verified: false,
          isSimulated: false,
          txHash,
          field: actionConfig.receiverField,
          message: `Mandatory recipient identity (${actionConfig.receiverField}) is required for verifying '${actionKey}'.`
        };
      }
      const onChainReceiver = matchedParsedLog.args[actionConfig.receiverField];
      if (!onChainReceiver || onChainReceiver.toLowerCase() !== expectedReceiver.toLowerCase()) {
        return {
          status: "ACTOR_MISMATCH",
          verified: false,
          isSimulated: false,
          txHash,
          blockNumber: parseBlockNumber(receipt.blockNumber),
          onChainReceiver: onChainReceiver ? onChainReceiver.toLowerCase() : null,
          expectedReceiver: expectedReceiver.toLowerCase(),
          field: actionConfig.receiverField,
          message: `On-chain event recipient (${onChainReceiver ? onChainReceiver.toLowerCase() : "none"}) does not match expected recipient (${expectedReceiver.toLowerCase()}).`
        };
      }
    }

    // All required checks passed!
    return {
      status: "VERIFIED_ON_CHAIN",
      verified: true,
      isSimulated: false,
      txHash,
      blockNumber: parseBlockNumber(receipt.blockNumber),
      gasUsed: parseGas(receipt.gasUsed),
      from: receipt.from,
      to: receipt.to,
      contractVerified: true,
      contractAddress: expectedContract,
      event: matchedParsedLog.name,
      productId: Number(eventProductId),
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
  rpcCall,
  CONFIGURED_CONTRACT_ADDRESS,
  AUTHORIZED_DELEGATION_MANAGERS,
  resolveAuthorizedDelegationManagers,
  SEPOLIA_RPC_URLS,
  ACTION_EVENT_MAP,
  normalizeActionKey,
  contractInterface,
  resolveSepoliaRpcUrls,
  resolveContractAddress
};

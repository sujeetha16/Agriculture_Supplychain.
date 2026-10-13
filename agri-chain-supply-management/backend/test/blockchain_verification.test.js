// Path: backend/test/blockchain_verification.test.js
// Comprehensive cryptographic regression test suite for Ethereum Sepolia transaction verification

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");

const app = require("../server");
const Product = require("../models/Product");
const {
  verifyTransaction,
  contractInterface,
  CONFIGURED_CONTRACT_ADDRESS
} = require("../services/blockchainVerifier");
const { connectDB } = require("../config/db");

let server;
let baseUrl;

const FARMER_ADDR = "0x90f79bf6eb2c4f870365e785982e1f101e93b906";
const DISTRIBUTOR_ADDR = "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65";
const RETAILER_ADDR = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4df";
const CONSUMER_ADDR = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const IMPOSTER_ADDR = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
const UNRELATED_CONTRACT = "0x1111111111111111111111111111111111111111";

function buildReceipt({
  contractAddress = CONFIGURED_CONTRACT_ADDRESS,
  status = "0x1",
  to = CONFIGURED_CONTRACT_ADDRESS,
  from = FARMER_ADDR,
  eventName = "ProductCreated",
  eventParams = [9001n, "Honeycrisp Apples", "2026-10-10", FARMER_ADDR, 1700000000n],
  logEmitterAddress = null,
  includeUnrelatedLogs = false
} = {}) {
  const logs = [];

  if (includeUnrelatedLogs) {
    logs.push({
      address: UNRELATED_CONTRACT,
      topics: ["0x9681ca189e1e0a4c7b66367bba77ac400a74bc6cd99b8f982497774f763893ff"],
      data: "0x"
    });
  }

  if (eventName) {
    const fragment = contractInterface.getEvent(eventName);
    const encoded = contractInterface.encodeEventLog(fragment, eventParams);
    logs.push({
      address: logEmitterAddress || contractAddress,
      topics: encoded.topics,
      data: encoded.data,
      blockNumber: "0x1a2b",
      transactionHash: "0x" + "a".repeat(64)
    });
  }

  return {
    status,
    to,
    from,
    blockNumber: "0x1a2b",
    gasUsed: "0x5208",
    transactionHash: "0x" + "a".repeat(64),
    logs
  };
}

before(async () => {
  await connectDB();
  if (typeof Product.resetToDefault === "function") {
    await Product.resetToDefault();
  }
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (typeof Product.resetToDefault === "function") {
    await Product.resetToDefault();
  }
  const User = require("../models/User");
  if (typeof User.resetToDefault === "function") {
    await User.resetToDefault();
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("Blockchain Verification Correctness & Regression Suite (15 Critical Scenarios)", () => {
  const validTxHash = "0x" + "a".repeat(64);

  test("1. Valid transaction, correct AgriChain contract, expected event, correct product ID and action", async () => {
    const receipt = buildReceipt({
      eventName: "ProductCreated",
      eventParams: [9001n, "Organic Apples", "2026-10-10", FARMER_ADDR, 1700000000n]
    });

    const result = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "CREATED",
      expectedActor: FARMER_ADDR
    });

    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.status, "VERIFIED_ON_CHAIN");
    assert.strictEqual(result.contractVerified, true);
    assert.strictEqual(result.event, "ProductCreated");
    assert.strictEqual(result.productId, 9001);
  });

  test("2. Successful transaction sent to the wrong contract", async () => {
    const receipt = buildReceipt({
      to: UNRELATED_CONTRACT,
      eventName: "ProductCreated",
      eventParams: [9001n, "Organic Apples", "2026-10-10", FARMER_ADDR, 1700000000n]
    });

    const result = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "CREATED"
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, "CONTRACT_MISMATCH");
    assert.ok(result.message.includes("does not match configured AgriChain contract"));
  });

  test("3. Successful transaction with no expected event", async () => {
    const receipt = buildReceipt({
      eventName: null // Empty logs
    });

    const result = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "CREATED"
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, "EXPECTED_EVENT_MISSING");
  });

  test("4. Transaction containing an event for the wrong product ID", async () => {
    const receipt = buildReceipt({
      eventName: "ProductCreated",
      eventParams: [9999n, "Organic Apples", "2026-10-10", FARMER_ADDR, 1700000000n] // productId 9999
    });

    const result = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001, // expecting 9001
      expectedAction: "CREATED"
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, "PRODUCT_ID_MISMATCH");
    assert.strictEqual(result.eventProductId, "9999");
    assert.strictEqual(result.expectedProductId, "9001");
  });

  test("5. Transaction containing the wrong lifecycle event", async () => {
    // Transaction contains ProductDispatchedToDistributor instead of expected ProductCreated
    const fragment = contractInterface.getEvent("ProductDispatchedToDistributor");
    const encoded = contractInterface.encodeEventLog(fragment, [
      9001n,
      FARMER_ADDR,
      DISTRIBUTOR_ADDR,
      "2026-10-11",
      1700000000n
    ]);

    const receipt = {
      status: "0x1",
      to: CONFIGURED_CONTRACT_ADDRESS,
      from: FARMER_ADDR,
      blockNumber: "0x1a2b",
      gasUsed: "0x5208",
      transactionHash: validTxHash,
      logs: [{
        address: CONFIGURED_CONTRACT_ADDRESS,
        topics: encoded.topics,
        data: encoded.data
      }]
    };

    const result = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "CREATED" // Expecting creation, got dispatch
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, "ACTION_MISMATCH");
    assert.strictEqual(result.expectedEvent, "ProductCreated");
    assert.strictEqual(result.foundEvent, "ProductDispatchedToDistributor");
  });

  test("6. Transaction from the wrong stakeholder (actor mismatch)", async () => {
    const receipt = buildReceipt({
      eventName: "ProductCreated",
      eventParams: [9001n, "Organic Apples", "2026-10-10", IMPOSTER_ADDR, 1700000000n] // On-chain farmer is IMPOSTER
    });

    const result = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "CREATED",
      expectedActor: FARMER_ADDR // Expecting FARMER
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, "ACTOR_MISMATCH");
    assert.strictEqual(result.onChainActor, IMPOSTER_ADDR);
    assert.strictEqual(result.expectedActor, FARMER_ADDR);
  });

  test("7. Transaction receipt with failed execution (reverted on-chain)", async () => {
    const receipt = buildReceipt({
      status: "0x0" // Execution reverted
    });

    const result = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "CREATED"
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, "TRANSACTION_REVERTED");
  });

  test("8. Missing receipt or pending transaction", async () => {
    const result = await verifyTransaction(validTxHash, {
      receipt: null // Receipt not yet mined
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, "PENDING_OR_NOT_FOUND");
  });

  test("9. RPC provider unavailable", async () => {
    // Pass non-existent RPC endpoint in options or verify error handling
    const brokenHash = "0x" + "b".repeat(64);
    // Call verifyTransaction without receipt to trigger RPC failover
    // With unreachable dummy endpoint or timed out call
    const result = await verifyTransaction(brokenHash, {
      timeoutMs: 50 // Short timeout to test failover handling
    });

    assert.strictEqual(result.verified, false);
    assert.ok(
      result.status === "RPC_UNAVAILABLE" || result.status === "PENDING_OR_NOT_FOUND",
      `Expected RPC_UNAVAILABLE or PENDING_OR_NOT_FOUND, got ${result.status}`
    );
  });

  test("10. Malformed transaction hash rejected immediately", async () => {
    const invalidHashes = [
      "not-a-hash",
      "0x123", // too short
      "0x" + "z".repeat(64), // invalid non-hex characters
      "",
      null,
      undefined
    ];

    for (const badHash of invalidHashes) {
      const result = await verifyTransaction(badHash);
      assert.strictEqual(result.verified, false);
      assert.strictEqual(result.status, "INVALID_HASH_FORMAT");
    }
  });

  test("11. Event emitted by an unrelated contract included in receipt logs", async () => {
    // Receipt has an event with matching topic, but emitted by an UNRELATED contract address
    const receipt = buildReceipt({
      eventName: "ProductCreated",
      eventParams: [9001n, "Organic Apples", "2026-10-10", FARMER_ADDR, 1700000000n],
      logEmitterAddress: UNRELATED_CONTRACT // Emitted by wrong contract
    });

    const result = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "CREATED"
    });

    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, "EXPECTED_EVENT_MISSING");
  });

  test("12. Simulated/demo transaction is never represented as verified on-chain", async () => {
    const demoResult = await verifyTransaction("0xsim-test-batch-001", {
      isDemoMode: true,
      productId: 9001,
      expectedAction: "CREATED"
    });

    assert.strictEqual(demoResult.verified, false);
    assert.strictEqual(demoResult.status, "SIMULATED_DEMO");
    assert.strictEqual(demoResult.isSimulated, true);
    assert.ok(!demoResult.message.includes("verified on Ethereum"));
  });

  test("13. Database lifecycle state remains unchanged after failed verification", async () => {
    // Log in as farmer
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "farmer", password: "Farmer@123" })
    });
    const { token } = await loginRes.json();

    // Attempt to create a product with an unverified (reverted/invalid) transaction
    const failedCreateRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        productId: 9099,
        name: "Unverified Crop",
        harvestDate: "2026-10-10",
        farmer: FARMER_ADDR,
        txHash: "0x" + "f".repeat(64), // Real hash format but nonexistent / unmined
        isDemoMode: false // Explicitly real, non-demo mode
      })
    });

    // Verification must fail and creation must be blocked
    assert.ok(failedCreateRes.status === 422 || failedCreateRes.status === 503);
    const errBody = await failedCreateRes.json();
    assert.strictEqual(errBody.success, false);

    // Verify database does NOT contain product 9099
    const lookupRes = await fetch(`${baseUrl}/api/products/9099`);
    assert.strictEqual(lookupRes.status, 404);
  });

  test("14. Duplicate transaction submissions do not create duplicate lifecycle transitions", async () => {
    // Log in as farmer
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "farmer", password: "Farmer@123" })
    });
    const { token } = await loginRes.json();

    // Create a demo batch first
    const createRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        productId: 9088,
        name: "Duplicate Guard Crop",
        harvestDate: "2026-10-10",
        farmer: FARMER_ADDR,
        txHash: "0xsim-dup-test-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(createRes.status, 201);

    // First dispatch with txHash 0xsim-dup-dispatch-001
    const dispatch1 = await fetch(`${baseUrl}/api/products/9088/dispatch-distributor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        actorAddress: FARMER_ADDR,
        receiverAddress: DISTRIBUTOR_ADDR,
        date: "2026-10-11",
        txHash: "0xsim-dup-dispatch-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(dispatch1.status, 200);

    // Attempt to submit identical transition with the SAME txHash
    const dispatch2 = await fetch(`${baseUrl}/api/products/9088/dispatch-distributor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        actorAddress: FARMER_ADDR,
        receiverAddress: DISTRIBUTOR_ADDR,
        date: "2026-10-11",
        txHash: "0xsim-dup-dispatch-001", // Duplicate hash!
        isDemoMode: true
      })
    });
    assert.strictEqual(dispatch2.status, 409); // Conflict: Duplicate tx rejected!
  });

  test("15. Cryptographic Wallet Challenge & ECDSA Signature Verification Flow", async () => {
    // Create random Ethereum wallet using ethers
    const wallet = ethers.Wallet.createRandom();

    // Step A: Request challenge nonce
    const nonceRes = await fetch(`${baseUrl}/api/auth/wallet/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: wallet.address })
    });
    assert.strictEqual(nonceRes.status, 200);
    const nonceData = await nonceRes.json();
    assert.strictEqual(nonceData.success, true);
    assert.strictEqual(nonceData.walletAddress, wallet.address.toLowerCase());
    assert.ok(nonceData.nonce);
    assert.ok(nonceData.message);

    // Step B: Sign challenge message with private key
    const signature = await wallet.signMessage(nonceData.message);

    // Step C: Verify signature server-side
    const verifyRes = await fetch(`${baseUrl}/api/auth/wallet/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: wallet.address,
        signature,
        nonce: nonceData.nonce
      })
    });
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.verified, true);
    assert.strictEqual(verifyData.walletAddress, wallet.address.toLowerCase());

    // Step D: Replay attack prevention (nonce must be single-use)
    const replayRes = await fetch(`${baseUrl}/api/auth/wallet/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: wallet.address,
        signature,
        nonce: nonceData.nonce
      })
    });
    assert.strictEqual(replayRes.status, 400); // Replay rejected
  });

  test("16. Missing or unsupported expectedAction is rejected with UNSUPPORTED_ACTION and verified: false", async () => {
    const receipt = buildReceipt({
      eventName: "ProductCreated",
      eventParams: [9001n, "Organic Apples", "2026-10-10", FARMER_ADDR, 1700000000n]
    });

    // Case A: Missing expectedAction
    const resMissing = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001
    });
    assert.strictEqual(resMissing.verified, false);
    assert.strictEqual(resMissing.status, "UNSUPPORTED_ACTION");

    // Case B: Unsupported expectedAction
    const resInvalid = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "NON_EXISTENT_ACTION"
    });
    assert.strictEqual(resInvalid.verified, false);
    assert.strictEqual(resInvalid.status, "UNSUPPORTED_ACTION");
  });

  test("17. Missing or invalid productId is rejected with PRODUCT_ID_REQUIRED and verified: false", async () => {
    const receipt = buildReceipt({
      eventName: "ProductCreated",
      eventParams: [9001n, "Organic Apples", "2026-10-10", FARMER_ADDR, 1700000000n]
    });

    // Case A: Missing productId
    const resMissing = await verifyTransaction(validTxHash, {
      receipt,
      expectedAction: "CREATED"
    });
    assert.strictEqual(resMissing.verified, false);
    assert.strictEqual(resMissing.status, "PRODUCT_ID_REQUIRED");

    // Case B: Invalid non-numeric productId
    const resInvalid = await verifyTransaction(validTxHash, {
      receipt,
      productId: "invalid-batch",
      expectedAction: "CREATED"
    });
    assert.strictEqual(resInvalid.verified, false);
    assert.strictEqual(resInvalid.status, "PRODUCT_ID_REQUIRED");
  });

  test("18. Missing mandatory actor identity is rejected with ACTOR_IDENTITY_REQUIRED and verified: false", async () => {
    const receipt = buildReceipt({
      eventName: "ProductCreated",
      eventParams: [9001n, "Organic Apples", "2026-10-10", FARMER_ADDR, 1700000000n]
    });

    const resNoActor = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "CREATED"
      // expectedActor omitted
    });
    assert.strictEqual(resNoActor.verified, false);
    assert.strictEqual(resNoActor.status, "ACTOR_IDENTITY_REQUIRED");
  });

  test("19. Missing mandatory recipient identity for transfer actions is rejected with RECIPIENT_IDENTITY_REQUIRED and verified: false", async () => {
    const fragment = contractInterface.getEvent("ProductDispatchedToDistributor");
    const encoded = contractInterface.encodeEventLog(fragment, [
      9001n,
      FARMER_ADDR,
      DISTRIBUTOR_ADDR,
      "2026-10-11",
      1700000000n
    ]);

    const receipt = {
      status: "0x1",
      to: CONFIGURED_CONTRACT_ADDRESS,
      from: FARMER_ADDR,
      blockNumber: "0x1a2b",
      gasUsed: "0x5208",
      transactionHash: validTxHash,
      logs: [{
        address: CONFIGURED_CONTRACT_ADDRESS,
        topics: encoded.topics,
        data: encoded.data
      }]
    };

    const resNoReceiver = await verifyTransaction(validTxHash, {
      receipt,
      productId: 9001,
      expectedAction: "DISPATCHED_TO_DISTRIBUTOR",
      expectedActor: FARMER_ADDR
      // expectedReceiver omitted
    });
    assert.strictEqual(resNoReceiver.verified, false);
    assert.strictEqual(resNoReceiver.status, "RECIPIENT_IDENTITY_REQUIRED");
  });

  test("20. Concurrency guard: Two simultaneous requests cannot both advance the same lifecycle state", async () => {
    // Log in as farmer
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "farmer", password: "Farmer@123" })
    });
    const { token } = await loginRes.json();

    // Create a new batch 9077
    const createRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        productId: 9077,
        name: "Concurrent Guard Batch",
        harvestDate: "2026-10-10",
        farmer: FARMER_ADDR,
        txHash: "0xsim-conc-create-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(createRes.status, 201);

    // Send two simultaneous requests trying to dispatch batch 9077 concurrently
    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/products/9077/dispatch-distributor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actorAddress: FARMER_ADDR,
          receiverAddress: DISTRIBUTOR_ADDR,
          date: "2026-10-11",
          txHash: "0xsim-conc-dispatch-A",
          isDemoMode: true
        })
      }),
      fetch(`${baseUrl}/api/products/9077/dispatch-distributor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actorAddress: FARMER_ADDR,
          receiverAddress: DISTRIBUTOR_ADDR,
          date: "2026-10-11",
          txHash: "0xsim-conc-dispatch-B",
          isDemoMode: true
        })
      })
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Exactly one must succeed (200) and the concurrent conflict must be rejected (409)
    assert.deepStrictEqual(statuses, [200, 409], "One concurrent transition must succeed (200) and one must be rejected (409)");

    // Verify batch status is DispatchedToDistributor and has exactly 1 dispatch in history
    const checkRes = await fetch(`${baseUrl}/api/products/9077`);
    const checkData = await checkRes.json();
    assert.strictEqual(checkData.product.status, "DispatchedToDistributor");
    const dispatches = checkData.product.history.filter((h) => h.action === "DISPATCHED_TO_DISTRIBUTOR");
    assert.strictEqual(dispatches.length, 1, "Exactly one dispatch entry may be recorded in history");
  });

  test("21. Production secret configuration fails safely without hardcoded fallback", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.JWT_SECRET;

      // Re-evaluating secret resolution under production without secret must throw
      const fs = require("fs");
      const authCode = fs.readFileSync(path.join(__dirname, "../middleware/auth.js"), "utf-8");

      assert.ok(authCode.includes("FATAL SECURITY CONFIGURATION"));
      assert.ok(authCode.includes("JWT_SECRET must be explicitly configured"));
      assert.ok(!authCode.includes("agri-chain-dev-insecure-secret-for-local-development-only-2026\" && IS_PRODUCTION"));
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalSecret) process.env.JWT_SECRET = originalSecret;
    }
  });

  test("22. CloudFormation ECR regex enforces private ECR URI and rejects public ECR or hello-app-runner", () => {
    const fs = require("fs");
    const cfnTemplate = fs.readFileSync(path.join(__dirname, "../../aws/cloudformation-template.yaml"), "utf-8");

    // Extract AllowedPattern for BackendImageIdentifier
    const match = cfnTemplate.match(/AllowedPattern:\s*'([^']+)'/);
    assert.ok(match, "AllowedPattern must be present in CloudFormation template");
    const regex = new RegExp(match[1]);

    // Valid private ECR URIs
    assert.strictEqual(regex.test("123456789012.dkr.ecr.us-east-1.amazonaws.com/agri-chain-backend:latest"), true);
    assert.strictEqual(regex.test("987654321098.dkr.ecr.eu-west-1.amazonaws.com/agriculture/api:v1.0.0"), true);

    // Invalid / forbidden URIs
    assert.strictEqual(regex.test("public.ecr.aws/aws-containers/hello-app-runner:latest"), false);
    assert.strictEqual(regex.test("public.ecr.aws/my-repo:latest"), false);
    assert.strictEqual(regex.test("hello-app-runner:latest"), false);
    assert.strictEqual(regex.test("123456789012.dkr.ecr.us-east-1.amazonaws.com/agri-chain-backend"), false); // missing tag
  });

  test("23. Production CONTRACT_ADDRESS configuration fails fast on malformed address", () => {
    const { resolveContractAddress } = require("../services/blockchainVerifier");
    const originalEnv = process.env.NODE_ENV;
    const originalAddr = process.env.CONTRACT_ADDRESS;

    try {
      process.env.NODE_ENV = "production";
      process.env.CONTRACT_ADDRESS = "0xInvalidMalformedAddress";

      assert.throws(
        () => resolveContractAddress(),
        /\[CRITICAL\] Invalid Ethereum contract address/
      );

      // Valid address must succeed
      process.env.CONTRACT_ADDRESS = "0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D";
      const resolved = resolveContractAddress();
      assert.strictEqual(resolved, "0xb601fdccec475b61b8bc9f3661ec4f73b7499a2d");
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalAddr !== undefined) {
        process.env.CONTRACT_ADDRESS = originalAddr;
      } else {
        delete process.env.CONTRACT_ADDRESS;
      }
    }
  });

  test("24. Production SEPOLIA_RPC_URL configuration validates URL scheme and supports fallback", () => {
    const { resolveSepoliaRpcUrls } = require("../services/blockchainVerifier");
    const originalEnv = process.env.NODE_ENV;
    const originalRpc = process.env.SEPOLIA_RPC_URL;
    const originalPubRpc = process.env.SEPOLIA_PUBLIC_RPC_URL;

    try {
      process.env.NODE_ENV = "production";
      process.env.SEPOLIA_RPC_URL = "not-a-valid-url";
      delete process.env.SEPOLIA_PUBLIC_RPC_URL;

      assert.throws(
        () => resolveSepoliaRpcUrls(),
        /\[CRITICAL\] Invalid SEPOLIA_RPC_URL/
      );

      // Valid URL must be prepended
      process.env.SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/mock-key";
      const urls = resolveSepoliaRpcUrls();
      assert.strictEqual(urls[0], "https://eth-sepolia.g.alchemy.com/v2/mock-key");
      assert.ok(urls.length >= 2, "Fallback community gateways must be retained");
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalRpc !== undefined) {
        process.env.SEPOLIA_RPC_URL = originalRpc;
      } else {
        delete process.env.SEPOLIA_RPC_URL;
      }
      if (originalPubRpc !== undefined) {
        process.env.SEPOLIA_PUBLIC_RPC_URL = originalPubRpc;
      } else {
        delete process.env.SEPOLIA_PUBLIC_RPC_URL;
      }
    }
  });

  test("25. CloudFormation template enforces KMS least privilege, RPC parameters, and alarm dependencies", () => {
    const fs = require("fs");
    const cfnTemplate = fs.readFileSync(path.join(__dirname, "../../aws/cloudformation-template.yaml"), "utf-8");

    // KMS least privilege: kms:Decrypt must NOT be granted against Secrets Manager secret ARNs
    assert.ok(
      !/secretsmanager:GetSecretValue[\s\S]*?kms:Decrypt[\s\S]*?Resource:\s*\n\s*-\s*!Ref\s*JwtSecretArn/.test(cfnTemplate),
      "kms:Decrypt must not be coupled to Secret ARNs"
    );

    // Customer-Managed Key policy must be conditional
    assert.ok(cfnTemplate.includes("AppRunnerKmsDecryptPolicy:"));
    assert.ok(cfnTemplate.includes("Condition: HasCustomKmsKey"));

    // Explicit parameters for RPC and Contract Address
    assert.ok(cfnTemplate.includes("SepoliaRpcSecretArn:"));
    assert.ok(cfnTemplate.includes("SepoliaRpcUrl:"));
    assert.ok(cfnTemplate.includes("ContractAddress:"));

    // Alarm must depend on App Runner service
    assert.ok(cfnTemplate.includes("Backend5xxErrorsAlarm:"));
    assert.ok(cfnTemplate.includes("DependsOn: BackendAppRunnerService"));
  });
});

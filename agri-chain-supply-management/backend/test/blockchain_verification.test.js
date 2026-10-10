// Path: backend/test/blockchain_verification.test.js
// Comprehensive cryptographic regression test suite for Ethereum Sepolia transaction verification

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
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
});

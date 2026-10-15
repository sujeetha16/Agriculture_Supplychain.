// Path: backend/test/auth_and_lifecycle.test.js
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const app = require("../server");

let server;
let baseUrl;

const { connectDB } = require("../config/db");
const Product = require("../models/Product");
const User = require("../models/User");

before(async () => {
  await connectDB();
  if (typeof Product.resetToDefault === "function") {
    await Product.resetToDefault();
  }
  if (typeof User.resetToDefault === "function") {
    await User.resetToDefault();
  }
  // Bind to ephemeral port for testing
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (typeof Product.resetToDefault === "function") {
    await Product.resetToDefault();
  }
  if (typeof User.resetToDefault === "function") {
    await User.resetToDefault();
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("Backend API Security, Authentication & Lifecycle Suite", () => {
  let farmerToken;
  let distributorToken;
  let retailerToken;
  const testFarmerAddress = "0x90f79bf6eb2c4f870365e785982e1f101e93b906";
  const testDistributorAddress = "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65";
  const testRetailerAddress = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4df";
  const testConsumerAddress = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
  const testProductId = 8801;

  test("1. Health Endpoint returns 200 with structured observability payload", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, "healthy");
    assert.strictEqual(body.service, "Agriculture Supply Chain API");
    assert.ok(body.uptimeSeconds >= 0);
    assert.ok(body.system.memoryUsageMB > 0);
  });

  test("2. Registration rejects invalid inputs (name too short, invalid email)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "A",
        username: "bad",
        email: "not-an-email",
        password: "123",
        role: 99
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.errors.name);
    assert.ok(data.errors.email);
    assert.ok(data.errors.password);
    assert.ok(data.errors.role);
  });

  test("3. Registration successfully hashes password and returns safe user profile without password", async () => {
    const uniqueUser = `tfarm_${Date.now().toString().slice(-8)}`;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Certified Farmer",
        username: uniqueUser,
        email: `${uniqueUser}@agrifarm.test`,
        password: "SecureFarmerPass@123",
        role: 1,
        organization: "Cascade Valley Organic Cooperative",
        location: "Wenatchee, WA",
        phone: "+1 509-555-9876"
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.username, uniqueUser);
    assert.strictEqual(data.user.password, undefined); // Password MUST NOT be returned!
    assert.ok(data.token);
  });

  test("4. Authentication rejects invalid password without exposing valid credentials in response", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "farmer",
        password: "WrongPassword!999"
      })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.message, "Invalid username or password.");
    // Ensure plaintext passwords are NOT leaked in error messages
    assert.ok(!data.message.includes("Farmer@123"));
    assert.ok(!data.message.includes("Pass@1234"));
  });

  test("5. Stakeholder logins succeed and issue valid cryptographic JWTs", async () => {
    // Login as Farmer
    const farmerRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "farmer", password: "Farmer@123" })
    });
    assert.strictEqual(farmerRes.status, 200);
    const farmerData = await farmerRes.json();
    assert.ok(farmerData.token);
    farmerToken = farmerData.token;

    // Login as Distributor
    const distRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "distributor", password: "Distributor@123" })
    });
    assert.strictEqual(distRes.status, 200);
    distributorToken = (await distRes.json()).token;

    // Login as Retailer
    const retRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "retailer", password: "Retailer@123" })
    });
    assert.strictEqual(retRes.status, 200);
    retailerToken = (await retRes.json()).token;
  });

  test("6. Product Creation rejects unauthenticated requests with 401", async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: testProductId,
        name: "Unauthorized Honeycrisp Apples",
        harvestDate: "2026-10-10",
        farmer: testFarmerAddress,
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      })
    });
    assert.strictEqual(res.status, 401);
  });

  test("7. Product Creation rejects non-farmer roles with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${distributorToken}` // Distributor trying to create crop
      },
      body: JSON.stringify({
        productId: testProductId,
        name: "Illicit Distributor Crop",
        harvestDate: "2026-10-10",
        farmer: testDistributorAddress,
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      })
    });
    assert.strictEqual(res.status, 403);
  });

  test("8. Authorized Farmer successfully creates crop batch", async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        productId: testProductId,
        name: "Verified Gala Apples",
        harvestDate: "2026-10-10",
        farmer: testFarmerAddress,
        txHash: "0xsim-test-harvest-001",
        cropType: "Fruits",
        isDemoMode: true
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.product.productId, testProductId);
    assert.strictEqual(data.product.status, "Created");
    assert.strictEqual(data.product.isSimulated, true);
    assert.strictEqual(data.product.verificationStatus, "SIMULATED_DEMO");
  });

  test("9. Duplicate Product ID creation rejected with 409 Conflict", async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        productId: testProductId, // Duplicate
        name: "Duplicate Apples",
        harvestDate: "2026-10-10",
        farmer: testFarmerAddress,
        txHash: "0xsim-test-harvest-002",
        isDemoMode: true
      })
    });
    assert.strictEqual(res.status, 409);
  });

  test("10. Out-of-order state transition rejected (cannot receive before dispatch)", async () => {
    const res = await fetch(`${baseUrl}/api/products/${testProductId}/receive-distributor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${distributorToken}`
      },
      body: JSON.stringify({
        actorAddress: testDistributorAddress,
        date: "2026-10-11",
        txHash: "0xsim-test-receive-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(res.status, 409); // Expected DispatchedToDistributor, found Created
  });

  test("11. Complete Supply Chain Lifecycle execution: Farmer -> Distributor -> Retailer -> Consumer", async () => {
    // Step A: Farmer dispatches to Distributor
    const dispatchDistRes = await fetch(`${baseUrl}/api/products/${testProductId}/dispatch-distributor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        actorAddress: testFarmerAddress,
        receiverAddress: testDistributorAddress,
        date: "2026-10-11",
        txHash: "0xsim-dispatch-dist-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(dispatchDistRes.status, 200);
    const d1 = await dispatchDistRes.json();
    assert.strictEqual(d1.product.status, "DispatchedToDistributor");

    // Step B: Distributor receives
    const receiveDistRes = await fetch(`${baseUrl}/api/products/${testProductId}/receive-distributor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${distributorToken}`
      },
      body: JSON.stringify({
        actorAddress: testDistributorAddress,
        date: "2026-10-12",
        txHash: "0xsim-receive-dist-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(receiveDistRes.status, 200);
    const d2 = await receiveDistRes.json();
    assert.strictEqual(d2.product.status, "ReceivedByDistributor");

    // Step C: Distributor dispatches to Retailer
    const dispatchRetRes = await fetch(`${baseUrl}/api/products/${testProductId}/dispatch-retailer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${distributorToken}`
      },
      body: JSON.stringify({
        actorAddress: testDistributorAddress,
        receiverAddress: testRetailerAddress,
        date: "2026-10-13",
        txHash: "0xsim-dispatch-ret-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(dispatchRetRes.status, 200);
    const d3 = await dispatchRetRes.json();
    assert.strictEqual(d3.product.status, "DispatchedToRetailer");

    // Step D: Retailer receives
    const receiveRetRes = await fetch(`${baseUrl}/api/products/${testProductId}/receive-retailer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${retailerToken}`
      },
      body: JSON.stringify({
        actorAddress: testRetailerAddress,
        date: "2026-10-14",
        txHash: "0xsim-receive-ret-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(receiveRetRes.status, 200);
    const d4 = await receiveRetRes.json();
    assert.strictEqual(d4.product.status, "ReceivedByRetailer");

    // Step E: Retailer sells to Consumer
    const sellRes = await fetch(`${baseUrl}/api/products/${testProductId}/sell-consumer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${retailerToken}`
      },
      body: JSON.stringify({
        actorAddress: testRetailerAddress,
        receiverAddress: testConsumerAddress,
        date: "2026-10-15",
        txHash: "0xsim-sell-consumer-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(sellRes.status, 200);
    const d5 = await sellRes.json();
    assert.strictEqual(d5.product.status, "SoldToConsumer");
    assert.strictEqual(d5.product.consumer, testConsumerAddress);
    assert.strictEqual(d5.product.history.length, 6);
  });

  test("12. Traceability Verification Endpoint audits cryptographic proof chain", async () => {
    const res = await fetch(`${baseUrl}/api/products/${testProductId}/verify`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.overallStatus, "SoldToConsumer");
    assert.strictEqual(body.creationVerification.status, "SIMULATED_DEMO");
    assert.strictEqual(body.historyVerifications.length, 6);
  });

  test("13. requireWalletMatch permits connected MetaMask wallet under non-production demo persona", async () => {
    const externalMetaMaskWallet = "0x96507b39b2a3291687f8dd3a39f8162c3668f08f";
    // Submitting with demo farmer token and custom external MetaMask wallet in dev/demo mode
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        productId: 7711,
        name: "MetaMask Linked Apples",
        harvestDate: "2026-10-14",
        farmer: externalMetaMaskWallet,
        txHash: "0xsim-metamask-demo-001",
        isDemoMode: true
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.product.farmer, externalMetaMaskWallet);
  });

  test("14. requireWalletMatch strictly enforces wallet match in production tier (NODE_ENV=production)", () => {
    const { requireWalletMatch } = require("../middleware/auth");
    const middleware = requireWalletMatch("farmer");

    // Mock non-demo user with custom registered wallet in production
    const req = {
      user: { id: "prod-user-1", username: "prodfarmer", role: 1, walletAddress: "0x1111111111111111111111111111111111111111" },
      body: { farmer: "0x2222222222222222222222222222222222222222" }
    };
    let statusCode = null;
    let jsonBody = null;
    const res = {
      status: (code) => { statusCode = code; return res; },
      json: (payload) => { jsonBody = payload; }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    middleware(req, res, next);
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(nextCalled, false);
    assert.match(jsonBody.message, /Actor wallet mismatch/);
  });
});

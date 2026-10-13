# Comprehensive Test & Verification Report

**Evaluation Project:** Agriculture Supply Chain Traceability Platform  
**Testing Environment:** Node.js v24.12.0, npm 11.6.2, Windows 11 Host, Vite 5.4, Hardhat 2.22  
**Report Date:** October 2026  
**Overall Status:** **61/61 Automated Tests Passing (100% Pass Rate across Backend, QR Resolution & Smart Contract Suites), Frontend Bundle Built Cleanly**

---

## 1. Summary of Executed Verification Suites

| Component Suite | Test Harness | Tests Executed | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend API Security & Lifecycle** | `node:test` + native fetch | 12 | 12 | 0 | **PASS (100%)** |
| **Blockchain Verification & Concurrency** | `node:test` + ethers v6 | 25 | 25 | 0 | **PASS (100%)** |
| **QR Code Payload Resolution & Parser** | `node:test` unit suite | 12 | 12 | 0 | **PASS (100%)** |
| **Smart Contract Suite** | Hardhat / Mocha / Chai | 12 | 12 | 0 | **PASS (100%)** |
| **Frontend Production Build** | Vite 5 (Rollup, Code-Split) | 284 modules | 284 | 0 | **PASS (Clean)** |
| **Local Smoke Micro-Benchmark** | `load_test_native.js` | 100 requests | 100 | 0 | **PASS (0% Err)** |

---

## 2. Suite Details & Reproduction Commands

### Suite 1: Backend API Security, Authentication & Lifecycle (12 Tests)
* **Command:** `npm test` (inside `agri-chain-supply-management/backend`)
* **Coverage:**
  1. Health Endpoint returns 200 with structured observability payload
  2. Registration rejects invalid inputs (name too short, invalid email)
  3. Registration successfully hashes password and returns safe user profile without password
  4. Authentication rejects invalid password without exposing valid credentials in response
  5. Stakeholder logins succeed and issue valid cryptographic JWTs
  6. Product Creation rejects unauthenticated requests with 401
  7. Product Creation rejects non-farmer roles with 403 Forbidden
  8. Authorized Farmer successfully creates crop batch
  9. Duplicate Product ID creation rejected with 409 Conflict
  10. Out-of-order state transition rejected (cannot receive before dispatch)
  11. Complete Supply Chain Lifecycle execution: Farmer -> Distributor -> Retailer -> Consumer
  12. Traceability Verification Endpoint audits cryptographic proof chain

### Suite 2: Blockchain Verification, Fail-Closed Security & Concurrency Suite (25 Tests)
* **Command:** `npm test` (inside `agri-chain-supply-management/backend`)
* **Coverage:**
  1. Valid transaction, correct AgriChain contract, expected event, correct product ID and action
  2. Successful transaction sent to the wrong contract (`CONTRACT_MISMATCH`)
  3. Successful transaction with no expected event (`EXPECTED_EVENT_MISSING`)
  4. Transaction containing an event for the wrong product ID (`PRODUCT_ID_MISMATCH`)
  5. Transaction containing the wrong lifecycle event (`ACTION_MISMATCH`)
  6. Transaction from the wrong stakeholder (`ACTOR_MISMATCH`)
  7. Transaction receipt with failed execution (`TRANSACTION_REVERTED`)
  8. Missing receipt or pending transaction (`PENDING_OR_NOT_FOUND`)
  9. RPC provider unavailable (`RPC_UNAVAILABLE`)
  10. Malformed transaction hash rejected immediately (`INVALID_HASH_FORMAT`)
  11. Event emitted by an unrelated contract included in receipt logs (`EXPECTED_EVENT_MISSING`)
  12. Simulated/demo transaction is never represented as verified on-chain (`SIMULATED_DEMO`)
  13. Database lifecycle state remains unchanged after failed verification
  14. Duplicate transaction submissions do not create duplicate lifecycle transitions
  15. Cryptographic Wallet Challenge & ECDSA Signature Verification Flow (SIWE single-use nonce, anti-replay, signer recovery)
  16. Missing or unsupported expectedAction is rejected with `UNSUPPORTED_ACTION` (fail closed)
  17. Missing or invalid productId is rejected with `PRODUCT_ID_REQUIRED` (fail closed)
  18. Missing mandatory actor identity is rejected with `ACTOR_IDENTITY_REQUIRED` (fail closed)
  19. Missing mandatory recipient identity for transfers is rejected with `RECIPIENT_IDENTITY_REQUIRED` (fail closed)
  20. Concurrency guard: Two simultaneous requests cannot both advance the same lifecycle state (one 200, one 409)
  21. Production secret configuration fails safely without hardcoded fallback
  22. CloudFormation ECR regex enforces private ECR URI format and rejects public ECR or hello-app-runner sample images
  23. Production CONTRACT_ADDRESS configuration fails fast on malformed address
  24. Production SEPOLIA_RPC_URL configuration validates URL scheme and supports fallback
  25. CloudFormation template enforces KMS least privilege, RPC parameters, and alarm dependencies


### Suite 3: QR Code Payload Resolution & Parser (12 Tests)
* **Command:** `npm test` (inside `agri-chain-supply-management/backend`)
* **Coverage:**
  1. Standard JSON payload containing productId (`{"productId": 101, ...}`)
  2. JSON payload containing id property (`{"id": 8801, ...}`)
  3. Absolute HTTPS URL containing `/trace/:id` (`https://domain.com/trace/102`)
  4. Relative URL containing `/trace/:id` (`/trace/9088`)
  5. Raw integer batch ID (`101`)
  6. Hash-prefixed batch ID (`#8801`)
  7. BATCH-prefixed identifier (`BATCH-9088`)
  8. Fails safely on malformed JSON payload (`{ productId: 101, name: broken`)
  9. Fails safely on JSON missing productId and id (`{"name": "Unknown"}`)
  10. Fails safely on JSON with negative or non-integer productId (`{"productId": -5}`)
  11. Fails safely on completely unrelated URL or search text (`https://google.com/...`)
  12. Fails safely on empty, null, or non-string input (`""`, `null`, `undefined`, number)

### Suite 4: Hardhat Smart Contract Lifecycle & Access Control (12 Tests)
* **Command:** `npx hardhat test` (inside `agri-chain-supply-management/blockchain`)
* **Coverage:**
  * Role Registration & Access Control (3 tests)
  * Product Creation (3 tests)
  * Complete Legitimate Supply-Chain Transition Cycle (1 test)
  * Negative Security & State-Machine Violations (5 tests)

### Suite 5: Frontend Production Bundle Compilation
* **Command:** `npm run build` (inside `agri-chain-supply-management/frontend`)
* **Output:**
  ```
  vite v5.4.21 building for production...
  ✓ 284 modules transformed.
  dist/index.html                               1.42 kB │ gzip:   0.74 kB
  dist/assets/bootstrap-icons-mSm7cUeB.woff2  134.04 kB
  dist/assets/bootstrap-icons-BeopsB42.woff   180.29 kB
  dist/assets/index-BJydt2Zx.css              315.90 kB │ gzip:  47.07 kB
  dist/assets/index-NZ_sv2Dh.js               123.64 kB │ gzip:  28.57 kB
  dist/assets/vendor-iqr3Fnrv.js              215.56 kB │ gzip:  72.51 kB
  dist/assets/web3-CR56BBeQ.js                267.31 kB │ gzip:  99.05 kB
  dist/assets/scanner-BPKgJl4x.js             351.28 kB │ gzip: 106.39 kB
  ✓ built in 3.75s (zero bundle warnings)
  ```

### Suite 6: Local API Smoke Micro-Benchmark
* **Command:** `node experiments/load_test_native.js --url http://localhost:5000 --endpoint /api/products --users 10 --requests 100`
* **Benchmark Integrity Notice:**
  * **Target:** Localhost HTTP server (`http://localhost:5000/api/products`).
  * **Workload:** 10 concurrent virtual users executing 100 HTTP GET requests against local in-memory storage.
  * **Scope:** Measures Node.js loopback HTTP request turnaround.
  * **Critical Distinction:** This micro-benchmark **does NOT** represent distributed AWS cloud performance, nor does it measure Ethereum blockchain transaction throughput or gas limits. Blockchain consensus time depends on Sepolia block interval (~12s) and RPC node roundtrip.

---

## 3. Environment & Operational Limitations

1. **Host AWS CLI Absence:**
   * The local development machine does not have the AWS CLI (`aws`) or Python installed. Live AWS deployment validation (`aws cloudformation validate-template`) was **NOT RUN** due to missing tooling.
2. **No Real AWS Deployment Provisioned:**
   * In strict compliance with safety rules, no real AWS resources were provisioned, modified, or deleted. All infrastructure changes are validated in configuration files only.
3. **No Real Cryptocurrency Transactions:**
   * Live Sepolia transactions were **NOT SENT** during automated testing. Tests utilized Hardhat local EVM and cryptographic receipt fixtures based directly on the authoritative contract ABI.
4. **External MongoDB Connection:**
   * Automated tests ran against the local resilient datastore sandbox. MongoDB Atlas connectivity requires internet egress and valid managed credentials.
5. **Dual-State Recovery Strategy & Absence of Autonomous Reconciler:**
   * **Client-Driven Retry Behavior:** If an on-chain transaction succeeds on Ethereum Sepolia but the subsequent database update fails (e.g., transient database timeout or server restart), the MongoDB record remains at the prior state. Because the product is still in `expectedStatus` and the transaction hash has not been saved in `history`, the client can safely re-submit the request with the same `txHash`. The endpoint re-verifies the mined receipt and atomically applies the state transition.
   * **Absence of Autonomous Reconciler:** The system does not currently feature a background polling daemon to automatically query smart contract state and backfill unrecorded transitions if a client disconnects and never retries.

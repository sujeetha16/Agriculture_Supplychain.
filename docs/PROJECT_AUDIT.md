# Project Audit & Baseline Report: Agriculture Supply Chain

**System Title:** Agriculture Supply Chain — Cloud-Deployed, Blockchain-Enabled Agricultural Product Traceability  
**Repository:** [https://github.com/sujeetha16/Agriculture_Supplychain](https://github.com/sujeetha16/Agriculture_Supplychain)  
**Evaluation Target:** College Cloud Computing Course Capstone / Research Systems Evaluation  
**Date of Audit:** October 2026  
**Auditor Roles:** Senior Cloud Solutions Architect, AWS DevOps Engineer, Solidity Smart Contract Auditor, Backend Security Engineer, QA & Research Engineer  

---

## 1. Executive Summary & Baseline Architecture

The system is designed as an agricultural provenance and traceability platform tracking produce batches through four primary lifecycle stakeholders: **Farmer $\rightarrow$ Distributor $\rightarrow$ Retailer $\rightarrow$ Consumer**.

### Current Technology Stack
* **Frontend:** React 18 SPA built with Vite 5, Bootstrap 5, Bootstrap Icons, HTML5-QRCode, Axios, and Ethers.js v6.
* **Backend:** Node.js Express 4 REST API, with Express-Validator and Mongoose 8.
* **Database:** Dual-storage architecture: MongoDB / AWS DocumentDB when `MONGODB_URI` connects successfully, with a local JSON file adapter (`products.json`) as a resilient fallback.
* **Blockchain:** Solidity `0.8.24` (`AgriChain.sol`) compiled via Hardhat 2, targeting Ethereum Sepolia Testnet (`chainId: 11155111`).
* **Cloud Infrastructure:** Single AWS CloudFormation template (`cloudformation-template.yaml`) provisioning S3 static hosting, CloudFront CDN with Origin Access Control (OAC), and IAM AppRunner instance roles.
* **Containerization:** Multi-service `docker-compose.yml` defining `mongodb`, `backend`, and `frontend` services with Dockerfiles.

---

## 2. Existing Strengths

1. **Clean Product Lifecycle Workflow:** The business domain model in [`AgriChain.sol`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/blockchain/contracts/AgriChain.sol#L14-L21) and [`backend/routes/products.js`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/routes/products.js#L214-L220) enforces a clear sequential state machine (`Created` $\rightarrow$ `DispatchedToDistributor` $\rightarrow$ `ReceivedByDistributor` $\rightarrow$ `DispatchedToRetailer` $\rightarrow$ `ReceivedByRetailer` $\rightarrow$ `SoldToConsumer`).
2. **Dual-Mode Blockchain UI Design:** The frontend accommodates both non-crypto evaluators (via simulated Demo Personas) and live Web3 testers (via MetaMask and ethers.js BrowserProvider).
3. **Structured CloudFormation Template:** Uses AWS best practices for S3 (AES-256 server-side encryption, Block Public Access enabled) and CloudFront OAC rather than legacy public S3 bucket policies.
4. **Fast Frontend Build:** Vite bundling completes cleanly in ~16s with zero syntax or compilation errors.

---

## 3. Prioritized Vulnerabilities & Deficiencies

### CRITICAL (Rank 1 - Immediate Security & Correctness Hazards)

1. **Production Authentication Bypass & Pseudo-Tokens:**
   * **Location:** [`backend/routes/auth.js:108-119`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/routes/auth.js#L108-L119) & [`backend/routes/auth.js:162`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/routes/auth.js#L162)
   * **Issue:** 
     1. Supplying `{ role: 1 }` in `POST /api/auth/login` logs in immediately as Farmer without any password verification.
     2. Tokens are unverified timestamps (`token-${user.username}-${Date.now()}`) instead of cryptographically signed JWTs.
     3. Products routes ([`backend/routes/products.js`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/routes/products.js)) have **no authentication middleware whatsoever**. Anyone can create products or dispatch batches by forging an `actorAddress` parameter without an active session.
2. **Plaintext Passwords & Credential Leakage in Error Responses:**
   * **Location:** [`backend/routes/auth.js:153-157`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/routes/auth.js#L153-L157)
   * **Issue:** Failed password attempts return an HTTP 401 response explicitly disclosing the valid password:
     `message: "Invalid password for @farmer. Use 'Farmer@123'"`.
     Passwords in `USERS` are stored in plaintext without bcrypt/Argon2id hashing.
3. **Absence of Server-Side Cryptographic Blockchain Receipt Verification:**
   * **Location:** [`backend/routes/products.js:147`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/routes/products.js#L147) & [`backend/routes/products.js:263`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/routes/products.js#L263)
   * **Issue:** The API only validates that `txHash` matches `/^0x[a-fA-F0-9]{64}$/`. Any randomly generated hex string is accepted and saved as proof of on-chain record without querying an Ethereum RPC node to verify the transaction receipt, contract status, or emitted event.
4. **Silent Database Fallback in Production:**
   * **Location:** [`backend/config/db.js:17-24`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/config/db.js#L17-L24)
   * **Issue:** When `MONGODB_URI` connection fails, the system logs a warning and falls back to writing local JSON files (`products.json`). In a multi-instance cloud environment (e.g., AWS App Runner or ECS), local file writes cause catastrophic state desynchronization and data loss across ephemeral container restarts.

---

### HIGH (Rank 2 - Architectural & Cloud Reliability Gaps)

1. **Incomplete Backend Deployment Infrastructure in CloudFormation:**
   * **Location:** [`aws/cloudformation-template.yaml:108-135`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/aws/cloudformation-template.yaml#L108-L135)
   * **Issue:** The CloudFormation template defines S3, CloudFront, and an IAM instance role, but **does not declare the compute resource** (such as AWS App Runner Service or ECS Task Definition + Service) to host the Express API container.
2. **No Persistent User Storage Model in MongoDB:**
   * **Location:** [`backend/models/`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/models)
   * **Issue:** Only `Product.js` exists. Users registered via `POST /api/auth/register` are only kept in a runtime in-memory array (`USERS`) in `auth.js`, causing user registrations to vanish upon server restart.
3. **No Automated Smart Contract Test Suite:**
   * **Location:** [`blockchain/test/`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/blockchain)
   * **Issue:** No test files exist in the blockchain directory. The state machine in `AgriChain.sol` has zero automated unit tests for negative test cases (replayed actions, unauthorized roles, invalid status transitions).
4. **Missing Rate Limiting & Abuse Protection:**
   * **Location:** [`backend/server.js`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/server.js)
   * **Issue:** Authentication endpoints have no rate limiting, exposing the system to credential stuffing and brute-force attacks.

---

### MEDIUM (Rank 3 - Operational & Verification Flaws)

1. **Wildcard CORS Configuration:**
   * **Location:** [`backend/server.js:15-23`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/server.js#L15-L23)
   * **Issue:** `origin: (origin, callback) => callback(null, true)` allows requests from any arbitrary domain, bypassing origin isolation.
2. **Missing Backend Unit/Integration Tests:**
   * **Location:** [`backend/package.json`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/package.json)
   * **Issue:** No test script or test runner (`jest`, `supertest`) is configured.
3. **No Structured Correlation IDs or CloudWatch Logging:**
   * **Location:** [`backend/server.js`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/server.js)
   * **Issue:** Requests do not generate correlation/request IDs (`x-request-id`), making distributed troubleshooting across CloudFront and App Runner difficult.

---

### LOW (Rank 4 - Polish & Minor Ergonomics)

1. **Vite Bundle Size Warning:**
   * Single vendor JS chunk is 950 kB (exceeds recommended 500 kB). Dynamic import/code-splitting can optimize client initial load time.
2. **Documentation Inconsistencies:**
   * Claiming live AWS deployment status in README when only local and template configurations have been drafted.

---

## 4. Component Verification Baseline Table

| Component | Status | Verification Method |
| :--- | :--- | :--- |
| **Frontend Build** | **VERIFIED** | Ran `npm run build` with Vite; built 279 modules successfully into `dist/`. |
| **Frontend Static Typing / Lints** | **PARTIAL** | Builds clean, but some chunk size warnings exist. |
| **Backend API Startup** | **VERIFIED** | Starts on Node 24; health endpoint responds. |
| **Backend Security & Auth** | **FAILED** | Fails security requirements (unverified pseudo-tokens, no route authorization, plaintext passwords). |
| **Backend Persistence** | **PARTIAL** | MongoDB works if available; silent fallback in production violates production-grade standards. |
| **Smart Contract Syntax** | **VERIFIED** | Valid Solidity 0.8.24 code. |
| **Smart Contract Automated Tests** | **NOT IMPLEMENTED** | Zero test files in `blockchain/test/`. |
| **CloudFormation Template** | **CONFIGURED** | S3/CloudFront valid, but compute service missing. |
| **AWS Live Deployment** | **NOT DEPLOYED** | No live cloud credentials or resources provisioned. |
| **Reproducible Load Testing** | **NOT IMPLEMENTED** | No k6 / load test scripts or experiment directory. |

---

## 5. Upgrade Action Plan (Phased Roadmap)

* **Phase 2 & 5 (Backend Security & Auth):** Introduce `bcryptjs` and `jsonwebtoken`, create `User` Mongoose model with persistence, add JWT middleware (`auth.js`), protect `products.js` with role validation, add express-rate-limit, and sanitize error messages.
* **Phase 4 & 6 (Blockchain Correctness & Testing):** Create Hardhat test suite in `blockchain/test/AgriChain.test.js`, add server-side receipt/event verification helper with public RPC fallback, clearly flag SIMULATED vs CONFIRMED statuses.
* **Phase 2 & 7 (Cloud Computing Architecture):** Upgrade `cloudformation-template.yaml` to include AWS App Runner Service specification, CloudWatch Log Groups, and alarms. Add request correlation ID middleware.
* **Phase 8 & 9 (Performance & Research):** Build `experiments/` harness with reproducible load testing scripts and `research/RESEARCH_PLAN.md`.

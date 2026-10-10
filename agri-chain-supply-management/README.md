# Agriculture Supply Chain — Cloud-Deployed, Blockchain-Enabled Agricultural Product Traceability

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg)](https://vitejs.dev/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22-yellow.svg)](https://hardhat.org/)
[![AWS CloudFormation](https://img.shields.io/badge/AWS-CloudFormation-orange.svg)](https://aws.amazon.com/cloudformation/)
[![Tests](https://img.shields.io/badge/Tests-39%20Passing-brightgreen.svg)]()

A cloud-native agricultural provenance, cold-chain logistics, and traceability platform engineered for a **College Cloud Computing Course Capstone** and **Applied Systems Research Evaluation**. Combines containerized Express microservices on AWS App Runner, high-performance edge delivery via Amazon CloudFront (with Origin Access Control), resilient database persistence, and decentralized Ethereum Sepolia smart-contract verification.

---

## 1. System Implementation & Deployment Status Matrix

To maintain rigorous academic and engineering honesty, this table documents the verified status of all system components:

| Component | Status | Implementation Details & Evidence |
| :--- | :--- | :--- |
| **Frontend SPA** | **VERIFIED & BUILT** | React 18, Vite 5, Bootstrap 5. 279 modules build cleanly into `dist/`. |
| **Backend REST API** | **VERIFIED & TESTED** | Express 4, correlation IDs (`x-request-id`), structured CloudWatch logs, health checks. |
| **Authentication & Security** | **HARDENED & TESTED** | Passwords hashed with **bcrypt**; strong production **JWT_SECRET** validation; SIWE **wallet challenge-response signature verification**; origin-restricted CORS allowlists. |
| **Supply Chain State Machine**| **VERIFIED & TESTED** | Linear 5-state lifecycle (Created $\rightarrow$ Dispatched $\rightarrow$ Received $\rightarrow$ Dispatched $\rightarrow$ Received $\rightarrow$ Sold) enforced on API and contract. |
| **Smart Contract (`AgriChain.sol`)** | **AUDITED & TESTED** | Solidity 0.8.24; **12/12 automated Hardhat unit tests passing** (access control, role registry, negative security). |
| **Blockchain Receipt Verifier** | **IMPLEMENTED & TESTED** | Strict ABI event log decoding with ethers v6: destination contract check, expected event match, product ID match, actor identity checks, and anti-replay guards. |
| **AWS CloudFormation IaC** | **CONFIGURED & VALIDATED** | `aws/cloudformation-template.yaml` declares S3, CloudFront OAC, App Runner, IAM execution roles, SNS topics, and CloudWatch 5xx Alarms. |
| **AWS Live Cloud Deployment** | **PREPARED (PENDING RUN)** | Template ready for deployment; no billable cloud resources created without user approval. |
| **Empirical Load Harness** | **BENCHMARKED (LOCAL)** | Zero-dependency local micro-benchmark (`load_test_native.js`): loopback API throughput, p50/p95 latency metrics, remote endpoint safety guards. |

---

## 2. Cloud Computing Architecture

```
                                  [ Consumers, Farmers, Distributors, Retailers ]
                                             │                         │
                        1. Web App (HTTPS)   │                         │ 2. Direct API Calls (HTTPS /api/*)
                                             ▼                         ▼
                                 [ Amazon CloudFront CDN ]    [ AWS App Runner Service ]
                               (Global Edge SSL, OAC via S3)  (Node.js 20 Express Container)
                                             │                         │
                                             ▼                         │ (Origin-Restricted CORS)
                                   [ Amazon S3 Bucket ]                │
                              (Private Encrypted React SPA)            │
                                                                       │
                                       ┌───────────────────────────────┴───────────────────────────────┐
                                       ▼                                                               ▼
                            [ Persistence Tier ]                                            [ Consensus Ledger ]
                   ┌───────────────────────────────────┐                           ┌───────────────────────────────────┐
                   │   MongoDB Atlas / AWS DocumentDB  │                           │   Ethereum Sepolia Smart Contract │
                   │   (External TLS Managed Cluster)  │                           │   (0xB601FDccec475b61B8Bc9f3661eC)│
                   └───────────────────────────────────┘                           └───────────────────────────────────┘
```

### Architectural Pillars:
* **Edge Delivery with Origin Access Control (OAC):** Amazon S3 is 100% private (`BlockPublicAccess: true`). Traffic is served exclusively through CloudFront edge POPs using SigV4 signed requests.
* **Managed Container Compute:** The backend runs in an AWS App Runner container with automated health probes (`/api/health`), port 5000 binding, and CloudWatch metrics.
* **Separation of Concerns:**
  * **Off-Chain Data:** Operational logs, harvest certificates, and batch descriptions are stored in MongoDB.
  * **On-Chain Proof:** Custody handovers, actor addresses, and immutable timestamps are recorded on Ethereum Sepolia.
* **Observability:** Structured JSON logging with request correlation IDs (`x-request-id`) and CloudWatch metric alarms for 5xx errors.

---

## 3. Technology Stack

* **Frontend:** React 18, Vite 5, React Router 6, Bootstrap 5, Bootstrap Icons, HTML5-QRCode, Ethers.js v6.
* **Backend:** Node.js 20+, Express 4, Mongoose 8, jsonwebtoken, bcryptjs, express-rate-limit, express-validator.
* **Blockchain:** Solidity 0.8.24, Hardhat 2.22, ethers.js, OpenZeppelin-compatible patterns.
* **Infrastructure:** AWS CloudFormation, Amazon S3, Amazon CloudFront, AWS App Runner, Amazon CloudWatch, Docker.

---

## 4. Local Development Quickstart

### Prerequisites
* Node.js v20+ and npm 10+
* Git

### Step 1: Install Dependencies
```bash
# Backend dependencies
cd agri-chain-supply-management/backend
npm install

# Frontend dependencies
cd ../frontend
npm install

# Blockchain dependencies
cd ../blockchain
npm install
cd ../..
```

### Step 2: Start Backend Server
```bash
cd agri-chain-supply-management/backend
npm run dev
# API runs on http://localhost:5000
# Health check: http://localhost:5000/api/health
```

### Step 3: Start Frontend SPA
```bash
cd agri-chain-supply-management/frontend
npm run dev
# Frontend runs on http://localhost:5173
```

---

## 5. Automated Testing & Verification

### Run Smart Contract Suite (12 Tests)
```bash
cd agri-chain-supply-management/blockchain
npx hardhat test
```
*Tests role registration, product creation, sequential Farmer $\rightarrow$ Distributor $\rightarrow$ Retailer $\rightarrow$ Consumer transitions, and negative access control attacks.*

### Run Backend API & Security Suite (27 Tests)
```bash
cd agri-chain-supply-management/backend
npm test
```
*Executes all 27 automated tests across two comprehensive suites:*
* *`auth_and_lifecycle.test.js` (12 tests): `/api/health`, registration validation, password hashing, JWT authentication, role enforcement, duplicate prevention, and lifecycle state transitions.*
* *`blockchain_verification.test.js` (15 tests): Contract address validation, event log ABI decoding, product ID matching, stakeholder identity verification, reverted tx blocking, pending tx handling, unverified state blocking DB, duplicate tx prevention, and SIWE wallet challenge verification.*

### Run Empirical Performance Load Test
```bash
# Benchmark local API with 10 virtual users across 100 requests (Local loopback smoke test)
node experiments/load_test_native.js --url http://localhost:5000 --users 10 --requests 100
```

---

## 6. Pre-Configured Demonstration Stakeholders

For academic review, the system includes pre-configured credentials (passwords hashed via bcrypt with local fallback):

| Role | Username | Password | Organization | Wallet Address |
| :--- | :--- | :--- | :--- | :--- |
| **Farmer** | `farmer` | `Farmer@123` | Green Valley Organic Farms | `0x90f79bf6eb2c4f870365e785982e1f101e93b906` |
| **Distributor**| `distributor`| `Distributor@123`| Pacific Cold-Chain Logistics | `0x15d34aaf54267db7d7c367839aaf71a00a2c6a65` |
| **Retailer** | `retailer` | `Retailer@123` | FreshMarket Supermarket #104 | `0x9965507d1a55bcc2695c58ba16fb37d819b0a4df` |
| **Consumer** | `consumer` | `Consumer@123` | Verified Consumer Member | `0x70997970c51812dc3a010c7d01b50e0d17dc79c8` |

---

## 7. AWS Cloud Deployment Instructions

Deploying to live AWS infrastructure requires the AWS CLI configured with administrator permissions:

```bash
# 1. Build and push backend container to Amazon ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
docker build -t agri-chain-backend:latest ./agri-chain-supply-management/backend
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/agri-chain-backend:latest

# 2. Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file agri-chain-supply-management/aws/cloudformation-template.yaml \
  --stack-name agriculture-supply-chain-prod \
  --parameter-overrides \
      ProjectName="agri-chain" \
      Environment="production" \
      BackendImageIdentifier="<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/agri-chain-backend:latest" \
  --capabilities CAPABILITY_NAMED_IAM

# 3. Build & sync frontend assets to S3
npm run build --prefix ./agri-chain-supply-management/frontend
aws s3 sync ./agri-chain-supply-management/frontend/dist s3://<S3_BUCKET_NAME>/ --delete
aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```
*(For complete operational instructions, see [`docs/DEPLOYMENT_GUIDE.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/docs/DEPLOYMENT_GUIDE.md)).*

---

## 8. Physical & Cryptographic Limitations (Academic Transparency)

1. **The Agricultural Oracle Problem:** Blockchain immutability guarantees that once data is written, it cannot be tampered with or deleted. However, it cannot physically prove that the farmer entered truthful crop varieties at harvest time.
2. **Sensor Hardware Attestation:** In the current prototype, cold-chain temperature readings are operator-entered or simulated. Production deployment requires hardware secure elements (e.g. TPM / ATECC608A) physically bound to refrigeration units.
3. **Testnet Economic Security:** Sepolia testnet validators operate without financial stakes. Production deployment requires mainnet or an Ethereum Layer 2 rollup (e.g. Arbitrum, Optimism).

---

## 9. Comprehensive Documentation Index

* [`docs/PROJECT_AUDIT.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/docs/PROJECT_AUDIT.md) — Baseline architecture audit, vulnerabilities, and resolution report.
* [`docs/CLOUD_ARCHITECTURE.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/docs/CLOUD_ARCHITECTURE.md) — Complete AWS cloud architecture, S3/CloudFront OAC, App Runner, and cost model.
* [`docs/DEPLOYMENT_GUIDE.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/docs/DEPLOYMENT_GUIDE.md) — Step-by-step AWS provisioning and teardown guide.
* [`docs/SECURITY.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/docs/SECURITY.md) — Threat model, password hashing, JWTs, role authorization, and API hardening.
* [`docs/BLOCKCHAIN_ARCHITECTURE.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/docs/BLOCKCHAIN_ARCHITECTURE.md) — Smart contract state machine, gas optimization, and storage boundaries.
* [`docs/BLOCKCHAIN_TESTING.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/docs/BLOCKCHAIN_TESTING.md) — Hardhat testing report with test counts and reproduction steps.
* [`docs/TEST_REPORT.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/docs/TEST_REPORT.md) — Comprehensive test execution logs and benchmark results.
* [`experiments/README.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/experiments/README.md) — Load testing methodology and workload definitions.
* [`research/RESEARCH_PLAN.md`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/research/RESEARCH_PLAN.md) — Academic research plan, research questions (RQs), and bibliography.

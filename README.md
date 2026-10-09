# Agriculture Supply Chain — Enterprise Provenance & Cloud Computing Platform

A production-grade agricultural provenance, cold-chain logistics, and inventory management platform engineered for university **Cloud Computing Project Review**. Combines modern containerized microservices, high-performance edge content delivery, resilient database persistence, and decentralized smart contract verification.

---

## 1. System Architecture

```
                                  [ Consumers, Farmers, Distributors, Retailers ]
                                                         │
                                                         ▼
                                            [ Amazon CloudFront CDN ]
                                            (Global Edge SSL, OAC, Caching)
                                                         │
                                        ┌────────────────┴────────────────┐
                                        │ Path: /*                        │ Path: /api/*
                                        ▼                                 ▼
                               [ Amazon S3 Bucket ]              [ Application Load Balancer ]
                             (Static Vite React SPA)               (or AWS App Runner Edge)
                                                                          │
                                                                          ▼
                                                                 [ Backend Compute ]
                                                        ┌───────────────────────────────────┐
                                                        │ AWS App Runner / Amazon EC2 (t4g) │
                                                        │     (Node.js Express Container)   │
                                                        └───────────────────────────────────┘
                                                                          │
                                                                          ▼
                                                                [ Persistence Layer ]
                                                        ┌───────────────────────────────────┐
                                                        │   MongoDB Atlas / AWS DocumentDB  │
                                                        │    + Resilient Local Datastore    │
                                                        └───────────────────────────────────┘
                                                                          │
                                                               [ Consensus Ledger ]
                                                        ┌───────────────────────────────────┐
                                                        │   Ethereum Sepolia Smart Contract │
                                                        │   (0xB601FDccec475b61B8Bc9f3661eC)│
                                                        └───────────────────────────────────┘
```

### Architectural Highlights
- **Universal Dual-Mode Execution**:
  - **Live Blockchain Mode**: Executes and verifies real cryptographic transactions on Ethereum Sepolia testnet via MetaMask.
  - **Zero-Friction Presentation Simulator**: Enables instant evaluation of all 4 supply chain roles (Farmer, Distributor, Retailer, Consumer) with 1 click, without requiring browser wallet extensions or faucet ETH.
- **Resilient Datastore Engine**: Connects to cloud MongoDB / AWS DocumentDB when configured, and automatically enables a high-reliability local embedded store if an external database daemon is absent.
- **Universal Public RPC Fallback**: Mobile consumers scanning QR codes on smartphones can inspect and verify on-chain records even if MetaMask is not installed.

---

## 2. Agricultural Supply Chain Finite State Machine

The platform enforces strict linear custody handoffs:

$$\text{1. Created (Farm)} \longrightarrow \text{2. Dispatched to Distributor} \longrightarrow \text{3. Received by Distributor} \longrightarrow \text{4. Dispatched to Retailer} \longrightarrow \text{5. Received by Retailer} \longrightarrow \text{6. Sold to Consumer}$$

| Supply Chain Role | Responsibilities & Capabilities |
| :--- | :--- |
| **1. Origin Farmer** | Registers crop batches, harvest timestamps, agronomic quality grades (Brix, moisture), temperature parameters, and certifications (USDA Organic, GlobalG.A.P.). |
| **2. Cold-Chain Distributor** | Receives shipments from farms, logs refrigerated container storage telemetry (e.g. 3.5°C, 85% RH), and fulfills distribution routing to regional supermarket hubs. |
| **3. Supermarket Retailer** | Receives stock into retail inventory, validates unbroken cold-chain credentials, and records point-of-sale customer checkouts. |
| **4. Consumer** | Scans QR codes on product packaging to view the immutable timeline from soil to store shelf. |

---

## 3. AWS Cloud Architecture & Infrastructure Specification

### Role of Selected AWS Services

1. **Amazon CloudFront**:
   - Acts as the global HTTPS entrypoint with edge TLS termination.
   - Implements custom error response mappings (`404 -> /index.html` with status `200`) required for Single-Page Application (SPA) client-side routing.
   - Enforces Origin Access Control (OAC), ensuring that the backing Amazon S3 bucket is shielded from unauthorized direct internet access.

2. **Amazon S3 (Simple Storage Service)**:
   - Stores the compiled, minified static frontend assets (`dist/`: HTML, CSS, JavaScript chunks, SVGs).
   - Configured with `BlockPublicAcls: true` and `BlockPublicPolicy: true`. All traffic must originate through CloudFront.

3. **AWS App Runner / Amazon EC2 (`t4g.micro` / `t3.micro`)**:
   - Executes the multi-stage Node.js 20 production container defined in `backend/Dockerfile`.
   - Automatically probes `/api/health` for container lifecycle management.
   - Provides horizontal concurrency scaling and pauses compute during idle intervals.

4. **Amazon DocumentDB / MongoDB Atlas on AWS**:
   - Manages BSON document collections for product catalogs, history events, and supply-chain metrics.
   - Deployed within a dedicated VPC with automated snapshots and encryption at rest (AES-256).

5. **AWS Identity & Access Management (IAM)**:
   - Implements least-privilege roles (`AppRunnerServiceRole`, `S3DeployRole`) avoiding persistent master credentials on hosts.

6. **Amazon CloudWatch**:
   - Captures container logs (`/aws/agriculture-supply-chain/*`), tracks request throughput, and sets alarms on 5xx status spikes.

### Cost-Conscious Deployment Strategy (AWS Free Tier Roadmap)

| Service | Allocation Under Free Tier | Monthly Cost |
| :--- | :--- | :--- |
| **Amazon CloudFront** | 1 TB Outbound Data Transfer + 10,000,000 HTTP Requests | **$0.00** |
| **Amazon S3** | 5 GB Standard Storage + 20,000 GET Requests | **$0.00** |
| **AWS App Runner / EC2** | 750 hours/month on `t4g.micro` or `t3.micro` instance | **$0.00** |
| **MongoDB Atlas** | M0 Free Shared Cluster on AWS (512 MB storage) | **$0.00** |
| **AWS IAM & CloudWatch** | Core IAM free; 5 GB ingestion & 10 custom metrics free | **$0.00** |
| **Total Estimated Run Rate** | **100% Free Tier Compliant** | **$0.00 / month** |

---

## 4. Repository Structure

```text
Agriculture_Supplychain/
├── agri-chain-supply-management/
│   ├── aws/
│   │   └── cloudformation-template.yaml   # AWS Infrastructure-as-Code template
│   ├── backend/
│   │   ├── config/db.js                   # Resilient dual-mode database connector
│   │   ├── data/                          # Default seed catalog & local store
│   │   ├── middleware/                    # Error handling & 404 middlewares
│   │   ├── models/Product.js              # Agricultural schema & resilient proxy
│   │   ├── routes/products.js             # REST API routes & KPI analytics
│   │   ├── Dockerfile                     # Multi-stage production container
│   │   ├── package.json
│   │   └── server.js                      # Express HTTP entrypoint & health probe
│   ├── blockchain/
│   │   ├── contracts/AgriChain.sol        # Solidity smart contract
│   │   ├── scripts/deploy.js              # Hardhat deployment script
│   │   ├── hardhat.config.js
│   │   └── package.json
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/                # Layout, ProductCard, Timeline, QR
│   │   │   ├── context/WalletContext.jsx  # Dual MetaMask & Persona Simulator
│   │   │   ├── pages/                     # Dashboard, Trace, AddBatch, CloudArch
│   │   │   ├── services/                  # API client & universal blockchain RPC
│   │   │   ├── styles.css                 # Comprehensive agricultural design tokens
│   │   │   └── App.jsx
│   │   ├── Dockerfile                     # Multi-stage NGINX production container
│   │   ├── nginx.conf                     # Production SPA routing & gzip configuration
│   │   ├── index.html
│   │   └── package.json
│   ├── docker-compose.yml                 # Local container orchestrator
│   └── README.md
```

---

## 5. Local Setup & Quickstart

### Prerequisites
- Node.js 18+ (Node.js 20 LTS or Node 24 recommended)
- Git

### Option A: Zero-Config Instant Launch (No external MongoDB or MetaMask required)

1. **Start Backend API**:
   ```bash
   cd agri-chain-supply-management/backend
   npm install
   node server.js
   ```
   *The backend starts at `http://localhost:5000` with the embedded agricultural catalog activated.*

2. **Start Frontend Client**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
   *Open `http://localhost:5173` in your browser.*

### Option B: Docker Compose (All services containerized)

```bash
cd agri-chain-supply-management
docker compose up --build
```
- Frontend available at: `http://localhost:8080`
- Backend API available at: `http://localhost:5000`
- MongoDB daemon running on: `localhost:27017`

---

## 6. Faculty Demonstration Walkthrough (10-Minute Script)

1. **Step 1: Executive Overview (`/dashboard`)**:
   - View real-time KPI metrics: *Total Tracked Batches*, *In-Transit Batches*, *Completed Provenance*, *Origin Farm Batches*.
   - Inspect the interactive *Crop Category Distribution* and *Supply Chain Stage Breakdown* charts.
   - Use the real-time search box and category dropdown filters.

2. **Step 2: Interactive Role Simulation**:
   - Observe the top persona bar: `Farmer`, `Distributor`, `Retailer`, `Consumer`.
   - Switch personas with 1 click to demonstrate custody handoffs without switching MetaMask accounts.

3. **Step 3: Register a New Crop Batch (`/farmer/add`)**:
   - Register a batch with agricultural attributes: Crop Category, Harvest Date, Origin Farm Location, Storage Conditions, Certifications, and Quality Grade.
   - Click **Register & Tokenize Batch**. The system commits the genesis record to the ledger.

4. **Step 4: Advance the Custody Lifecycle (`/product/:id`)**:
   - Switch persona to **Distributor** ➔ Click **Acknowledge Receipt from Farmer**.
   - Input destination retailer address ➔ Click **Dispatch to Retail Store**.
   - Switch persona to **Retailer** ➔ Click **Receive & Stock on Shelf**.
   - Input consumer address ➔ Click **Record Sale to Consumer**.
   - Watch the 6-stage interactive timeline update in real-time.

5. **Step 5: Consumer Provenance Verification (`/trace/:id` & `/scan`)**:
   - Open batch `#101` (Organic Honeycrisp Apples).
   - Observe the dual cryptographic verification check: backend database record verified against the Ethereum Sepolia smart contract.
   - Download the optical QR badge or test optical camera scanning at `/scan`.

6. **Step 6: Cloud Architecture Review (`/cloud-architecture`)**:
   - Review the AWS cloud topology diagram.
   - Click **Test Health Probe** to demonstrate live round-trip latency to the `/api/health` microservice.
   - Review the cost-conscious deployment analysis and security architecture.

---

## 7. AWS Cloud Deployment Step-by-Step

### 1. Build and Deploy Static Frontend to Amazon S3 + CloudFront

1. Compile the production bundle:
   ```bash
   cd agri-chain-supply-management/frontend
   npm run build
   ```

2. Deploy using the AWS CloudFormation template:
   ```bash
   aws cloudformation create-stack \
     --stack-name agriculture-supply-chain-stack \
     --template-body file://agri-chain-supply-management/aws/cloudformation-template.yaml \
     --parameters ParameterKey=ProjectName,ParameterValue=agriculture-supply-chain \
     --capabilities CAPABILITY_IAM
   ```

3. Sync the compiled `dist/` directory to the created S3 bucket:
   ```bash
   aws s3 sync agri-chain-supply-management/frontend/dist/ s3://agriculture-supply-chain-frontend-<ACCOUNT_ID>-<REGION> --delete
   ```

4. Invalidate the CloudFront edge cache:
   ```bash
   aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
   ```

### 2. Deploy Containerized Backend to AWS App Runner

1. Build and push container to Amazon ECR:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
   docker build -t agriculture-supply-chain-api ./agri-chain-supply-management/backend
   docker tag agriculture-supply-chain-api:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/agriculture-supply-chain-api:latest
   docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/agriculture-supply-chain-api:latest
   ```

2. Create App Runner service pointing to the container image with environment variables:
   - `PORT=5000`
   - `NODE_ENV=production`
   - `MONGODB_URI=<YOUR_MONGODB_ATLAS_URI>`
   - `FRONTEND_URL=https://<YOUR_CLOUDFRONT_DOMAIN>.cloudfront.net`

---

## 8. Smart Contract Reference

- **Contract Source**: `agri-chain-supply-management/blockchain/contracts/AgriChain.sol`
- **Compiler**: Solidity `0.8.24`
- **Network**: Ethereum Sepolia Testnet
- **Deployed Address**: `0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D`
- **Block Explorer**: [https://sepolia.etherscan.io/address/0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D](https://sepolia.etherscan.io/address/0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D)

---

## 9. Security & Governance

- **Zero Hardcoded Secrets**: No private keys or database passwords committed to Git.
- **Role-Based Finite State Machine**: State transitions can only be triggered by the wallet assigned to the corresponding supply chain role.
- **Input Sanitization**: Express Validator strictly enforces Ethereum address regex patterns (`^0x[a-fA-F0-9]{40}$`) and ISO date formatting (`^\d{4}-\d{2}-\d{2}$`).
- **Cloud Perimeter Security**: Amazon S3 public access is blocked; all web requests are routed through CloudFront with HTTPS enforcement and security headers (HSTS, X-Content-Type-Options, Referrer-Policy).

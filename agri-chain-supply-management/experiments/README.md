# Empirical Performance & Scalability Experimentation Guide

**System Under Test:** Agriculture Supply Chain Cloud API & Blockchain Verification System  
**Evaluation Scope:** College Cloud Computing Course & Applied Systems Research  
**Workload Profiles:** Read Heavy (Provenance Queries), Write Heavy (Batch Lifecycle State Machine), and Blockchain Verification Overhead.

---

## 1. Experimental Objectives

1. **API Scalability & Latency Distribution:** Quantify HTTP latency (p50, p90, p95, p99) and throughput (requests/sec) as concurrent virtual users increase from 10 to 100.
2. **Measurement Boundary Separation:**
   * **Boundary A (Off-Chain API Latency):** Time elapsed between client HTTP request dispatch and backend persistent response.
   * **Boundary B (Blockchain RPC Delay):** Time spent querying and parsing Ethereum JSON-RPC receipts.
   * **Boundary C (On-Chain Consensus Mined Time):** Time elapsed between wallet signing/broadcast and block inclusion on Ethereum Sepolia.
3. **Graceful Degradation:** Evaluate system resilience and error rate under database connection constraints or rate limiting thresholds.

---

## 2. Benchmark Tooling & Harness Options

### Option A: Native Node.js High-Concurrency Benchmark Harness (Zero-Dependency)
No external tools or k6 installation required. Uses Node.js asynchronous event loop and `fetch`:
```bash
# Run 50 concurrent virtual users across 1000 requests against local or cloud API
node experiments/load_test_native.js --url http://localhost:5000 --users 50 --requests 1000
```

### Option B: Grafana k6 Load Test Script
If [k6](https://k6.io/) is installed on your testing machine:
```bash
k6 run --vus 25 --duration 30s experiments/load_test_k6.js
```

---

## 3. Workload Definitions

| Scenario | Target Endpoint | HTTP Method | Payload / Headers | Focus Metric |
| :--- | :--- | :--- | :--- | :--- |
| **Health Liveness** | `/api/health` | GET | None | Base HTTP overhead, container responsiveness |
| **Catalog Listing** | `/api/products` | GET | None | Datastore query latency & pagination |
| **Traceability Query** | `/api/products/101` | GET | None | Single-document cache & retrieval |
| **Receipt Verification** | `/api/products/101/verify` | GET | None | Sepolia RPC network turnaround |
| **Lifecycle State Write** | `/api/products/101/dispatch-distributor` | POST | JSON + JWT Bearer | Auth verification, role checks, and atomic state mutation |

---

## 4. Hardware & Environment Logging Requirements

When recording experimental runs for course evaluation or research paper submission, record the test environment configuration:
* **Host Machine:** CPU core count, clock frequency, RAM capacity, OS version.
* **Network Context:** Localhost (same-machine baseline) vs. CloudFront CDN URL vs. App Runner Service URL.
* **Database Engine:** MongoDB 7.0 container vs. MongoDB Atlas AWS replica set vs. AWS DocumentDB.
* **Repetition Protocol:** Minimum 3 runs per concurrency level. Record mean and standard deviation.

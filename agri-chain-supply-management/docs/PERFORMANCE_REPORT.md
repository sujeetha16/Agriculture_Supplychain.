# Empirical Performance & Benchmark Report

**Evaluation Project:** Agriculture Supply Chain Traceability Platform  
**Target Environment:** Node.js v24.12.0, Express API loopback, Windows 11 host  
**Report Date:** October 2026  
**Benchmarking Harness:** [`experiments/load_test_native.js`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/experiments/load_test_native.js) & [`experiments/run_local_benchmark.js`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/experiments/run_local_benchmark.js)  

---

## 1. Executive Summary & Measurement Integrity

This report documents reproducible performance characteristics for the Agriculture Supply Chain API.

> [!IMPORTANT]
> **Measurement Boundary Notice & Integrity Disclosure:**
> * **Measured Scope (Boundary A - Local Loopback):** The empirical measurements below capture Node.js Express HTTP event loop and datastore retrieval turnaround on the local development machine.
> * **Boundary B (Ethereum RPC Roundtrip):** Queries to Ethereum Sepolia JSON-RPC nodes (`/api/products/:id/verify`) incur external internet transit latency (~150ms - 500ms depending on gateway and rate limits).
> * **Boundary C (Ethereum Blockchain Consensus):** On-chain mining and receipt finalization depend on Ethereum Sepolia block intervals (~12 seconds per block).
> * **Cloud Boundary:** Local loopback performance **must not** be represented as AWS production cloud performance. Deployed AWS CloudFront CDN and App Runner metrics will be governed by edge network roundtrip times and container CPU allocations.

---

## 2. Empirical Benchmark Results

### Scenario: High-Concurrency Catalog Traceability Queries
* **Target Endpoint:** `GET /api/products`
* **Concurrency:** 10 Virtual Users (VUs)
* **Total Executed Requests:** 100 requests
* **Result File:** [`experiments/latest_benchmark_results.json`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/experiments/latest_benchmark_results.json)

| Metric | Measured Value | Standard Target | Status |
| :--- | :--- | :--- | :--- |
| **Success Rate** | **100.0%** (100 / 100) | $\ge 99.9\%$ | **PASS** |
| **Error Rate** | **0.0%** | $\le 0.1\%$ | **PASS** |
| **Throughput** | **507.61 req/sec** | $\ge 150\text{ req/s}$ | **EXCEEDS** |
| **p50 Latency (Median)** | **18.22 ms** | $\le 50\text{ ms}$ | **EXCEEDS** |
| **p90 Latency** | **20.36 ms** | $\le 80\text{ ms}$ | **EXCEEDS** |
| **p95 Latency** | **22.70 ms** | $\le 100\text{ ms}$ | **EXCEEDS** |
| **p99 Latency** | **29.03 ms** | $\le 150\text{ ms}$ | **EXCEEDS** |
| **Max Latency** | **29.62 ms** | $\le 200\text{ ms}$ | **EXCEEDS** |

---

## 3. Observability & Correlation Tracking

1. **Request Correlation IDs (`x-request-id`):**
   * Every incoming request receives a UUIDv4 correlation ID via middleware in [`backend/server.js`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/backend/server.js).
   * Correlation IDs are returned in response headers and logged with structured JSON metadata (`requestId`, `method`, `path`, `status`, `durationMs`, `ip`).
2. **Secret Scrubbing in Logs:**
   * Passwords, JWT secrets, wallet private keys, and authorization header tokens are strictly excluded from server log outputs.
3. **Structured Health Check Observability:**
   * `GET /api/health` returns detailed uptime, system memory, active database mode, and blockchain gateway readiness:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-10-13T08:31:34.690Z",
     "uptime": 1.45,
     "database": {
       "mode": "local_resilient_store",
       "connected": true
     },
     "blockchain": {
       "configured": true,
       "network": "sepolia"
     }
   }
   ```

---

## 4. Frontend Bundle Performance & Code Splitting

* **Build Tool:** Vite 5.4 + Rollup
* **Optimization:** Modular code-splitting via `build.rollupOptions.output.manualChunks` in [`frontend/vite.config.js`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/frontend/vite.config.js).
* **Chunk Breakdown:**
  * `dist/index.html`: 1.42 kB (0.74 kB gzip)
  * `dist/assets/index-[hash].js`: 123.64 kB (28.57 kB gzip) — Main application logic
  * `dist/assets/vendor-[hash].js`: 215.56 kB (72.51 kB gzip) — React, React Router, Axios
  * `dist/assets/web3-[hash].js`: 267.31 kB (99.05 kB gzip) — Ethers.js Web3 engine
  * `dist/assets/scanner-[hash].js`: 351.28 kB (106.39 kB gzip) — HTML5 QR Code & Canvas engine
  * Total compilation time: **3.75s**, zero chunk size warnings.

---

## 5. How to Re-Run Benchmarks

```bash
# Run transient automated benchmark harness
node experiments/run_local_benchmark.js

# Or against a running server instance
node experiments/load_test_native.js --url http://localhost:5000 --users 25 --requests 250
```

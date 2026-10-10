# Academic Research Plan & Experimental Design

**Working Title:** Cloud-Deployed Blockchain-Enabled Traceability for Agricultural Supply Chains: Architecture, Integrity Verification, and Performance Evaluation  
**Target Venue:** IEEE / ACM Applied Computing / Computers and Electronics in Agriculture  
**Academic Level:** University Cloud Computing & Distributed Systems Capstone  

---

## 1. Problem Statement & Research Motivation

Modern agricultural supply chains suffer from information fragmentation, opaque custodial handovers, and vulnerable centralized databases susceptible to unilateral tampering. While decentralized blockchains (e.g., Ethereum) offer immutable provenance records, full on-chain storage of agricultural metadata (high-resolution sensor telemetry, harvest certifications, logistical inspection notes) is economically prohibitive due to EVM gas costs.

Conversely, purely off-chain relational or document databases remain vulnerable to insider tampering. This research evaluates a **hybrid dual-boundary architecture**: leveraging AWS cloud infrastructure (CloudFront OAC, App Runner, managed databases) for scalable metadata queries, paired with Ethereum smart contracts (`AgriChain.sol`) for immutable custody validation and server-side cryptographic receipt reconciliation.

---

## 2. Research Questions (RQs)

* **RQ1 (Integrity Verification & Auditability):**  
  *How effectively does a server-side JSON-RPC receipt auditing mechanism detect and flag inconsistencies (e.g. hash spoofing, out-of-order transitions, or reverted state) between off-chain datastores and on-chain EVM ledgers?*
* **RQ2 (Overhead & Gas Cost Analysis):**  
  *What is the empirical transaction confirmation delay and gas overhead incurred by on-chain state machine transitions across each agricultural lifecycle phase (Creation, Dispatches, Receipts, Final Retail Sale)?*
* **RQ3 (Cloud Scalability & Latency Profiles):**  
  *How does request latency (median, p95) and throughput scale in a decoupled CloudFront-AppRunner environment under concurrent virtual user loads ranging from 10 to 100 concurrent provenance lookups?*

---

## 3. Experimental Methodology & Metrics

```
+---------------------------------------------------------------------------------------+
| EXPERIMENTAL MEASUREMENT BOUNDARIES                                                   |
+---------------------------------------------------------------------------------------+
| [Client Browser] ──(T1: Network RTT)──> [CloudFront / App Runner API]                 |
|                                         ├──(T2: DB Query/Write Latency)──> [MongoDB]  |
|                                         └──(T3: JSON-RPC Audit Latency)──> [Sepolia]  |
| [MetaMask Web3]  ──(T4: User Signing)──> (T5: Mempool & Mining)──────────> [Sepolia]  |
+---------------------------------------------------------------------------------------+
```

### Metrics:
1. **API Scalability:** Throughput (req/sec), p50, p90, p95, p99 response times (ms), error rate (%).
2. **Blockchain Overhead:**
   * Gas consumed per transition function (measured via Hardhat execution traces and Sepolia receipts).
   * Block inclusion delay (seconds).
3. **Integrity Detection Rate:** Accuracy in detecting simulated versus mined transactions under automated fuzz testing.

---

## 4. Threat Model & Scientific Threats to Validity

1. **The Agricultural Physical-to-Digital Gap (The Oracle Problem):**  
   *Blockchain immutability guarantees data integrity once written, but cannot prevent false initial entry at the farm gate.*
2. **Sensor Emulation Limitation:**  
   *Temperature readings in this prototype are operator-submitted or simulated. Physical deployments require hardware attestation (e.g. cryptographic secure elements).*
3. **Public Testnet Variability:**  
   *Ethereum Sepolia gas prices and block mining delays vary with public testnet congestion, which must be factored into statistical variance calculations across repeated trials.*

---

## 5. Related Work & Bibliography Template

*(For inclusion in the final paper submission)*

1. **Tian, F. (2016).** *An agri-food supply chain traceability system for China based on RFID & blockchain technology.* In 13th International Conference on Service Systems and Service Management (ICSSSM). IEEE.
2. **Caro, M. P., et al. (2018).** *Blockchain-based traceability in Agri-Food supply chain management: A practical implementation.* In 2018 IoT Vertical and Topical Summit on Agriculture. IEEE.
3. **Lin, Q., et al. (2020).** *Food safety traceability system based on blockchain and EPCIS.* *IEEE Access*, 8, 20698-20707.
4. **Vangala, A., et al. (2021).** *Smart contract-based agricultural supply chain management: A comprehensive survey.* *Computers and Electronics in Agriculture*, 186, 106180.

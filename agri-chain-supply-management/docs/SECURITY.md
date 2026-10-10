# Application & Cloud Security Architecture

**System:** Agriculture Supply Chain Traceability Platform  
**Target:** Production Hardening & Research Security Evaluation  
**Standard References:** OWASP Top 10 API Security, AWS Well-Architected Security Pillar  

---

## 1. Implemented Security Controls

### A. Authentication & Credential Protection
* **Password Hashing:** Passwords are cryptographically hashed using **bcrypt** with a salt work factor of 10 (`bcryptjs`).
* **Safe Error Handling:** Authentication error responses return generic messages (`"Invalid username or password."`). Password disclosure hints in error responses have been removed.
* **Token Architecture:** Replaced insecure timestamp tokens with **signed JSON Web Tokens (JWTs)**:
  * Signed using HMAC SHA-256 with a dedicated `JWT_SECRET`.
  * Standard 24-hour expiration (`exp`), subject claims (`id`, `username`, `role`, `walletAddress`).
  * Tokens are parsed exclusively via the `Authorization: Bearer <token>` header.
* **Brute-Force & Rate Limiting:** Configured `express-rate-limit` restricting IPs to **100 requests per 15-minute window** on `/api/auth/*` endpoints.

### B. Role-Based Authorization & Custody Enforcement
* **Server-Side Enforcement:** Route-level middleware (`requireRole(allowedRoles)`) rejects unauthorized actors with HTTP 403 Forbidden on the backend.
* **Actor Custody Binding:** `requireWalletMatch("actorAddress")` ensures an authenticated user cannot dispatch batches using someone else's Ethereum address.
* **State Machine Guardrails:** Transitions reject skipped states (e.g. attempting to mark as `ReceivedByDistributor` when current status is `Created`).
* **Production Sandbox Isolation:** 1-Click Demo Login (`{ role: 1 }`) is strictly disabled when `NODE_ENV === "production"`.

### C. Network & API Security
* **Origin-Restricted CORS:** Replaced wildcard reflection with explicit allowlists configured via `ALLOWED_ORIGINS` / `FRONTEND_URL`.
* **Request Body Caps:** Enforces a 500 KB JSON body limit (`express.json({ limit: "500kb" })`) to mitigate Denial of Service (DoS) memory exhaustion.
* **Input Sanitization:** Express-validator enforces strict regex patterns on Ethereum addresses (`^0x[a-fA-F0-9]{40}$`), transaction hashes, and ISO dates (`^\d{4}-\d{2}-\d{2}$`).
* **Structured Logging & Header Scrubbing:** Correlation IDs (`x-request-id`) log metadata without recording passwords, tokens, or private keys.

### D. Cloud Infrastructure Security (AWS)
* **S3 Block Public Access:** All four Amazon S3 public access block flags are set to `true`.
* **Origin Access Control (OAC):** CloudFront accesses S3 via SigV4 signed requests. Direct S3 bucket URLs return HTTP 403 Forbidden.
* **Encryption at Rest:** All static assets are encrypted with SSE-AES256.
* **IAM Least Privilege:** App Runner execution roles are restricted to designated CloudWatch log groups and specific ECR repositories.

---

## 2. Threat Model & Trust Assumptions

```
+----------------------------------------------------------------------------------+
| PHYSICAL DOMAIN (FARM & TRANSIT)                                                |
| Farm Harvest --> Physical Transport Truck --> Warehouse Storage --> Retail Shelf |
+----------------------------------------------------------------------------------+
                                        │ (Human/Manual Input Gap)
                                        ▼
+----------------------------------------------------------------------------------+
| CYBER DOMAIN (API & SMART CONTRACT)                                             |
| Backend Express API (Role-Enforced) <===> Ethereum Sepolia Smart Contract        |
+----------------------------------------------------------------------------------+
```

### Critical Limitations to Note for Research & College Review:
1. **The Agricultural Oracle Problem:**
   * A blockchain guarantees that an event once recorded cannot be altered or retroactively deleted.
   * **The blockchain CANNOT prove that the original farmer input was physically truthful.** If a farmer enters "Organic Gala Apples" for conventionally grown produce, the blockchain reliably records a lie.
2. **IoT Sensor Provenance:**
   * In the current implementation, temperature records and storage condition metrics are manually submitted by human operators or simulated for demonstration.
   * There is no hardware cryptographic secure enclave (e.g. TPM or ATECC608A) attesting sensor data at the physical layer.
3. **Testnet Economic Security:**
   * Ethereum Sepolia is a Proof-of-Stake testnet. It does not carry real monetary value, and validators could theoretically reorganize history with zero financial penalty compared to Ethereum mainnet.

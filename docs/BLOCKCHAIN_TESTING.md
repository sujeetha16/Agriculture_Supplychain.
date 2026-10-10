# Smart Contract Automated Testing & Verification Report

**Test Runner:** Hardhat v2.22.17 / Mocha / Chai  
**Contract Under Test:** [`blockchain/contracts/AgriChain.sol`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/blockchain/contracts/AgriChain.sol)  
**Test Suite Path:** [`blockchain/test/AgriChain.test.js`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/blockchain/test/AgriChain.test.js)  
**Execution Date:** October 2026  
**Result Summary:** **12 Passing / 0 Failing (100% Pass Rate)**  

---

## 1. Test Suite Coverage Breakdown

### Section 1: Role Registration & Access Control
| Test Description | Expected Behavior | Observed Result |
| :--- | :--- | :--- |
| `should allow accounts to register legitimate roles` | Role stored in `roles` mapping and emits `RoleRegistered` | **PASS** |
| `should revert if an account attempts to register Role.None` | Reverts with `"Invalid role"` | **PASS** |
| `should revert if an account attempts to register a second role` | Reverts with `"Role already registered"` (Immutable identity) | **PASS** |

### Section 2: Product Creation
| Test Description | Expected Behavior | Observed Result |
| :--- | :--- | :--- |
| `should allow authorized Farmer to create a crop batch` | Assigns ID 1, sets status `Created`, emits `ProductCreated` | **PASS (211ms)** |
| `should prevent non-farmers from creating agricultural products` | Reverts with `"Caller does not have required role"` | **PASS** |
| `should reject product creation with empty name or harvestDate` | Reverts with `"Product name is required"` / `"Harvest date is required"` | **PASS** |

### Section 3: Legitimate Supply-Chain Transition Cycle
| Test Description | Expected Behavior | Observed Result |
| :--- | :--- | :--- |
| `Farmer -> Distributor -> Retailer -> Consumer workflow` | Sequentially transitions through all 5 lifecycle states with correct event arguments | **PASS (235ms)** |

### Section 4: Negative Security & State-Machine Violations
| Test Description | Expected Behavior | Observed Result |
| :--- | :--- | :--- |
| `revert dispatching to non-distributor receiver` | Reverts with `"Receiver is not a distributor"` | **PASS** |
| `revert unauthorized farmer dispatching another's batch` | Reverts with `"Only product farmer can dispatch"` | **PASS** |
| `revert out-of-order transitions` | Distributor cannot receive prior to dispatch; reverts with `"Only assigned distributor can receive"` | **PASS** |
| `revert querying nonexistent products` | Reverts with `"Product does not exist"` | **PASS** |
| `prevent replaying terminal sold state` | Reverts with `"Invalid product status"` | **PASS** |

---

## 2. Exact Terminal Reproduction Command

To reproduce this exact test execution locally:
```bash
cd agri-chain-supply-management/blockchain
npx hardhat test
```

### Verified Terminal Output:
```
  AgriChain Smart Contract Lifecycle & Access Control Suite
    1. Role Registration & Access Control
      √ should allow accounts to register legitimate roles and emit RoleRegistered
      √ should revert if an account attempts to register Role.None
      √ should revert if an account attempts to register a second role (immutable identity)
    2. Product Creation
      √ should allow an authorized Farmer to create a crop batch and emit ProductCreated (211ms)
      √ should prevent non-farmers from creating agricultural products
      √ should reject product creation with empty name or harvestDate
    3. Complete Legitimate Supply-Chain Transition Cycle
      √ should successfully execute Farmer -> Distributor -> Retailer -> Consumer workflow (235ms)
    4. Negative Security & State-Machine Violations
      √ should revert if dispatching to an entity not registered as Distributor
      √ should revert if an unauthorized farmer tries to dispatch another farmer's product
      √ should revert out-of-order transitions (e.g. distributor receiving before dispatch)
      √ should revert when querying nonexistent products
      √ should prevent replaying terminal sold state

  12 passing (8s)
```

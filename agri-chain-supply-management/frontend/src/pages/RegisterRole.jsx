// Path: frontend/src/pages/RegisterRole.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Alert from "../components/Alert";
import TransactionFeedback from "../components/TransactionFeedback";
import { registerRole, ROLE_NAMES, contractAddress, SEPOLIA_CHAIN_ID } from "../services/blockchain";
import { useWallet } from "../context/WalletContext";

const AVAILABLE_ROLES = [
  {
    value: 1,
    name: "Farmer",
    badge: "Origin Producer",
    icon: "bi-person-badge",
    avatar: "👨‍🌾",
    desc: "Harvests crops, tokenizes batches, and dispatches to distributors. Required to execute createProduct().",
    permissions: "Can create new crop batches (createProduct) and dispatch batches to distributors."
  },
  {
    value: 2,
    name: "Distributor",
    badge: "Logistics Hub",
    icon: "bi-truck",
    avatar: "🚚",
    desc: "Oversees cold-chain transport, warehouses batches, and delivers to retail grocery stores.",
    permissions: "Can receive batches from farmers and dispatch batches to retailers."
  },
  {
    value: 3,
    name: "Retailer",
    badge: "Point of Sale",
    icon: "bi-shop",
    avatar: "🏪",
    desc: "Stocks agricultural goods in grocery aisles and records consumer retail sales.",
    permissions: "Can receive batches from distributors and record final sales to consumers."
  },
  {
    value: 4,
    name: "Consumer",
    badge: "End Customer",
    icon: "bi-person-check",
    avatar: "👤",
    desc: "Purchases certified produce, scans QR badges, and inspects farm-of-origin provenance.",
    permissions: "Can receive sold produce tokens and audit end-to-end cryptographic provenance."
  }
];

export default function RegisterRole() {
  const {
    address,
    metaMaskAddress,
    useMetaMaskSigner,
    connectMetaMask,
    chainId,
    isSepolia,
    switchToSepolia,
    onChainRole,
    onChainRoleName,
    loadingOnChainRole,
    refreshOnChainRole,
    isDemoMode,
    switchDemoRole
  } = useWallet();

  const [selectedRole, setSelectedRole] = useState(1);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [confirmedReceipt, setConfirmedReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const navigate = useNavigate();

  // Load / refresh role whenever connected wallet address changes
  useEffect(() => {
    if (metaMaskAddress) {
      refreshOnChainRole(metaMaskAddress);
    }
  }, [metaMaskAddress, chainId]);

  function copyAddress(addr) {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setTxHash("");
    setConfirmedReceipt(null);

    // If user is strictly in Demo Simulation mode without MetaMask
    if (isDemoMode && !window.ethereum) {
      switchDemoRole(selectedRole);
      navigate("/dashboard");
      return;
    }

    // MetaMask is installed
    if (!metaMaskAddress) {
      try {
        await connectMetaMask();
      } catch (connErr) {
        setError(connErr.message || "Failed to connect MetaMask.");
        return;
      }
    }

    if (!isSepolia) {
      try {
        await switchToSepolia();
      } catch (switchErr) {
        setError("Please switch MetaMask network to Ethereum Sepolia (Chain ID 11155111).");
        return;
      }
    }

    // Verify current on-chain state to prevent submitting a reverting tx
    if (onChainRole && onChainRole !== 0) {
      setError(
        `Wallet is already registered on-chain as ${onChainRoleName || `Role ${onChainRole}`}. The AgriChain contract permanently enforces one role per wallet.`
      );
      return;
    }

    try {
      setBusy(true);
      const result = await registerRole(selectedRole);
      setTxHash(result.hash);
      setConfirmedReceipt(result.receipt);

      // Refresh on-chain role state from contract getter
      await refreshOnChainRole(metaMaskAddress || result.address);
    } catch (err) {
      setError(err.message || "Role registration transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  const isAlreadyRegistered = onChainRole !== null && onChainRole !== 0;
  const isFarmer = onChainRole === 1;

  let deployedAddress = "0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D";
  try {
    deployedAddress = contractAddress();
  } catch (_) {}

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-10 col-xl-9">
          {/* Header Card */}
          <div className="agri-card mb-4 shadow-sm border-0">
            <div className="agri-card-header bg-light d-flex flex-wrap align-items-center justify-content-between gap-3 p-4">
              <div>
                <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle mb-2">
                  <i className="bi bi-shield-lock-fill me-1"></i>Access Control & On-Chain Governance
                </span>
                <h3 className="fw-bold mb-1">AgriChain Role Registration</h3>
                <p className="text-secondary small mb-0">
                  Register your Ethereum wallet address on the deployed smart contract access-control list.
                </p>
              </div>

              <div className="d-flex align-items-center gap-2">
                <span className={`badge ${useMetaMaskSigner ? "bg-primary" : "bg-dark"}`}>
                  <i className={`bi ${useMetaMaskSigner ? "bi-wallet2" : "bi-laptop"} me-1`}></i>
                  {useMetaMaskSigner ? "MetaMask Mode" : "Simulation Mode"}
                </span>
                {isSepolia ? (
                  <span className="badge bg-success">
                    <i className="bi bi-broadcast me-1"></i>Sepolia (11155111)
                  </span>
                ) : chainId ? (
                  <span className="badge bg-danger">
                    <i className="bi bi-exclamation-triangle me-1"></i>Wrong Network ({chainId})
                  </span>
                ) : null}
              </div>
            </div>

            <div className="agri-card-body p-4">
              {/* Wallet & Contract Status Panel */}
              <div className="p-3 mb-4 rounded-3 bg-light border">
                <div className="row g-3 align-items-center">
                  <div className="col-md-6">
                    <div className="small text-muted text-uppercase fw-semibold mb-1">
                      Connected Wallet
                    </div>
                    {metaMaskAddress ? (
                      <div className="d-flex align-items-center gap-2">
                        <code className="text-dark bg-white px-2 py-1 rounded border small">
                          {metaMaskAddress.slice(0, 10)}...{metaMaskAddress.slice(-8)}
                        </code>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2"
                          onClick={() => copyAddress(metaMaskAddress)}
                          title="Copy address"
                        >
                          <i className={`bi ${copied ? "bi-check2" : "bi-clipboard"}`}></i>
                        </button>
                        <a
                          href={`https://sepolia.etherscan.io/address/${metaMaskAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline-secondary py-0 px-2"
                          title="View on Sepolia Etherscan"
                        >
                          <i className="bi bi-box-arrow-up-right"></i>
                        </a>
                      </div>
                    ) : (
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-muted small">MetaMask is not connected.</span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm py-1 px-3"
                          onClick={connectMetaMask}
                        >
                          <i className="bi bi-wallet2 me-1"></i>Connect MetaMask
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="col-md-6">
                    <div className="small text-muted text-uppercase fw-semibold mb-1">
                      On-Chain Contract Role
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {loadingOnChainRole ? (
                        <div className="d-flex align-items-center gap-2 text-secondary small">
                          <span className="spinner-border spinner-border-sm text-success" role="status"></span>
                          <span>Reading on-chain role via <code>getRole()</code>...</span>
                        </div>
                      ) : !metaMaskAddress ? (
                        <span className="badge bg-secondary">Connect wallet to inspect</span>
                      ) : isAlreadyRegistered ? (
                        <span className="badge bg-success fs-6 py-1 px-3">
                          <i className="bi bi-patch-check-fill me-1"></i>
                          {onChainRoleName} (Role {onChainRole})
                        </span>
                      ) : (
                        <span className="badge bg-warning text-dark fs-6 py-1 px-3">
                          <i className="bi bi-exclamation-circle-fill me-1"></i>
                          Unregistered (Role None = 0)
                        </span>
                      )}

                      {metaMaskAddress && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2"
                          onClick={() => refreshOnChainRole(metaMaskAddress)}
                          title="Re-read role from contract"
                          disabled={loadingOnChainRole}
                        >
                          <i className="bi bi-arrow-clockwise"></i>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="col-12 pt-2 border-top">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 small text-muted">
                      <div>
                        <strong>Deployed Contract:</strong>{" "}
                        <a
                          href={`https://sepolia.etherscan.io/address/${deployedAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-monospace text-decoration-none text-success"
                        >
                          {deployedAddress}
                        </a>
                      </div>
                      <div>
                        <strong>Target Network:</strong> Ethereum Sepolia (ID: 11155111)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wrong Network Warning */}
              {metaMaskAddress && !isSepolia && (
                <div className="alert alert-danger d-flex align-items-center justify-content-between mb-4">
                  <div>
                    <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                    <strong>Wrong Network:</strong> MetaMask is connected to Chain ID {chainId || "Unknown"}.
                    AgriChain smart contract transactions must be sent on <strong>Ethereum Sepolia (11155111)</strong>.
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm px-3 fw-semibold"
                    onClick={switchToSepolia}
                  >
                    Switch to Sepolia
                  </button>
                </div>
              )}

              {/* Already Registered Info Banner */}
              {isAlreadyRegistered && (
                <div className="alert alert-info mb-4">
                  <div className="d-flex align-items-start gap-2">
                    <i className="bi bi-info-circle-fill fs-5 mt-1 text-primary"></i>
                    <div>
                      <h6 className="fw-bold mb-1">
                        Wallet Already Registered as {onChainRoleName}
                      </h6>
                      <p className="mb-2 small">
                        This wallet (<code>{metaMaskAddress}</code>) is permanently registered on the AgriChain
                        smart contract with <strong>Role {onChainRole} ({onChainRoleName})</strong>.
                      </p>
                      <div className="small text-muted bg-white p-2 rounded border">
                        <i className="bi bi-shield-check text-success me-1"></i>
                        <strong>Smart Contract Constraint (AgriChain.sol):</strong> Role registration is immutable
                        and enforced on-chain via <code>require(roles[msg.sender] == Role.None, "Role already registered")</code>.
                        Once a role is bound to an address, it cannot be changed or overwritten.
                      </div>

                      <div className="mt-3 d-flex flex-wrap gap-2">
                        {isFarmer ? (
                          <Link to="/farmer/add" className="btn btn-success btn-sm px-3 fw-semibold">
                            <i className="bi bi-plus-circle me-1"></i>Proceed to Register New Batch
                          </Link>
                        ) : (
                          <div className="text-secondary small">
                            <i className="bi bi-exclamation-triangle text-warning me-1"></i>
                            To register crop batches as a Farmer, please switch MetaMask to a registered Farmer account, or connect a fresh wallet and register it as Farmer.
                          </div>
                        )}
                        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm px-3">
                          Back to Dashboard
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              <Alert message={error} onClose={() => setError("")} />

              {/* Registration Form */}
              <form onSubmit={handleRegister}>
                <div className="mb-3">
                  <label className="form-label fw-bold small text-uppercase text-secondary">
                    Select Your Supply Chain Role to Register on Blockchain
                  </label>
                  <p className="text-secondary small mb-3">
                    Choose the role that matches your operations. Farmers are granted permission to create
                    agricultural crop batches and initiate the traceability lifecycle on the smart contract.
                  </p>

                  <div className="row g-3">
                    {AVAILABLE_ROLES.map((item) => {
                      const isSelected = selectedRole === item.value;
                      const isRegisteredThis = isAlreadyRegistered && onChainRole === item.value;

                      return (
                        <div className="col-md-6" key={item.value}>
                          <div
                            className={`p-3 rounded-3 border h-100 transition position-relative ${
                              isSelected && !isAlreadyRegistered
                                ? "border-success bg-success-subtle bg-opacity-25 shadow-sm"
                                : isRegisteredThis
                                ? "border-primary bg-primary-subtle bg-opacity-10"
                                : "bg-white"
                            }`}
                            onClick={() => {
                              if (!isAlreadyRegistered) setSelectedRole(item.value);
                            }}
                            style={{ cursor: isAlreadyRegistered ? "not-allowed" : "pointer" }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <div className="d-flex align-items-center gap-2">
                                <span className="fs-3">{item.avatar}</span>
                                <div>
                                  <strong className="text-dark d-block">{item.name}</strong>
                                  <span className="badge bg-light text-secondary border small">
                                    Role {item.value} • {item.badge}
                                  </span>
                                </div>
                              </div>
                              <input
                                type="radio"
                                className="form-check-input"
                                name="roleSelection"
                                checked={isSelected}
                                disabled={isAlreadyRegistered}
                                onChange={() => setSelectedRole(item.value)}
                              />
                            </div>

                            <p className="text-secondary small mb-2">{item.desc}</p>
                            <div className="small text-muted pt-2 border-top">
                              <i className="bi bi-key-fill text-secondary me-1"></i>
                              {item.permissions}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-3">
                  <div className="small text-muted">
                    <i className="bi bi-lock-fill text-warning me-1"></i>
                    Role registration permanently writes to the Sepolia blockchain ledger.
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <Link to="/dashboard" className="btn btn-outline-secondary btn-sm px-3">
                      Cancel
                    </Link>

                    <button
                      type="submit"
                      className="btn btn-success px-4 py-2 fw-semibold"
                      disabled={busy || isAlreadyRegistered || (metaMaskAddress && !isSepolia)}
                    >
                      {busy ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Submitting to Sepolia...
                        </>
                      ) : isAlreadyRegistered ? (
                        <>
                          <i className="bi bi-check-circle-fill me-1"></i>
                          Already Registered as {onChainRoleName}
                        </>
                      ) : !metaMaskAddress ? (
                        <>
                          <i className="bi bi-wallet2 me-1"></i>
                          Connect MetaMask & Register Role
                        </>
                      ) : (
                        <>
                          <i className="bi bi-patch-check-fill me-1"></i>
                          Register as {ROLE_NAMES[selectedRole]} on Sepolia
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Transaction Confirmation Feedback */}
              <TransactionFeedback hash={txHash} />

              {confirmedReceipt && (
                <div className="alert alert-success mt-4 p-3 shadow-sm border-success">
                  <div className="d-flex align-items-start gap-2">
                    <i className="bi bi-check-circle-fill text-success fs-4 mt-1"></i>
                    <div>
                      <h5 className="alert-heading fw-bold mb-1">
                        On-Chain Registration Confirmed!
                      </h5>
                      <p className="mb-2">
                        Your wallet (<code>{metaMaskAddress}</code>) is now officially recorded as{" "}
                        <strong>Role {selectedRole} ({ROLE_NAMES[selectedRole]})</strong> on the Sepolia smart contract.
                      </p>
                      <div className="small text-secondary mb-3">
                        Transaction Hash:{" "}
                        <a
                          href={`https://sepolia.etherscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-monospace text-success fw-semibold text-decoration-underline"
                        >
                          {txHash}
                        </a>
                      </div>
                      <div className="d-flex gap-2">
                        {selectedRole === 1 ? (
                          <Link to="/farmer/add" className="btn btn-success btn-sm px-3 fw-semibold">
                            <i className="bi bi-plus-circle me-1"></i>Create Your First Batch
                          </Link>
                        ) : (
                          <Link to="/dashboard" className="btn btn-success btn-sm px-3 fw-semibold">
                            Go to Dashboard
                          </Link>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setConfirmedReceipt(null)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

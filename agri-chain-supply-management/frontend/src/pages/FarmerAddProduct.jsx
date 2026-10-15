// Path: frontend/src/pages/FarmerAddProduct.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Alert from "../components/Alert";
import TransactionFeedback from "../components/TransactionFeedback";
import {
  createProductOnChain,
  generateSimulatedTxHash,
  getWalletRole,
  ROLE_NAMES
} from "../services/blockchain";
import { createProduct } from "../services/api";
import { useWallet } from "../context/WalletContext";

export default function FarmerAddProduct() {
  const {
    address,
    metaMaskAddress,
    useMetaMaskSigner,
    isDemoMode,
    isSepolia,
    chainId,
    switchToSepolia,
    connectMetaMask,
    onChainRole,
    onChainRoleName,
    loadingOnChainRole,
    refreshOnChainRole,
    currentPersona,
    user
  } = useWallet();

  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "Organic Honeycrisp Apples",
    cropType: "Fruits",
    harvestDate: new Date().toISOString().slice(0, 10),
    farmLocation: "Yakima Valley Orchards, WA",
    quantity: "2,500 kg",
    qualityGrade: "Grade A+ (Premium Export)",
    storageConditions: "Cold Chain Controlled (3.5°C, 90% RH)",
    certifications: "USDA Organic, GlobalG.A.P.",
    estimatedShelfLife: "60 Days",
    notes: "High Brix sugar content, harvested in crisp early-morning conditions."
  });

  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [createdProductId, setCreatedProductId] = useState(null);
  const [busy, setBusy] = useState(false);

  // Refresh on-chain role state when MetaMask address or network changes
  useEffect(() => {
    if (useMetaMaskSigner && metaMaskAddress) {
      refreshOnChainRole(metaMaskAddress);
    }
  }, [useMetaMaskSigner, metaMaskAddress, chainId]);

  const isMetaMaskActive = Boolean(useMetaMaskSigner && window.ethereum);
  const isFarmerRole = onChainRole === 1;
  const isUnregistered = onChainRole === 0;
  const isWrongRole = onChainRole !== null && onChainRole !== 0 && onChainRole !== 1;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setHash("");
    setBusy(true);

    try {
      let finalProductId;
      let txHash;
      let farmerSignerAddress;

      if (isMetaMaskActive) {
        // Verify connection and network before submitting
        if (!metaMaskAddress) {
          throw new Error("MetaMask is not connected. Please connect your wallet first.");
        }
        if (!isSepolia) {
          throw new Error("MetaMask is not connected to Ethereum Sepolia. Please switch networks.");
        }

        // Live check: Read signer role directly from smart contract to prevent gas burn and reverts
        const latestRole = await getWalletRole(metaMaskAddress);
        if (latestRole !== 1) {
          if (latestRole === 0) {
            throw new Error(
              `Connected wallet (${metaMaskAddress}) is not registered on the smart contract. You must register as a Farmer (Role 1) on the Register Role page before creating agricultural products.`
            );
          } else {
            const currentName = ROLE_NAMES[latestRole] || `Role ${latestRole}`;
            throw new Error(
              `Connected wallet (${metaMaskAddress}) is registered as "${currentName}". In AgriChain.sol, only accounts with the Farmer role (Role 1) are authorized to execute createProduct(). Please switch accounts in MetaMask.`
            );
          }
        }

        // Live Ethereum Sepolia Contract Execution
        const chainResult = await createProductOnChain(form.name, form.harvestDate);
        finalProductId = chainResult.productId;
        txHash = chainResult.hash;
        farmerSignerAddress = chainResult.signerAddress || metaMaskAddress;
      } else {
        // Interactive Demo Simulation Mode
        finalProductId = Math.floor(100 + Math.random() * 900);
        txHash = generateSimulatedTxHash();
        farmerSignerAddress = address || (currentPersona ? currentPersona.address : "0x90f79bf6eb2c4f870365e785982e1f101e93b906");
      }

      setHash(txHash);

      const certificationsList = form.certifications
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Persist product batch in backend database with verified farmer signer address
      await createProduct({
        productId: finalProductId,
        name: form.name,
        cropType: form.cropType,
        harvestDate: form.harvestDate,
        farmLocation: form.farmLocation,
        quantity: form.quantity,
        qualityGrade: form.qualityGrade,
        storageConditions: form.storageConditions,
        certifications: certificationsList,
        estimatedShelfLife: form.estimatedShelfLife,
        notes: form.notes,
        farmer: farmerSignerAddress,
        txHash,
        isDemoMode: !isMetaMaskActive
      });

      setCreatedProductId(finalProductId);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-9 col-xl-8">
          <div className="agri-card shadow-sm border-0">
            <div className="agri-card-header bg-light d-flex flex-wrap align-items-center justify-content-between gap-3 p-4">
              <div>
                <span className="badge bg-success-subtle text-success border border-success-subtle mb-1">
                  <i className="bi bi-seedling me-1"></i>Origin Farmer Registration
                </span>
                <h4 className="fw-bold mb-0">Register New Agricultural Crop Batch</h4>
              </div>

              <div className="d-flex align-items-center gap-2">
                <span className={`badge ${isMetaMaskActive ? "bg-primary" : "bg-dark"}`}>
                  <i className={`bi ${isMetaMaskActive ? "bi-wallet2" : "bi-laptop"} me-1`}></i>
                  {isMetaMaskActive ? "MetaMask Mode" : "Simulation Mode"}
                </span>
                {isMetaMaskActive && isSepolia && (
                  <span className="badge bg-success">
                    <i className="bi bi-broadcast me-1"></i>Sepolia
                  </span>
                )}
              </div>
            </div>

            <div className="agri-card-body p-4">
              {/* On-Chain Role Verification Alerts for MetaMask Mode */}
              {isMetaMaskActive && (
                <div className="mb-4">
                  {!metaMaskAddress ? (
                    <div className="alert alert-warning d-flex align-items-center justify-content-between">
                      <div>
                        <i className="bi bi-wallet2 me-2 fs-5"></i>
                        <strong>MetaMask Not Connected:</strong> Connect your wallet to create on-chain batches on Sepolia.
                      </div>
                      <button
                        type="button"
                        className="btn btn-warning btn-sm fw-semibold"
                        onClick={connectMetaMask}
                      >
                        Connect MetaMask
                      </button>
                    </div>
                  ) : !isSepolia ? (
                    <div className="alert alert-danger d-flex align-items-center justify-content-between">
                      <div>
                        <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                        <strong>Wrong Network:</strong> MetaMask is connected to Chain ID {chainId}. Please switch to Ethereum Sepolia (11155111).
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm fw-semibold"
                        onClick={switchToSepolia}
                      >
                        Switch to Sepolia
                      </button>
                    </div>
                  ) : loadingOnChainRole ? (
                    <div className="alert alert-light border d-flex align-items-center gap-2 text-secondary">
                      <span className="spinner-border spinner-border-sm text-success" role="status"></span>
                      <span>Verifying Farmer role permissions on the Sepolia smart contract...</span>
                    </div>
                  ) : isUnregistered ? (
                    <div className="alert alert-warning p-3 border-warning">
                      <div className="d-flex align-items-start gap-2">
                        <i className="bi bi-exclamation-triangle-fill text-warning fs-4 mt-1"></i>
                        <div>
                          <h6 className="alert-heading fw-bold mb-1">
                            Wallet Role Registration Required
                          </h6>
                          <p className="small mb-2">
                            The connected MetaMask wallet (<code>{metaMaskAddress}</code>) is <strong>Unregistered (Role 0)</strong> on the AgriChain contract.
                            The contract requires the <strong>Farmer (Role 1)</strong> role to execute <code>createProduct()</code>. Calling the contract now will revert with:
                            <code className="d-block mt-1 p-1 bg-white rounded border text-danger small">
                              execution reverted: "Caller does not have required role"
                            </code>
                          </p>
                          <div className="d-flex gap-2 mt-2">
                            <Link to="/register-role" className="btn btn-warning btn-sm fw-semibold">
                              <i className="bi bi-person-badge me-1"></i>Open Register Role Page
                            </Link>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => refreshOnChainRole(metaMaskAddress)}
                            >
                              <i className="bi bi-arrow-clockwise me-1"></i>Refresh Role
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : isWrongRole ? (
                    <div className="alert alert-danger p-3 border-danger">
                      <div className="d-flex align-items-start gap-2">
                        <i className="bi bi-x-circle-fill text-danger fs-4 mt-1"></i>
                        <div>
                          <h6 className="alert-heading fw-bold mb-1">
                            Incompatible On-Chain Role: {onChainRoleName} (Role {onChainRole})
                          </h6>
                          <p className="small mb-2">
                            Connected wallet (<code>{metaMaskAddress}</code>) is registered on-chain as a{" "}
                            <strong>{onChainRoleName}</strong>. Only wallets registered as <strong>Farmer (Role 1)</strong> are authorized to tokenize new batches.
                          </p>
                          <p className="small text-muted mb-2">
                            Because roles are immutable on the AgriChain smart contract, please switch to a registered Farmer account in MetaMask, or register a new wallet as Farmer.
                          </p>
                          <div className="d-flex gap-2 mt-2">
                            <Link to="/register-role" className="btn btn-outline-danger btn-sm">
                              View Role Details
                            </Link>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => refreshOnChainRole(metaMaskAddress)}
                            >
                              <i className="bi bi-arrow-clockwise me-1"></i>Refresh Role
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : isFarmerRole ? (
                    <div className="alert alert-success d-flex align-items-center justify-content-between py-2 px-3 border-success">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-patch-check-fill text-success fs-5"></i>
                        <div>
                          <strong className="text-dark small d-block">Verified On-Chain Farmer</strong>
                          <span className="small text-secondary">
                            Wallet <code>{metaMaskAddress.slice(0, 10)}...{metaMaskAddress.slice(-6)}</code> is confirmed as Farmer (Role 1) on Sepolia.
                          </span>
                        </div>
                      </div>
                      <span className="badge bg-success">Authorized</span>
                    </div>
                  ) : null}
                </div>
              )}

              <p className="text-secondary small mb-4">
                This transaction creates an immutable origin record on the ledger and establishes
                the cryptographic genesis root for farm-to-consumer provenance.
              </p>

              <Alert message={error} onClose={() => setError("")} />

              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-8">
                    <label className="form-label fw-semibold small">Product / Batch Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.name}
                      required
                      placeholder="e.g. Organic Honeycrisp Apples"
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Crop Category *</label>
                    <select
                      className="form-select"
                      value={form.cropType}
                      onChange={(e) => setForm({ ...form, cropType: e.target.value })}
                    >
                      <option value="Fruits">Fruits</option>
                      <option value="Vegetables">Vegetables</option>
                      <option value="Grains & Cereals">Grains & Cereals</option>
                      <option value="Coffee & Tea">Coffee & Tea</option>
                      <option value="Dairy & Poultry">Dairy & Poultry</option>
                      <option value="Spices & Herbs">Spices & Herbs</option>
                      <option value="Specialty Produce">Specialty Produce</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Harvest Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.harvestDate}
                      required
                      onChange={(e) => setForm({ ...form, harvestDate: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Batch Quantity *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.quantity}
                      required
                      placeholder="e.g. 2,500 kg or 500 crates"
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Quality Grade</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.qualityGrade}
                      placeholder="e.g. Grade A+ (Premium)"
                      onChange={(e) => setForm({ ...form, qualityGrade: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Farm Origin & Location *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.farmLocation}
                      required
                      placeholder="e.g. Yakima Valley Orchards, WA"
                      onChange={(e) => setForm({ ...form, farmLocation: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Storage & Temperature Target</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.storageConditions}
                      placeholder="e.g. Cold Chain (3.5°C, 90% RH)"
                      onChange={(e) => setForm({ ...form, storageConditions: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Certifications (comma separated)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.certifications}
                      placeholder="USDA Organic, GlobalG.A.P., Non-GMO"
                      onChange={(e) => setForm({ ...form, certifications: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Estimated Shelf Life</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.estimatedShelfLife}
                      placeholder="e.g. 60 Days"
                      onChange={(e) => setForm({ ...form, estimatedShelfLife: e.target.value })}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold small">Agronomic Notes & Harvest Batch Log</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={form.notes}
                      placeholder="Soil health, Brix sugar levels, rain conditions at harvest..."
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="small text-muted d-flex align-items-center gap-2">
                    <span>Authorized Signer:</span>
                    {isMetaMaskActive ? (
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle fw-semibold">
                        <i className="bi bi-wallet2 me-1"></i>
                        {metaMaskAddress
                          ? `${metaMaskAddress.slice(0, 10)}...${metaMaskAddress.slice(-6)}`
                          : "MetaMask Signer"}
                      </span>
                    ) : (
                      <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle fw-semibold">
                        {user?.avatar || "👨‍🌾"} {user?.name || "John Vance"} • {user?.organization || "Green Valley Organic Farms"}
                      </span>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    {isMetaMaskActive && !isFarmerRole && (
                      <Link to="/register-role" className="btn btn-outline-warning btn-sm">
                        <i className="bi bi-person-badge me-1"></i>Register Role First
                      </Link>
                    )}

                    <button
                      type="submit"
                      className="btn btn-success px-4 fw-semibold"
                      disabled={busy || (isMetaMaskActive && (!isFarmerRole || !isSepolia))}
                    >
                      {busy ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Recording to Ledger...
                        </>
                      ) : isMetaMaskActive && isUnregistered ? (
                        <>
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          Farmer Role Registration Required
                        </>
                      ) : isMetaMaskActive && isWrongRole ? (
                        <>
                          <i className="bi bi-x-circle me-1"></i>
                          Unauthorized ({onChainRoleName})
                        </>
                      ) : isMetaMaskActive && !isSepolia ? (
                        <>
                          <i className="bi bi-arrow-repeat me-1"></i>
                          Switch to Sepolia Network
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cloud-arrow-up-fill me-2"></i>
                          Register & Tokenize Batch
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              <TransactionFeedback hash={hash} />

              {createdProductId && (
                <div className="alert alert-success mt-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <i className="bi bi-check-circle-fill me-2"></i>
                    Batch <strong>#{createdProductId}</strong> has been successfully registered on-chain!
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-outline-success"
                      onClick={() => navigate(`/trace/${createdProductId}`)}
                    >
                      <i className="bi bi-search me-1"></i>Trace & View QR
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => navigate("/dashboard")}
                    >
                      Back to Dashboard
                    </button>
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

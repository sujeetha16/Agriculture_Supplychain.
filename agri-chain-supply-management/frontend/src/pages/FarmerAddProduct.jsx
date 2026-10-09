// Path: frontend/src/pages/FarmerAddProduct.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import TransactionFeedback from "../components/TransactionFeedback";
import { createProductOnChain, generateSimulatedTxHash } from "../services/blockchain";
import { createProduct } from "../services/api";
import { useWallet } from "../context/WalletContext";

export default function FarmerAddProduct() {
  const { address, isDemoMode, currentPersona, user } = useWallet();
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setHash("");
    setBusy(true);

    try {
      let finalProductId;
      let txHash;

      if (!isDemoMode && window.ethereum) {
        // Live Ethereum Sepolia Contract Execution
        const chainResult = await createProductOnChain(form.name, form.harvestDate);
        finalProductId = chainResult.productId;
        txHash = chainResult.hash;
      } else {
        // Interactive Demo Simulation Mode
        finalProductId = Math.floor(100 + Math.random() * 900);
        txHash = generateSimulatedTxHash();
      }

      setHash(txHash);

      const certificationsList = form.certifications
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const farmerAddress = address || (currentPersona ? currentPersona.address : "0x90f79bf6eb2c4f870365e785982e1f101e93b906");

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
        farmer: farmerAddress,
        txHash
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
          <div className="agri-card">
            <div className="agri-card-header bg-light">
              <div>
                <span className="badge bg-success-subtle text-success border border-success-subtle mb-1">
                  <i className="bi bi-seedling me-1"></i>Origin Farmer Registration
                </span>
                <h4 className="fw-bold mb-0">Register New Agricultural Crop Batch</h4>
              </div>
              <span className="badge bg-dark">
                {isDemoMode ? "Simulation Mode" : "MetaMask Mode"}
              </span>
            </div>

            <div className="agri-card-body p-4">
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
                    <span>Authorized Farmer:</span>
                    <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle fw-semibold">
                      {user?.avatar || "👨‍🌾"} {user?.name || "John Vance"} • {user?.organization || "Green Valley Organic Farms"}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success px-4 fw-semibold"
                    disabled={busy}
                  >
                    {busy ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Recording to Ledger...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-cloud-arrow-up-fill me-2"></i>
                        Register & Tokenize Batch
                      </>
                    )}
                  </button>
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

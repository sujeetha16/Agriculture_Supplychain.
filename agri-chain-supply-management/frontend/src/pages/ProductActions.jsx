// Path: frontend/src/pages/ProductActions.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Alert from "../components/Alert";
import TransactionFeedback from "../components/TransactionFeedback";
import ProductTimeline from "../components/ProductTimeline";
import ProductQRCode from "../components/QRCode";
import { getProduct, postAction } from "../services/api";
import { useWallet } from "../context/WalletContext";
import {
  getSignerAndContract,
  dispatchToDistributor,
  receiveFromFarmer,
  dispatchToRetailer,
  receiveFromDistributor,
  sellToConsumer,
  generateSimulatedTxHash,
  DEMO_PERSONAS
} from "../services/blockchain";

const roleNames = {
  1: "Farmer",
  2: "Distributor",
  3: "Retailer",
  4: "Consumer"
};

export default function ProductActions() {
  const { productId } = useParams();
  const { address, isDemoMode, demoRole, currentPersona, switchDemoRole } = useWallet();

  const [product, setProduct] = useState(null);
  const [role, setRole] = useState(0);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    receiverAddress: "",
    location: "",
    notes: ""
  });
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await getProduct(productId);
      setProduct(data);

      if (isDemoMode) {
        setRole(demoRole);
      } else if (address && window.ethereum) {
        try {
          const { contract } = await getSignerAndContract();
          setRole(Number(await contract.getRole(address)));
        } catch (_) {
          // If contract query fails or role not registered, use fallback
          setRole(0);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  useEffect(() => {
    load();
  }, [productId, address, isDemoMode, demoRole]);

  // Set intelligent defaults for receiver address based on demo personas
  useEffect(() => {
    if (!product) return;
    if (product.status === "Created") {
      setForm((f) => ({
        ...f,
        receiverAddress: DEMO_PERSONAS[2].address,
        location: "Pacific NW Cold-Chain Logistics Hub",
        notes: "Inspection passed; loaded into reefer truck at 3.5°C"
      }));
    } else if (product.status === "ReceivedByDistributor") {
      setForm((f) => ({
        ...f,
        receiverAddress: DEMO_PERSONAS[3].address,
        location: "FreshMarket Store #104, Westlake",
        notes: "Dispatched from warehouse dock 4; verified unbroken cold-chain seal"
      }));
    } else if (product.status === "ReceivedByRetailer") {
      setForm((f) => ({
        ...f,
        receiverAddress: DEMO_PERSONAS[4].address,
        location: "Checkout Counter #2, FreshMarket Seattle",
        notes: "Purchased at point-of-sale; digital provenance receipt issued"
      }));
    }
  }, [product?.status]);

  async function perform(blockchainCall, apiPath, receiverAddress = null) {
    setError("");
    setHash("");

    try {
      setBusy(true);
      let txHash;

      if (!isDemoMode && window.ethereum) {
        // Execute real on-chain transaction via MetaMask
        const result = await blockchainCall();
        txHash = result.hash;
      } else {
        // Deterministic simulated transaction hash for zero-friction review
        txHash = generateSimulatedTxHash();
      }

      setHash(txHash);

      const effectiveActor = address || (currentPersona ? currentPersona.address : "0x90f79bf6eb2c4f870365e785982e1f101e93b906");

      await postAction(apiPath, {
        actorAddress: effectiveActor,
        receiverAddress,
        date: form.date,
        txHash,
        location: form.location,
        notes: form.notes
      });

      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!product) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-success" role="status"></div>
        <p className="text-secondary small mt-2">Loading batch provenance record...</p>
      </div>
    );
  }

  const status = product.status;
  const activeActorAddress = (address || "").toLowerCase();

  // In demo mode, allow actions based on the selected demo persona
  const actionAllowed = isDemoMode
    ? (status === "Created" && demoRole === 1) ||
      (status === "DispatchedToDistributor" && demoRole === 2) ||
      (status === "ReceivedByDistributor" && demoRole === 2) ||
      (status === "DispatchedToRetailer" && demoRole === 3) ||
      (status === "ReceivedByRetailer" && demoRole === 3)
    : (status === "Created" && role === 1 && product.farmer.toLowerCase() === activeActorAddress) ||
      (status === "DispatchedToDistributor" && role === 2 && product.distributor?.toLowerCase() === activeActorAddress) ||
      (status === "ReceivedByDistributor" && role === 2 && product.distributor?.toLowerCase() === activeActorAddress) ||
      (status === "DispatchedToRetailer" && role === 3 && product.retailer?.toLowerCase() === activeActorAddress) ||
      (status === "ReceivedByRetailer" && role === 3 && product.retailer?.toLowerCase() === activeActorAddress);

  // Helper to suggest correct role
  const getRequiredRole = () => {
    switch (status) {
      case "Created": return { role: 1, name: "Farmer" };
      case "DispatchedToDistributor": return { role: 2, name: "Distributor" };
      case "ReceivedByDistributor": return { role: 2, name: "Distributor" };
      case "DispatchedToRetailer": return { role: 3, name: "Retailer" };
      case "ReceivedByRetailer": return { role: 3, name: "Retailer" };
      default: return null;
    }
  };

  const req = getRequiredRole();

  return (
    <div className="container py-5">
      {/* Product Summary Header */}
      <div className="agri-card mb-4">
        <div className="agri-card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="badge bg-dark font-monospace">Batch #{product.productId}</span>
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  {product.cropType || "Produce"}
                </span>
                <span className="badge bg-light text-dark border">
                  Stage: {product.status}
                </span>
              </div>
              <h2 className="fw-bold mb-1">{product.name}</h2>
              <div className="text-secondary small">
                <i className="bi bi-geo-alt me-1 text-success"></i>
                {product.farmLocation} • Harvested {product.harvestDate} • {product.quantity}
              </div>
            </div>

            <div className="d-flex gap-2">
              <Link to={`/trace/${product.productId}`} className="btn btn-outline-success btn-sm">
                <i className="bi bi-search me-1"></i>View Trace & QR
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Alert message={error} onClose={() => setError("")} />
      <TransactionFeedback hash={hash} />

      <div className="row g-4">
        {/* Full Provenance Journey Column */}
        <div className="col-lg-7">
          <div className="agri-card h-100">
            <div className="agri-card-header bg-light">
              <h5 className="fw-bold mb-0">
                <i className="bi bi-clock-history text-success me-2"></i>
                Recorded Supply Chain Journey
              </h5>
              <span className="badge bg-light text-muted border">
                {product.history?.length || 0} Events
              </span>
            </div>
            <div className="agri-card-body p-4">
              <ProductTimeline product={product} />
            </div>
          </div>
        </div>

        {/* Next Stage Action Column */}
        <div className="col-lg-5">
          <div className="agri-card">
            <div className="agri-card-header bg-light">
              <h5 className="fw-bold mb-0">
                <i className="bi bi-arrow-right-circle-fill text-success me-2"></i>
                Custody Handoff Console
              </h5>
              <span className="badge bg-dark">
                {isDemoMode ? `Demo: ${roleNames[demoRole]}` : `Role: ${roleNames[role] || "None"}`}
              </span>
            </div>

            <div className="agri-card-body p-4">
              {/* Persona Switch Hint if wrong role */}
              {!actionAllowed && status !== "SoldToConsumer" && req && (
                <div className="alert alert-warning small mb-3 border">
                  <div className="fw-bold mb-1">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                    Role Handoff Required
                  </div>
                  This batch requires action by a <strong>{req.name}</strong>.
                  {isDemoMode && (
                    <div className="mt-2">
                      <button
                        className="btn btn-sm btn-dark w-100"
                        onClick={() => switchDemoRole(req.role)}
                      >
                        <i className="bi bi-arrow-repeat me-1"></i>
                        Switch to {req.name} Persona
                      </button>
                    </div>
                  )}
                </div>
              )}

              {status === "SoldToConsumer" && (
                <div className="alert alert-success">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  This agricultural batch lifecycle is 100% complete. Provenance verified from farm to consumer.
                </div>
              )}

              {/* Form Controls */}
              {actionAllowed && (
                <div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Action Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.date}
                      disabled={busy}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Handoff Location / Facility</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.location}
                      disabled={busy}
                      placeholder="e.g. Seattle Regional Logistics Hub"
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Transit & Condition Notes</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.notes}
                      disabled={busy}
                      placeholder="e.g. Temperature checked: 3.8°C; seals verified"
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>

                  {/* 1. Farmer Dispatch to Distributor */}
                  {status === "Created" && (
                    <div className="border-top pt-3">
                      <label className="form-label small fw-semibold">Designated Distributor Wallet Address *</label>
                      <input
                        className="form-control font-monospace small mb-3"
                        placeholder="0x..."
                        value={form.receiverAddress}
                        onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
                      />
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy || !form.receiverAddress}
                        onClick={() => perform(
                          () => dispatchToDistributor(product.productId, form.receiverAddress, form.date),
                          `/products/${product.productId}/dispatch-distributor`,
                          form.receiverAddress
                        )}
                      >
                        {busy ? "Processing..." : "Dispatch to Distributor"}
                      </button>
                    </div>
                  )}

                  {/* 2. Distributor Receive from Farmer */}
                  {status === "DispatchedToDistributor" && (
                    <div className="border-top pt-3">
                      <p className="small text-secondary mb-3">
                        Confirming receipt of batch at distributor hub. Verifies integrity of origin seals.
                      </p>
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy}
                        onClick={() => perform(
                          () => receiveFromFarmer(product.productId, form.date),
                          `/products/${product.productId}/receive-distributor`
                        )}
                      >
                        {busy ? "Processing..." : "Acknowledge Receipt from Farmer"}
                      </button>
                    </div>
                  )}

                  {/* 3. Distributor Dispatch to Retailer */}
                  {status === "ReceivedByDistributor" && (
                    <div className="border-top pt-3">
                      <label className="form-label small fw-semibold">Designated Retailer Wallet Address *</label>
                      <input
                        className="form-control font-monospace small mb-3"
                        placeholder="0x..."
                        value={form.receiverAddress}
                        onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
                      />
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy || !form.receiverAddress}
                        onClick={() => perform(
                          () => dispatchToRetailer(product.productId, form.receiverAddress, form.date),
                          `/products/${product.productId}/dispatch-retailer`,
                          form.receiverAddress
                        )}
                      >
                        {busy ? "Processing..." : "Dispatch to Retail Store"}
                      </button>
                    </div>
                  )}

                  {/* 4. Retailer Receive from Distributor */}
                  {status === "DispatchedToRetailer" && (
                    <div className="border-top pt-3">
                      <p className="small text-secondary mb-3">
                        Acknowledge receipt and stocking on retail grocery shelf.
                      </p>
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy}
                        onClick={() => perform(
                          () => receiveFromDistributor(product.productId, form.date),
                          `/products/${product.productId}/receive-retailer`
                        )}
                      >
                        {busy ? "Processing..." : "Receive & Stock on Shelf"}
                      </button>
                    </div>
                  )}

                  {/* 5. Retailer Sell to Consumer */}
                  {status === "ReceivedByRetailer" && (
                    <div className="border-top pt-3">
                      <label className="form-label small fw-semibold">Consumer Wallet Address *</label>
                      <input
                        className="form-control font-monospace small mb-3"
                        placeholder="0x..."
                        value={form.receiverAddress}
                        onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
                      />
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy || !form.receiverAddress}
                        onClick={() => perform(
                          () => sellToConsumer(product.productId, form.receiverAddress, form.date),
                          `/products/${product.productId}/sell-consumer`,
                          form.receiverAddress
                        )}
                      >
                        {busy ? "Processing..." : "Record Sale to Consumer"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

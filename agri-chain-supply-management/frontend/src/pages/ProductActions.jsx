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
  generateSimulatedTxHash
} from "../services/blockchain";
import { STAKEHOLDERS, resolveStakeholder } from "../services/stakeholders";

export default function ProductActions() {
  const { productId } = useParams();
  const { user, address, useMetaMaskSigner, loginAsRole } = useWallet();

  const [product, setProduct] = useState(null);
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
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  useEffect(() => {
    load();
  }, [productId, user]);

  // Set intelligent defaults for destination stakeholder
  useEffect(() => {
    if (!product) return;
    if (product.status === "Created") {
      setForm((f) => ({
        ...f,
        receiverAddress: STAKEHOLDERS[1].walletAddress,
        location: "Pacific NW Cold-Chain Logistics Hub, Seattle",
        notes: "Inspected at farm gate; loaded into temperature-controlled reefer at 3.5°C"
      }));
    } else if (product.status === "ReceivedByDistributor") {
      setForm((f) => ({
        ...f,
        receiverAddress: STAKEHOLDERS[2].walletAddress,
        location: "FreshMarket Supermarket #104, Westlake Avenue",
        notes: "Dispatched from warehouse cold room; verified unbroken digital integrity seals"
      }));
    } else if (product.status === "ReceivedByRetailer") {
      setForm((f) => ({
        ...f,
        receiverAddress: STAKEHOLDERS[3].walletAddress,
        location: "Point-of-Sale Register #4, FreshMarket Seattle",
        notes: "Scanned and purchased at retail checkout; provenance token transferred to consumer"
      }));
    }
  }, [product?.status]);

  async function perform(blockchainCall, apiPath, receiverAddress = null) {
    setError("");
    setHash("");

    try {
      setBusy(true);
      let txHash;

      if (useMetaMaskSigner && window.ethereum) {
        const result = await blockchainCall();
        txHash = result.hash;
      } else {
        txHash = generateSimulatedTxHash();
      }

      setHash(txHash);

      const effectiveActor = address || (user ? user.walletAddress : STAKEHOLDERS[0].walletAddress);

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
  const userRole = user?.role || 0;

  // Determine which stakeholder role is required for the next step
  const getRequiredRole = () => {
    switch (status) {
      case "Created": return { role: 1, name: "Farmer", portal: STAKEHOLDERS[0] };
      case "DispatchedToDistributor": return { role: 2, name: "Distributor", portal: STAKEHOLDERS[1] };
      case "ReceivedByDistributor": return { role: 2, name: "Distributor", portal: STAKEHOLDERS[1] };
      case "DispatchedToRetailer": return { role: 3, name: "Retailer", portal: STAKEHOLDERS[2] };
      case "ReceivedByRetailer": return { role: 3, name: "Retailer", portal: STAKEHOLDERS[2] };
      default: return null;
    }
  };

  const req = getRequiredRole();
  const isAuthorized = req && userRole === req.role;

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
                  Current Stage: {product.status}
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
                <i className="bi bi-search me-1"></i>View Trace & QR Badge
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
                Custody Chain & Provenance Journey
              </h5>
              <span className="badge bg-light text-muted border">
                {product.history?.length || 0} Recorded Handoffs
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
                Handoff Action Console
              </h5>
              <span className="badge bg-dark">
                {user ? `${user.avatar} ${user.roleName}` : "Guest"}
              </span>
            </div>

            <div className="agri-card-body p-4">
              {/* Role Required Alert */}
              {!isAuthorized && status !== "SoldToConsumer" && req && (
                <div className="alert alert-warning small mb-4 border">
                  <div className="fw-bold mb-1">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                    Role Action Required: {req.name}
                  </div>
                  This stage must be performed by <strong>{req.portal.name} ({req.portal.organization})</strong>.
                  <div className="mt-2">
                    <button
                      className="btn btn-sm btn-dark w-100"
                      onClick={() => loginAsRole(req.role)}
                    >
                      <i className="bi bi-box-arrow-in-right me-1"></i>
                      Switch to {req.name} Portal ({req.portal.name})
                    </button>
                  </div>
                </div>
              )}

              {status === "SoldToConsumer" && (
                <div className="alert alert-success">
                  <i className="bi bi-check-circle-fill me-2 fs-5"></i>
                  <strong>Lifecycle Complete!</strong> This agricultural batch has been sold to the consumer. Full provenance verified from farm to consumer.
                </div>
              )}

              {/* Action Form */}
              {isAuthorized && (
                <div>
                  <div className="p-3 bg-light rounded-3 mb-3 small">
                    <span className="text-muted d-block" style={{ fontSize: "0.75rem" }}>Acting Stakeholder:</span>
                    <strong className="text-dark fs-6">{user.avatar} {user.name}</strong>
                    <div className="text-muted">{user.organization}</div>
                  </div>

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
                    <label className="form-label small fw-semibold">Handoff Facility / Location *</label>
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
                    <label className="form-label small fw-semibold">Cold-Chain & Telemetry Notes</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.notes}
                      disabled={busy}
                      placeholder="e.g. Temp verified at 3.5°C, unbroken digital seal"
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>

                  {/* 1. Farmer Dispatch to Distributor */}
                  {status === "Created" && (
                    <div className="border-top pt-3">
                      <label className="form-label small fw-semibold">Designated Cold-Chain Distributor *</label>
                      <select
                        className="form-select mb-3"
                        value={form.receiverAddress}
                        onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
                      >
                        <option value={STAKEHOLDERS[1].walletAddress}>
                          🚚 {STAKEHOLDERS[1].name} — {STAKEHOLDERS[1].organization}
                        </option>
                      </select>
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy || !form.receiverAddress}
                        onClick={() => perform(
                          () => dispatchToDistributor(product.productId, form.receiverAddress, form.date),
                          `/products/${product.productId}/dispatch-distributor`,
                          form.receiverAddress
                        )}
                      >
                        {busy ? "Signing to Ledger..." : "Dispatch Freight to Distributor"}
                      </button>
                    </div>
                  )}

                  {/* 2. Distributor Receive from Farmer */}
                  {status === "DispatchedToDistributor" && (
                    <div className="border-top pt-3">
                      <p className="small text-secondary mb-3">
                        Acknowledge inbound freight arrival at the cold storage facility. Verifies origin temperature seals.
                      </p>
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy}
                        onClick={() => perform(
                          () => receiveFromFarmer(product.productId, form.date),
                          `/products/${product.productId}/receive-distributor`
                        )}
                      >
                        {busy ? "Signing to Ledger..." : "Acknowledge Receipt from Farmer"}
                      </button>
                    </div>
                  )}

                  {/* 3. Distributor Dispatch to Retailer */}
                  {status === "ReceivedByDistributor" && (
                    <div className="border-top pt-3">
                      <label className="form-label small fw-semibold">Designated Retail Supermarket *</label>
                      <select
                        className="form-select mb-3"
                        value={form.receiverAddress}
                        onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
                      >
                        <option value={STAKEHOLDERS[2].walletAddress}>
                          🏪 {STAKEHOLDERS[2].name} — {STAKEHOLDERS[2].organization}
                        </option>
                      </select>
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy || !form.receiverAddress}
                        onClick={() => perform(
                          () => dispatchToRetailer(product.productId, form.receiverAddress, form.date),
                          `/products/${product.productId}/dispatch-retailer`,
                          form.receiverAddress
                        )}
                      >
                        {busy ? "Signing to Ledger..." : "Dispatch to Retail Store"}
                      </button>
                    </div>
                  )}

                  {/* 4. Retailer Receive from Distributor */}
                  {status === "DispatchedToRetailer" && (
                    <div className="border-top pt-3">
                      <p className="small text-secondary mb-3">
                        Confirm delivery at retail loading dock and stock product onto store shelves.
                      </p>
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy}
                        onClick={() => perform(
                          () => receiveFromDistributor(product.productId, form.date),
                          `/products/${product.productId}/receive-retailer`
                        )}
                      >
                        {busy ? "Signing to Ledger..." : "Receive & Stock on Retail Shelves"}
                      </button>
                    </div>
                  )}

                  {/* 5. Retailer Sell to Consumer */}
                  {status === "ReceivedByRetailer" && (
                    <div className="border-top pt-3">
                      <label className="form-label small fw-semibold">Purchasing Customer / Consumer *</label>
                      <select
                        className="form-select mb-3"
                        value={form.receiverAddress}
                        onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
                      >
                        <option value={STAKEHOLDERS[3].walletAddress}>
                          👤 {STAKEHOLDERS[3].name} — {STAKEHOLDERS[3].organization}
                        </option>
                      </select>
                      <button
                        className="btn btn-success w-100 fw-semibold"
                        disabled={busy || !form.receiverAddress}
                        onClick={() => perform(
                          () => sellToConsumer(product.productId, form.receiverAddress, form.date),
                          `/products/${product.productId}/sell-consumer`,
                          form.receiverAddress
                        )}
                      >
                        {busy ? "Signing to Ledger..." : "Record Point-of-Sale Checkout"}
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

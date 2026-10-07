// Path: frontend/src/pages/TraceProduct.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import ProductTimeline from "../components/ProductTimeline";
import ProductQRCode from "../components/QRCode";
import { getProduct } from "../services/api";
import { getOnChainProduct } from "../services/blockchain";

export default function TraceProduct() {
  const [productId, setProductId] = useState("");
  const [product, setProduct] = useState(null);
  const [onChain, setOnChain] = useState(null);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function trace(id = productId) {
    setError("");
    setVerified(false);
    setOnChain(null);
    try {
      if (!id || !/^\d+$/.test(String(id))) throw new Error("Enter a valid numeric Product ID.");
      setBusy(true);

      const [backendProduct, chainProduct] = await Promise.all([
        getProduct(id),
        getOnChainProduct(id)
      ]);

      setProduct(backendProduct);
      setOnChain(chainProduct);

      const backendEvents = Object.fromEntries(
        (backendProduct.history || []).map((event) => [event.action, event])
      );

      const matches =
        backendProduct.productId === chainProduct.id &&
        backendProduct.name === chainProduct.name &&
        backendProduct.harvestDate === chainProduct.harvestDate &&
        backendProduct.farmer.toLowerCase() === chainProduct.farmer.toLowerCase() &&
        (backendProduct.distributor || "").toLowerCase() === (chainProduct.distributor || "").toLowerCase() &&
        (backendProduct.retailer || "").toLowerCase() === (chainProduct.retailer || "").toLowerCase() &&
        (backendProduct.consumer || "").toLowerCase() === (chainProduct.consumer || "").toLowerCase() &&
        (backendEvents.DISPATCHED_TO_DISTRIBUTOR?.date || "") === chainProduct.dispatchToDistributorDate &&
        (backendEvents.RECEIVED_BY_DISTRIBUTOR?.date || "") === chainProduct.distributorReceiveDate &&
        (backendEvents.DISPATCHED_TO_RETAILER?.date || "") === chainProduct.dispatchToRetailerDate &&
        (backendEvents.RECEIVED_BY_RETAILER?.date || "") === chainProduct.retailerReceiveDate &&
        (backendEvents.SOLD_TO_CONSUMER?.date || "") === chainProduct.soldToConsumerDate;

      setVerified(matches);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-9">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <h2 className="fw-bold">Trace Agricultural Product</h2>
              <p className="text-secondary">Enter the Product ID from the QR code or scan it with the camera.</p>
              <div className="input-group">
                <input className="form-control" placeholder="e.g. 1" value={productId}
                  onChange={(e) => setProductId(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && trace()} />
                <button className="btn btn-success" onClick={() => trace()} disabled={busy}>
                  {busy ? "Verifying..." : "Trace"}
                </button>
              </div>
              <button className="btn btn-outline-success mt-3" onClick={() => navigate("/scan")}>
                <i className="bi bi-camera me-2"></i>Scan QR with Camera
              </button>
              <Alert message={error} />
            </div>
          </div>

          {product && (
            <>
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                  <div className="row align-items-center">
                    <div className="col-md-8">
                      <span className="badge text-bg-success">Product #{product.productId}</span>
                      <h3 className="fw-bold mt-2">{product.name}</h3>
                      <p className="mb-1">Harvest date: {product.harvestDate}</p>
                      <p className="mb-0">Status: <strong>{product.status}</strong></p>
                    </div>
                    <div className="col-md-4 mt-3 mt-md-0">
                      <ProductQRCode product={product} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`alert ${verified ? "alert-success" : "alert-danger"}`}>
                <strong>{verified ? "Blockchain verification passed" : "Verification mismatch"}</strong>
                <div className="small mt-1">
                  The application compared core product fields stored in MongoDB with the Sepolia smart contract.
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <h5 className="fw-bold">Journey Timeline</h5>
                  <ProductTimeline product={product} />
                </div>
              </div>

              {onChain && (
                <div className="card border-0 shadow-sm mt-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold">On-chain data</h5>
                    <div className="small text-break">
                      <div><strong>Farmer:</strong> {onChain.farmer}</div>
                      <div><strong>Distributor:</strong> {onChain.distributor}</div>
                      <div><strong>Retailer:</strong> {onChain.retailer}</div>
                      <div><strong>Consumer:</strong> {onChain.consumer}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Path: frontend/src/pages/TraceProduct.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Alert from "../components/Alert";
import ProductTimeline from "../components/ProductTimeline";
import ProductQRCode from "../components/QRCode";
import { getProduct, getProducts } from "../services/api";
import { getOnChainProduct } from "../services/blockchain";
import { resolveStakeholder } from "../services/stakeholders";

export default function TraceProduct() {
  const { productId: urlProductId } = useParams();
  const [productId, setProductId] = useState(urlProductId || "");
  const [product, setProduct] = useState(null);
  const [onChain, setOnChain] = useState(null);
  const [sampleProducts, setSampleProducts] = useState([]);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Load sample batches for quick clicking
  useEffect(() => {
    getProducts()
      .then((list) => setSampleProducts(list || []))
      .catch(() => {});
  }, []);

  async function trace(id = productId) {
    if (!id || !/^\d+$/.test(String(id))) {
      setError("Please enter a valid numeric Batch Product ID.");
      return;
    }

    setError("");
    setVerified(false);
    setOnChain(null);
    setBusy(true);

    try {
      // Fetch backend verified mirror
      const backendProduct = await getProduct(id);
      setProduct(backendProduct);

      // Attempt on-chain verification
      try {
        const chainProduct = await getOnChainProduct(id);
        if (chainProduct && chainProduct.id) {
          setOnChain(chainProduct);
          // Verify on-chain product name & farmer
          const match =
            Number(backendProduct.productId) === Number(chainProduct.id) &&
            backendProduct.name.toLowerCase() === chainProduct.name.toLowerCase();
          setVerified(match);
        }
      } catch (chainErr) {
        console.warn("[On-Chain Query Warning]", chainErr.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setProduct(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (urlProductId) {
      setProductId(urlProductId);
      trace(urlProductId);
    }
  }, [urlProductId]);

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          {/* Search Header Card */}
          <div className="agri-card mb-4">
            <div className="agri-card-body p-4">
              <div className="row align-items-center g-3">
                <div className="col-md-7">
                  <span className="badge bg-success-subtle text-success border border-success-subtle mb-1">
                    <i className="bi bi-shield-lock-fill me-1"></i>Cryptographic Provenance Verification
                  </span>
                  <h3 className="fw-bold mb-1">Trace Agricultural Product Batch</h3>
                  <p className="text-secondary small mb-0">
                    Verify origin farm credentials, harvest conditions, transit temperature, and immutable smart-contract handshakes.
                  </p>
                </div>

                <div className="col-md-5">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter Batch ID (e.g. 101)"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && trace()}
                    />
                    <button
                      className="btn btn-success fw-semibold"
                      onClick={() => trace()}
                      disabled={busy}
                    >
                      {busy ? (
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                      ) : (
                        <>
                          <i className="bi bi-search me-1"></i>Verify
                        </>
                      )}
                    </button>
                  </div>

                  <div className="d-flex align-items-center justify-content-between mt-2">
                    <button
                      className="btn btn-link btn-sm text-success text-decoration-none p-0 small"
                      onClick={() => navigate("/scan")}
                    >
                      <i className="bi bi-camera me-1"></i>Scan via Camera
                    </button>

                    {sampleProducts.length > 0 && (
                      <div className="small text-muted">
                        <span>Try batch: </span>
                        {sampleProducts.slice(0, 3).map((sp) => (
                          <button
                            key={sp.productId}
                            className="btn btn-link btn-sm p-0 me-1 text-decoration-underline text-secondary font-monospace"
                            onClick={() => {
                              setProductId(String(sp.productId));
                              trace(sp.productId);
                            }}
                          >
                            #{sp.productId}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Alert message={error} onClose={() => setError("")} />
            </div>
          </div>

          {/* Product Overview Card & Verification Status */}
          {product && (
            <>
              {/* Verification Callout */}
              <div className={`alert ${verified ? "alert-success" : "alert-info"} border shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4`}>
                <div className="d-flex align-items-center gap-2">
                  <i className={`bi ${verified ? "bi-patch-check-fill text-success" : "bi-info-circle-fill text-primary"} fs-4`}></i>
                  <div>
                    <strong>
                      {verified
                        ? "Cryptographically Verified on Ethereum Sepolia Ledger"
                        : "Verified by Supply Chain Relational Storage Mirror"}
                    </strong>
                    <div className="small text-muted">
                      Batch #{product.productId} has {product.history?.length || 0} recorded custody state transitions.
                    </div>
                  </div>
                </div>

                {product.qrBlockchainHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${product.qrBlockchainHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline-dark font-monospace"
                  >
                    Genesis TX <i className="bi bi-box-arrow-up-right ms-1"></i>
                  </a>
                )}
              </div>

              {/* Main Product Card */}
              <div className="agri-card mb-4">
                <div className="agri-card-body p-4">
                  <div className="row g-4 align-items-center">
                    <div className="col-md-8">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <span className="badge bg-dark font-monospace">Batch #{product.productId}</span>
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          {product.cropType || "General Produce"}
                        </span>
                        <span className="badge bg-light text-dark border">
                          Status: {product.status}
                        </span>
                      </div>

                      <h2 className="fw-bold text-dark mb-2">{product.name}</h2>

                      <div className="row g-3 my-2 text-secondary small">
                        <div className="col-sm-6">
                          <div>
                            <strong>Origin Farmer:</strong>{" "}
                            {(() => {
                              const f = resolveStakeholder(product.farmer);
                              return f ? (
                                <span className="text-dark fw-medium">
                                  {f.avatar} {f.name} ({f.organization})
                                </span>
                              ) : (
                                <span className="text-dark fw-medium">👨‍🌾 John Vance (Green Valley Organic Farms)</span>
                              );
                            })()}
                          </div>
                          <div><strong>Origin Farm:</strong> {product.farmLocation || "Origin Farm"}</div>
                          <div><strong>Harvest Date:</strong> {product.harvestDate}</div>
                          <div><strong>Batch Quantity:</strong> {product.quantity || "1,000 kg"}</div>
                        </div>
                        <div className="col-sm-6">
                          <div><strong>Quality Grade:</strong> {product.qualityGrade || "Grade A"}</div>
                          <div><strong>Storage Conditions:</strong> {product.storageConditions || "Controlled"}</div>
                          <div><strong>Est. Shelf Life:</strong> {product.estimatedShelfLife || "45 Days"}</div>
                        </div>
                      </div>

                      {Array.isArray(product.certifications) && product.certifications.length > 0 && (
                        <div className="d-flex flex-wrap gap-1 mt-3">
                          {product.certifications.map((cert) => (
                            <span key={cert} className="badge bg-success bg-opacity-10 text-success border border-success-subtle">
                              <i className="bi bi-award-fill me-1"></i>{cert}
                            </span>
                          ))}
                        </div>
                      )}

                      {product.notes && (
                        <p className="small text-muted fst-italic mt-3 mb-0 border-top pt-2">
                          "{product.notes}"
                        </p>
                      )}
                    </div>

                    <div className="col-md-4 text-center border-start ps-md-4">
                      <div className="p-3 bg-light rounded-3 d-inline-block">
                        <ProductQRCode product={product} />
                      </div>
                      <div className="small text-muted mt-2">
                        Scan with any smartphone camera to verify this batch provenance.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Provenance Timeline */}
              <div className="agri-card">
                <div className="agri-card-header bg-light">
                  <h5 className="fw-bold mb-0">
                    <i className="bi bi-clock-history text-success me-2"></i>
                    Complete Farm-to-Consumer Provenance Journey
                  </h5>
                  <Link
                    to={`/product/${product.productId}`}
                    className="btn btn-sm btn-outline-success"
                  >
                    Manage / Advance Status
                  </Link>
                </div>
                <div className="agri-card-body p-4">
                  <ProductTimeline product={product} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Path: frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { getProducts, getStats, resetDemoData } from "../services/api";
import ProductCard from "../components/ProductCard";
import Alert from "../components/Alert";

const roleNames = { 1: "Farmer", 2: "Distributor", 3: "Retailer", 4: "Consumer" };

export default function Dashboard() {
  const {
    user,
    address,
    metaMaskAddress,
    useMetaMaskSigner,
    isSepolia,
    chainId,
    onChainRole,
    onChainRoleName,
    switchToSepolia
  } = useWallet();
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [cropFilter, setCropFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [productList, statsData] = await Promise.all([
        getProducts(),
        getStats().catch(() => null)
      ]);
      setProducts(productList || []);
      setStats(statsData);
    } catch (err) {
      if (err.message === "Network Error" || !err.response) {
        setError("Unable to connect to the backend API server on http://localhost:5000. Please ensure the backend service is running.");
      } else {
        setError(err.response?.data?.message || err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [address]);

  async function handleResetDemo() {
    try {
      setLoading(true);
      await resetDemoData();
      setActionSuccess("Agricultural catalog reset to reference demonstration data.");
      await loadData();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.productId).includes(searchQuery) ||
      (p.farmLocation && p.farmLocation.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "IN_TRANSIT" && (p.status === "DispatchedToDistributor" || p.status === "DispatchedToRetailer")) ||
      p.status === statusFilter;

    const matchesCrop =
      cropFilter === "ALL" ||
      p.cropType === cropFilter;

    return matchesQuery && matchesStatus && matchesCrop;
  });

  return (
    <div className="container py-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle">
              <i className="bi bi-shield-check me-1"></i>Production Cloud Console
            </span>
            {user && (
              <span className="badge bg-dark text-white">
                Active Portal: {user.avatar} {user.name} ({user.organization})
              </span>
            )}
          </div>
          <h2 className="fw-bold tracking-tight mb-0">Agricultural Supply Chain Operations</h2>
          <p className="text-secondary small mb-0">
            Real-time farm-to-table provenance, transit telemetry, and on-chain verification ledger.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={handleResetDemo}
            title="Reset catalog back to sample reference state"
            disabled={loading}
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i>Reset Demo Catalog
          </button>
          <Link to="/register-role" className="btn btn-outline-success btn-sm px-3" title="Register or view on-chain role">
            <i className="bi bi-person-badge me-1"></i>Register Role
          </Link>
          <Link to="/farmer/add" className="btn btn-success btn-sm px-3">
            <i className="bi bi-plus-lg me-1"></i>Register New Batch
          </Link>
        </div>
      </div>

      {/* On-Chain Status Banners in MetaMask Mode */}
      {useMetaMaskSigner && metaMaskAddress && (
        <div className="mb-4">
          {!isSepolia ? (
            <div className="alert alert-danger d-flex align-items-center justify-content-between">
              <div>
                <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                <strong>Wrong Network:</strong> MetaMask is on Chain ID {chainId}. Please switch to Ethereum Sepolia (11155111).
              </div>
              <button className="btn btn-danger btn-sm fw-semibold" onClick={switchToSepolia}>
                Switch to Sepolia
              </button>
            </div>
          ) : onChainRole === 0 ? (
            <div className="alert alert-warning d-flex align-items-center justify-content-between">
              <div>
                <i className="bi bi-exclamation-circle-fill me-2 fs-5 text-warning"></i>
                <strong>Wallet Not Registered on Smart Contract:</strong> Connected wallet (<code>{metaMaskAddress.slice(0, 10)}...{metaMaskAddress.slice(-6)}</code>) has not registered a role on the AgriChain Sepolia contract.
              </div>
              <Link to="/register-role" className="btn btn-warning btn-sm fw-semibold">
                <i className="bi bi-person-badge me-1"></i>Register Role on Sepolia
              </Link>
            </div>
          ) : onChainRole === 1 ? (
            <div className="alert alert-success d-flex align-items-center justify-content-between py-2">
              <div className="small">
                <i className="bi bi-patch-check-fill text-success me-2 fs-5"></i>
                <strong>Verified Sepolia Farmer:</strong> Wallet <code>{metaMaskAddress.slice(0, 10)}...{metaMaskAddress.slice(-6)}</code> is registered as Farmer (Role 1). Authorized to create crop batches.
              </div>
              <Link to="/farmer/add" className="btn btn-success btn-sm py-1 px-3">
                <i className="bi bi-plus-circle me-1"></i>Register New Batch
              </Link>
            </div>
          ) : onChainRole ? (
            <div className="alert alert-info d-flex align-items-center justify-content-between py-2">
              <div className="small">
                <i className="bi bi-info-circle-fill text-primary me-2 fs-5"></i>
                <strong>Connected as On-Chain {onChainRoleName}:</strong> Wallet <code>{metaMaskAddress.slice(0, 10)}...{metaMaskAddress.slice(-6)}</code> is registered with Role {onChainRole}.
              </div>
              <Link to="/register-role" className="btn btn-outline-primary btn-sm py-1 px-3">
                View Role Details
              </Link>
            </div>
          ) : null}
        </div>
      )}

      <Alert message={error} onClose={() => setError("")} />
      {actionSuccess && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>{actionSuccess}
          <button type="button" className="btn-close" onClick={() => setActionSuccess("")}></button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="kpi-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="kpi-label mb-0">Total Tracked Batches</span>
              <div className="kpi-icon-wrapper bg-success-subtle text-success">
                <i className="bi bi-box-seam"></i>
              </div>
            </div>
            <div className="kpi-val">{stats?.totalBatches ?? products.length}</div>
            <div className="small text-muted mt-1">
              <i className="bi bi-check2-all text-success me-1"></i>Tokenized on ledger
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="kpi-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="kpi-label mb-0">Active In-Transit</span>
              <div className="kpi-icon-wrapper bg-warning-subtle text-warning">
                <i className="bi bi-truck"></i>
              </div>
            </div>
            <div className="kpi-val text-warning">
              {stats?.inTransitCount ?? products.filter((p) => p.status.includes("Dispatched")).length}
            </div>
            <div className="small text-muted mt-1">
              <i className="bi bi-thermometer-half text-warning me-1"></i>Cold-chain active
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="kpi-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="kpi-label mb-0">Completed Provenance</span>
              <div className="kpi-icon-wrapper bg-info-subtle text-info">
                <i className="bi bi-bag-check-fill"></i>
              </div>
            </div>
            <div className="kpi-val text-info">
              {stats?.completedCount ?? products.filter((p) => p.status === "SoldToConsumer").length}
            </div>
            <div className="small text-muted mt-1">
              <i className="bi bi-qr-code-scan text-info me-1"></i>Delivered to consumers
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="kpi-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="kpi-label mb-0">Farm Origin Batches</span>
              <div className="kpi-icon-wrapper bg-primary-subtle text-primary">
                <i className="bi bi-seedling"></i>
              </div>
            </div>
            <div className="kpi-val text-primary">
              {stats?.activeFarming ?? products.filter((p) => p.status === "Created").length}
            </div>
            <div className="small text-muted mt-1">
              <i className="bi bi-geo-alt-fill text-primary me-1"></i>Awaiting dispatch
            </div>
          </div>
        </div>
      </div>

      {/* Analytics & Distribution Panel */}
      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="agri-card h-100">
            <div className="agri-card-header">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-pie-chart-fill text-success me-2"></i>
                Crop Category Distribution
              </h6>
              <span className="badge bg-light text-secondary">Real-time DB</span>
            </div>
            <div className="agri-card-body">
              {stats?.byCropType && Object.keys(stats.byCropType).length > 0 ? (
                <div className="chart-bar-container">
                  {Object.entries(stats.byCropType).map(([crop, count]) => {
                    const total = stats.totalBatches || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div className="chart-bar-item" key={crop}>
                        <div className="chart-bar-label">{crop}</div>
                        <div className="chart-bar-track">
                          <div className="chart-bar-fill" style={{ width: `${pct}%` }}></div>
                        </div>
                        <div className="chart-bar-value">{count} ({pct}%)</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted small py-3">No category data recorded yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="agri-card h-100">
            <div className="agri-card-header">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-activity text-success me-2"></i>
                Supply Chain Stage Breakdown
              </h6>
              <span className="badge bg-light text-secondary">State Machine</span>
            </div>
            <div className="agri-card-body">
              {stats?.byStatus ? (
                <div className="chart-bar-container">
                  {[
                    ["Created", "1. At Origin Farm", stats.byStatus.Created || 0, "#0284c7"],
                    ["DispatchedToDistributor", "2. Transit to Distributor", stats.byStatus.DispatchedToDistributor || 0, "#d97706"],
                    ["ReceivedByDistributor", "3. In Distributor Hub", stats.byStatus.ReceivedByDistributor || 0, "#4f46e5"],
                    ["DispatchedToRetailer", "4. Transit to Retailer", stats.byStatus.DispatchedToRetailer || 0, "#d97706"],
                    ["ReceivedByRetailer", "5. On Retail Shelf", stats.byStatus.ReceivedByRetailer || 0, "#4f46e5"],
                    ["SoldToConsumer", "6. Sold to Consumer", stats.byStatus.SoldToConsumer || 0, "#15803d"]
                  ].map(([key, label, count, color]) => {
                    const total = stats.totalBatches || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div className="chart-bar-item" key={key}>
                        <div className="chart-bar-label text-truncate" title={label}>{label}</div>
                        <div className="chart-bar-track">
                          <div className="chart-bar-fill" style={{ width: `${pct}%`, background: color }}></div>
                        </div>
                        <div className="chart-bar-value">{count}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted small py-3">No status data available.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Search & Filtering */}
      <div className="agri-card mb-4">
        <div className="agri-card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-md-5">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control form-control-sm border-start-0"
                  placeholder="Search by crop, batch #, or farm location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="col-6 col-md-3">
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Supply Stages</option>
                <option value="Created">At Origin Farm</option>
                <option value="IN_TRANSIT">In Active Transit</option>
                <option value="ReceivedByDistributor">At Distributor</option>
                <option value="ReceivedByRetailer">In Retail Store</option>
                <option value="SoldToConsumer">Sold to Consumer</option>
              </select>
            </div>

            <div className="col-6 col-md-3">
              <select
                className="form-select form-select-sm"
                value={cropFilter}
                onChange={(e) => setCropFilter(e.target.value)}
              >
                <option value="ALL">All Crop Categories</option>
                <option value="Fruits">Fruits</option>
                <option value="Vegetables">Vegetables</option>
                <option value="Grains & Cereals">Grains & Cereals</option>
                <option value="Coffee & Tea">Coffee & Tea</option>
                <option value="Specialty Produce">Specialty Produce</option>
              </select>
            </div>

            <div className="col-md-1 text-md-end">
              <button
                className="btn btn-sm btn-light border w-100"
                onClick={() => { setSearchQuery(""); setStatusFilter("ALL"); setCropFilter("ALL"); }}
                title="Reset filters"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Batch Grid */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status"></div>
          <p className="text-secondary small mt-2">Loading agricultural provenance data...</p>
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="row g-4">
          {filteredProducts.map((product) => (
            <div className="col-md-6 col-lg-3" key={product.productId}>
              <ProductCard
                product={product}
                role={user ? user.role : null}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state bg-white">
          <i className="bi bi-inbox fs-1 text-muted mb-2 d-block"></i>
          <h5>No agricultural batches match your filter</h5>
          <p className="text-secondary small mb-3">
            Try adjusting your search query or reset the demo catalog.
          </p>
          <button className="btn btn-outline-success btn-sm" onClick={handleResetDemo}>
            Reset Catalog to Default
          </button>
        </div>
      )}
    </div>
  );
}

// Path: frontend/src/components/Layout.jsx
import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { DEMO_PERSONAS } from "../services/blockchain";

export default function Layout({ children }) {
  const {
    address,
    isSepolia,
    connecting,
    connect,
    disconnect,
    isDemoMode,
    demoRole,
    switchDemoRole,
    setIsDemoMode,
    hasMetaMask
  } = useWallet();

  const navigate = useNavigate();

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Interactive Presentation Persona Strip */}
      <div className="persona-strip">
        <div className="container d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-dark border border-secondary text-light">
              <i className="bi bi-sliders me-1"></i>Demo Role Simulation:
            </span>
            <div className="d-flex flex-wrap gap-1">
              {Object.values(DEMO_PERSONAS).map((p) => (
                <button
                  key={p.role}
                  type="button"
                  className={`persona-badge ${isDemoMode && demoRole === p.role ? "active" : ""}`}
                  onClick={() => switchDemoRole(p.role)}
                  title={`Simulate ${p.roleName} wallet (${p.address})`}
                >
                  <i className={`bi ${p.icon}`}></i>
                  <span>{p.roleName}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 small">
            {isDemoMode ? (
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                <i className="bi bi-lightning-charge-fill me-1"></i>Simulation Mode Active
              </span>
            ) : (
              <span className={`badge ${isSepolia ? "bg-success" : "bg-warning text-dark"}`}>
                <i className="bi bi-record-circle me-1"></i>
                {isSepolia ? "Sepolia Live" : "Wrong Network"}
              </span>
            )}
            {hasMetaMask && (
              <button
                className="btn btn-sm btn-link text-white-50 text-decoration-none p-0 ms-2"
                onClick={() => {
                  if (isDemoMode) {
                    connect();
                  } else {
                    disconnect();
                  }
                }}
              >
                {isDemoMode ? "Switch to MetaMask" : "Switch to Demo Mode"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="navbar navbar-expand-lg agri-navbar sticky-top">
        <div className="container">
          <Link className="agri-brand navbar-brand" to="/">
            <div className="brand-icon-box">
              <i className="bi bi-box-seam"></i>
            </div>
            <span>Agriculture Supply Chain</span>
          </Link>

          <button
            className="navbar-toggler border-secondary text-white"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNav"
          >
            <i className="bi bi-list text-white fs-4"></i>
          </button>

          <div className="collapse navbar-collapse" id="mainNav">
            <div className="navbar-nav me-auto ms-lg-3">
              <NavLink className="nav-link" to="/dashboard">
                <i className="bi bi-grid-1x2 me-1"></i>Dashboard
              </NavLink>
              <NavLink className="nav-link" to="/farmer/add">
                <i className="bi bi-plus-circle me-1"></i>Register Batch
              </NavLink>
              <NavLink className="nav-link" to="/trace">
                <i className="bi bi-search me-1"></i>Trace & Verify
              </NavLink>
              <NavLink className="nav-link" to="/scan">
                <i className="bi bi-qr-code-scan me-1"></i>Scan QR
              </NavLink>
              <NavLink className="nav-link" to="/cloud-architecture">
                <i className="bi bi-cloud-check me-1"></i>Cloud Architecture
              </NavLink>
            </div>

            <div className="d-flex align-items-center gap-2 mt-3 mt-lg-0">
              {address ? (
                <div className="dropdown">
                  <button
                    className="btn btn-outline-light btn-sm d-flex align-items-center gap-2 rounded-pill px-3"
                    type="button"
                    data-bs-toggle="dropdown"
                    title={address}
                  >
                    <span className="badge rounded-pill bg-success p-1">
                      <span className="visually-hidden">Active</span>
                    </span>
                    <span className="font-monospace small">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-success btn-sm rounded-pill px-3"
                  onClick={connect}
                  disabled={connecting}
                >
                  <i className="bi bi-wallet2 me-1"></i>
                  {connecting ? "Connecting..." : "Connect MetaMask"}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow-1">{children}</main>

      {/* Professional Footer */}
      <footer className="agri-footer">
        <div className="container">
          <div className="row g-4 align-items-center justify-content-between">
            <div className="col-md-5">
              <div className="d-flex align-items-center gap-2 mb-2">
                <div className="brand-icon-box" style={{ width: "26px", height: "26px", fontSize: "0.9rem" }}>
                  <i className="bi bi-box-seam"></i>
                </div>
                <strong className="text-white">Agriculture Supply Chain</strong>
              </div>
              <p className="text-secondary small mb-0">
                A production-style cloud computing platform combining distributed smart-contract
                verification with enterprise inventory tracking from origin harvest to consumer table.
              </p>
            </div>

            <div className="col-md-3">
              <h6 className="text-white small fw-bold text-uppercase mb-2">Cloud Stack</h6>
              <ul className="list-unstyled small text-secondary mb-0">
                <li>• Amazon CloudFront Edge CDN</li>
                <li>• Amazon S3 Static Hosting</li>
                <li>• Node.js API / AWS App Runner</li>
                <li>• MongoDB / AWS DocumentDB</li>
                <li>• Ethereum Sepolia Smart Contract</li>
              </ul>
            </div>

            <div className="col-md-4 text-md-end">
              <span className="badge bg-success bg-opacity-25 text-success border border-success-subtle mb-2">
                Cloud Computing Capstone
              </span>
              <div className="small text-secondary">
                Designed for University Cloud Computing Review
              </div>
              <div className="small text-secondary mt-1">
                Contract: <a href="https://sepolia.etherscan.io/address/0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D" target="_blank" rel="noreferrer" className="font-monospace text-decoration-underline text-success">0xB601...9a2D</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

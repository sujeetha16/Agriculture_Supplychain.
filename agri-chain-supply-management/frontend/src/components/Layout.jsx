// Path: frontend/src/components/Layout.jsx
import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

export default function Layout({ children }) {
  const {
    user,
    isAuthenticated,
    logout,
    loginAsRole,
    allStakeholders,
    isSepolia,
    useMetaMaskSigner,
    setUseMetaMaskSigner,
    connectMetaMask,
    hasMetaMask
  } = useWallet();

  const navigate = useNavigate();

  // If user is not logged in: show ONLY the login screen without top persona strip or app navbar
  if (!user) {
    return (
      <div className="d-flex flex-column min-vh-100 bg-light">
        <main className="flex-grow-1 d-flex align-items-center justify-content-center py-4">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Interactive Quick Portal Switcher Strip */}
      <div className="persona-strip">
        <div className="container d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-dark border border-secondary text-light">
              <i className="bi bi-person-badge-fill me-1"></i>Active Stakeholder Portal:
            </span>
            <div className="d-flex flex-wrap gap-1">
              {allStakeholders.map((s) => (
                <button
                  key={s.role}
                  type="button"
                  className={`persona-badge ${user?.role === s.role ? "active" : ""}`}
                  onClick={() => loginAsRole(s.role)}
                  title={`Switch to ${s.name} (${s.organization})`}
                >
                  <span className="me-1">{s.avatar}</span>
                  <span>{s.roleName}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 small">
            {user ? (
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                <i className="bi bi-check-circle-fill me-1"></i>Signed in as {user.name}
              </span>
            ) : (
              <Link to="/login" className="btn btn-sm btn-link text-white text-decoration-none p-0">
                Sign In to Portal
              </Link>
            )}

            {hasMetaMask && (
              <button
                className="btn btn-sm btn-link text-white-50 text-decoration-none p-0 ms-2"
                onClick={() => {
                  if (useMetaMaskSigner) {
                    setUseMetaMaskSigner(false);
                  } else {
                    connectMetaMask();
                  }
                }}
              >
                {useMetaMaskSigner ? "Disconnect MetaMask" : "Connect MetaMask (Sepolia)"}
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
              {user ? (
                <div className="dropdown">
                  <button
                    className="btn btn-outline-light btn-sm d-flex align-items-center gap-2 rounded-pill px-3 dropdown-toggle"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <span>{user.avatar}</span>
                    <span className="fw-semibold small">{user.name}</span>
                    <span className="badge bg-success bg-opacity-25 text-white small">
                      {user.roleName}
                    </span>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
                    <li className="px-3 py-2 border-bottom">
                      <div className="fw-bold text-dark">{user.name}</div>
                      <div className="small text-muted">{user.organization}</div>
                      <div className="small text-muted">{user.location}</div>
                    </li>
                    <li><h6 className="dropdown-header small text-uppercase">Switch Portal Role</h6></li>
                    {allStakeholders.map((s) => (
                      <li key={s.id}>
                        <button
                          className={`dropdown-item small d-flex align-items-center gap-2 ${user.id === s.id ? "active bg-success" : ""}`}
                          onClick={() => loginAsRole(s.role)}
                        >
                          <span>{s.avatar}</span>
                          <span>{s.name} ({s.roleName})</span>
                        </button>
                      </li>
                    ))}
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <Link className="dropdown-item small" to="/login">
                        <i className="bi bi-shield-lock me-2 text-primary"></i>Login / Switch Credentials
                      </Link>
                    </li>
                    <li>
                      <button
                        className="dropdown-item small text-danger"
                        onClick={() => {
                          logout();
                          navigate("/login");
                        }}
                      >
                        <i className="bi bi-box-arrow-right me-2"></i>Sign Out
                      </button>
                    </li>
                  </ul>
                </div>
              ) : (
                <Link to="/login" className="btn btn-success btn-sm rounded-pill px-3">
                  <i className="bi bi-box-arrow-in-right me-1"></i>Sign In to Portal
                </Link>
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
                Smart Contract: <a href="https://sepolia.etherscan.io/address/0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D" target="_blank" rel="noreferrer" className="font-monospace text-decoration-underline text-success">0xB601...9a2D</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

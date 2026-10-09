// Path: frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import Alert from "../components/Alert";

export default function Login() {
  const { login, loginAsRole, allStakeholders, user } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const from = location.state?.from?.pathname || "/dashboard";

  function handleQuickLogin(roleNumber) {
    const loggedUser = loginAsRole(roleNumber);
    if (loggedUser) {
      setSuccess(`Signed in as ${loggedUser.name} (${loggedUser.roleName})!`);
      setTimeout(() => navigate(from), 400);
    }
  }

  function handleStandardLogin(e) {
    e.preventDefault();
    setError("");
    const result = login(username, password);
    if (result.success) {
      setSuccess(`Welcome back, ${result.user.name}!`);
      setTimeout(() => navigate(from), 400);
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-10 col-xl-9">
          <div className="text-center mb-4">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 mb-2">
              <i className="bi bi-shield-lock-fill me-1"></i>Agricultural Supply Chain Access Control
            </span>
            <h2 className="fw-bold tracking-tight">Select Stakeholder Login Portal</h2>
            <p className="text-secondary small max-w-600 mx-auto">
              Access your personalized workspace tailored to your exact supply chain role.
              Use 1-click portal access or enter your stakeholder credentials.
            </p>
          </div>

          <Alert message={error} onClose={() => setError("")} />
          {success && (
            <div className="alert alert-success d-flex align-items-center mb-4">
              <i className="bi bi-check-circle-fill me-2 fs-5"></i>
              <div>{success}</div>
            </div>
          )}

          {/* 4 Distinct Role Portals Grid */}
          <div className="row g-4 mb-5">
            {allStakeholders.map((s) => {
              const isCurrent = user?.id === s.id;
              return (
                <div className="col-md-6" key={s.id}>
                  <div className={`agri-card h-100 p-4 transition ${isCurrent ? "border-success shadow-sm" : ""}`}>
                    <div className="d-flex align-items-start justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-3">
                        <span className="fs-1">{s.avatar}</span>
                        <div>
                          <span className={`badge bg-${s.badgeColor}-subtle text-${s.badgeColor} border mb-1`}>
                            {s.roleName} Portal
                          </span>
                          <h5 className="fw-bold text-dark mb-0">{s.name}</h5>
                          <div className="small text-muted">{s.organization}</div>
                        </div>
                      </div>
                      {isCurrent && (
                        <span className="badge bg-success rounded-pill px-2 py-1 small">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="p-2 bg-light rounded-3 small text-secondary mb-3">
                      <div><i className="bi bi-geo-alt me-1 text-success"></i>{s.location}</div>
                      <div><i className="bi bi-envelope me-1 text-primary"></i>{s.email}</div>
                    </div>

                    <button
                      type="button"
                      className={`btn w-100 fw-semibold ${isCurrent ? "btn-outline-success" : "btn-success"}`}
                      onClick={() => handleQuickLogin(s.role)}
                    >
                      <i className="bi bi-box-arrow-in-right me-1"></i>
                      {isCurrent ? "Continue to Portal" : `Enter as ${s.roleName}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Alternative Manual Login Form */}
          <div className="agri-card p-4">
            <h6 className="fw-bold text-dark mb-3">
              <i className="bi bi-key-fill text-success me-2"></i>Or Sign In with Stakeholder Credentials
            </h6>
            <form onSubmit={handleStandardLogin} className="row g-3">
              <div className="col-md-5">
                <label className="form-label small fw-semibold">Username or Stakeholder Email</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. farmer, distributor, retailer..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Access Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <button type="submit" className="btn btn-dark w-100 fw-semibold">
                  Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

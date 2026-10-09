// Path: frontend/src/pages/RegisterRole.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import TransactionFeedback from "../components/TransactionFeedback";
import { registerRole } from "../services/blockchain";
import { useWallet } from "../context/WalletContext";

const roles = [
  { value: 1, name: "Farmer", icon: "bi-person-badge", desc: "Harvests crops, tokenizes batches, and dispatches to distributors." },
  { value: 2, name: "Distributor", icon: "bi-truck", desc: "Oversees cold-chain transport, warehouses batches, and delivers to retail stores." },
  { value: 3, name: "Retailer", icon: "bi-shop", desc: "Stocks agricultural goods in grocery aisles and records consumer sales." },
  { value: 4, name: "Consumer", icon: "bi-person-check", desc: "Scans QR badges to inspect farm-of-origin provenance and certifications." }
];

export default function RegisterRole() {
  const { address, connect, isDemoMode, switchDemoRole } = useWallet();
  const [role, setRole] = useState(1);
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setHash("");

    if (isDemoMode) {
      switchDemoRole(role);
      navigate("/dashboard");
      return;
    }

    try {
      if (!address) await connect();
      setBusy(true);
      const result = await registerRole(role);
      setHash(result.hash);
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="agri-card">
            <div className="agri-card-header bg-light">
              <div>
                <span className="badge bg-success-subtle text-success border border-success-subtle mb-1">
                  Access Management & Governance
                </span>
                <h3 className="fw-bold mb-0">Register Stakeholder Identity</h3>
              </div>
              <span className="badge bg-dark">
                {isDemoMode ? "Simulation Mode" : "MetaMask Mode"}
              </span>
            </div>

            <div className="agri-card-body p-4">
              <p className="text-secondary small mb-4">
                Select your functional persona within the agricultural supply chain. In live mode,
                this binds your Ethereum wallet address to the on-chain smart contract access control list.
              </p>

              <Alert message={error} onClose={() => setError("")} />

              <form onSubmit={submit}>
                <div className="row g-3">
                  {roles.map((item) => (
                    <div className="col-md-6" key={item.value}>
                      <div
                        className={`p-3 rounded-3 border h-100 cursor-pointer transition ${role === item.value ? "border-success bg-success-subtle bg-opacity-25" : "bg-white"}`}
                        onClick={() => setRole(item.value)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <i className={`bi ${item.icon} text-success fs-4`}></i>
                            <strong className="text-dark">{item.name}</strong>
                          </div>
                          <input
                            type="radio"
                            className="form-check-input"
                            name="roleSelection"
                            checked={role === item.value}
                            onChange={() => setRole(item.value)}
                          />
                        </div>
                        <p className="text-secondary small mb-0">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="small text-muted">
                    {isDemoMode ? (
                      <span className="text-success fw-semibold">
                        <i className="bi bi-lightning-charge-fill me-1"></i>Instant Persona Activation
                      </span>
                    ) : (
                      <span>Requires on-chain Sepolia confirmation</span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success px-4 fw-semibold"
                    disabled={busy}
                  >
                    {busy ? "Registering on Ledger..." : isDemoMode ? "Activate Persona & Open Dashboard" : "Register on Sepolia Smart Contract"}
                  </button>
                </div>
              </form>

              <TransactionFeedback hash={hash} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

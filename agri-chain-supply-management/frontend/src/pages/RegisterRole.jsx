// Path: frontend/src/pages/RegisterRole.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import TransactionFeedback from "../components/TransactionFeedback";
import { registerRole } from "../services/blockchain";
import { useWallet } from "../context/WalletContext";

const roles = [
  { value: 1, name: "Farmer", icon: "bi-person-badge" },
  { value: 2, name: "Distributor", icon: "bi-truck" },
  { value: 3, name: "Retailer", icon: "bi-shop" },
  { value: 4, name: "Consumer", icon: "bi-person" }
];

export default function RegisterRole() {
  const { address, connect } = useWallet();
  const [role, setRole] = useState(1);
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setHash("");

    try {
      if (!address) await connect();
      setBusy(true);
      const result = await registerRole(role);
      setHash(result.hash);
      setTimeout(() => navigate("/dashboard"), 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="fw-bold">Register Blockchain Role</h2>
              <p className="text-secondary">A wallet can register one role on this demo network.</p>
              <Alert message={error} onClose={() => setError("")} />
              <form onSubmit={submit}>
                <div className="row g-3">
                  {roles.map((item) => (
                    <div className="col-md-6" key={item.value}>
                      <label className={`role-card ${role === item.value ? "selected" : ""}`}>
                        <input
                          className="form-check-input me-2"
                          type="radio"
                          name="role"
                          value={item.value}
                          checked={role === item.value}
                          onChange={() => setRole(item.value)}
                        />
                        <i className={`${item.icon} me-2`}></i>
                        {item.name}
                      </label>
                    </div>
                  ))}
                </div>
                <button className="btn btn-success w-100 mt-4" disabled={busy}>
                  {busy ? "Confirming..." : "Register Role on Sepolia"}
                </button>
              </form>
              <TransactionFeedback hash={hash} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

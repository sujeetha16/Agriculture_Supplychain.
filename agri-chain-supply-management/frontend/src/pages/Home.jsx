// Path: frontend/src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

export default function Home() {
  const { address } = useWallet();

  return (
    <div>
      <section className="hero-section">
        <div className="container py-5">
          <div className="row align-items-center py-4">
            <div className="col-lg-7">
              <span className="badge text-bg-light mb-3">Blockchain-powered traceability</span>
              <h1 className="display-4 fw-bold">From farm to consumer, every step verified.</h1>
              <p className="lead text-white-50">
                Manage agricultural products across farmers, distributors, retailers and consumers
                using Ethereum Sepolia, MongoDB and QR-based traceability.
              </p>
              <div className="d-flex flex-wrap gap-2">
                {address && <Link to="/dashboard" className="btn btn-light btn-lg">Open Dashboard</Link>}
                <Link to="/trace" className="btn btn-outline-light btn-lg">Trace a Product</Link>
              </div>
            </div>
            <div className="col-lg-5 mt-4 mt-lg-0">
              <div className="hero-card p-4">
                <i className="bi bi-box-seam display-4"></i>
                <h4 className="mt-3">Immutable journey</h4>
                <p className="mb-0 text-secondary">Each handoff is recorded on-chain and mirrored in MongoDB for fast application access.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-4">
          {[
            ["bi-person-badge", "Farmer", "Create products and dispatch them to distributors."],
            ["bi-truck", "Distributor", "Receive from farmers and dispatch to retailers."],
            ["bi-shop", "Retailer", "Receive products and record consumer sales."],
            ["bi-qr-code-scan", "Consumer", "Scan a QR code and verify the full journey."]
          ].map(([icon, title, text]) => (
            <div className="col-md-6 col-lg-3" key={title}>
              <div className="card h-100 border-0 shadow-sm p-3">
                <i className={`${icon} fs-1 text-success`}></i>
                <h5 className="fw-bold mt-3">{title}</h5>
                <p className="text-secondary">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

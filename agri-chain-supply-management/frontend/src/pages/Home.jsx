// Path: frontend/src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

export default function Home() {
  const { isDemoMode, currentPersona } = useWallet();

  return (
    <div>
      {/* Hero Section */}
      <section className="agri-hero">
        <div className="container py-5">
          <div className="row align-items-center py-4">
            <div className="col-lg-7">
              <div className="hero-pill">
                <i className="bi bi-shield-check"></i>
                Cloud Computing Capstone • Transparent Agricultural Provenance
              </div>
              <h1 className="display-4 fw-bold mb-3 tracking-tight">
                From Farm to Consumer, Every Agricultural Step Verified.
              </h1>
              <p className="lead text-white-50 mb-4 fs-5">
                A production-style supply chain platform bridging farmers, cold-chain distributors,
                supermarkets, and consumers using cloud-native compute, enterprise storage, and
                decentralized smart contracts.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <Link to="/dashboard" className="btn btn-success btn-lg px-4 fw-semibold rounded-pill">
                  <i className="bi bi-grid-1x2 me-2"></i>Open Operations Dashboard
                </Link>
                <Link to="/trace" className="btn btn-outline-light btn-lg px-4 fw-semibold rounded-pill">
                  <i className="bi bi-search me-2"></i>Trace a Product Batch
                </Link>
                <Link to="/login" className="btn btn-outline-light btn-lg px-4 fw-semibold rounded-pill">
                  <i className="bi bi-box-arrow-in-right me-2"></i>Portal Login
                </Link>
                <Link to="/cloud-architecture" className="btn btn-outline-light btn-lg px-4 fw-semibold rounded-pill">
                  <i className="bi bi-cloud-check me-2"></i>View AWS Architecture
                </Link>
              </div>
            </div>

            <div className="col-lg-5 mt-5 mt-lg-0">
              <div className="agri-card p-4 shadow-lg border-0 bg-white text-dark">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                    <i className="bi bi-record-circle me-1"></i>Live Ledger Mirror
                  </span>
                  <span className="small text-muted font-monospace">Sepolia • AWS Ready</span>
                </div>

                <h4 className="fw-bold mb-2">Cryptographic Transparency</h4>
                <p className="text-secondary small mb-3">
                  Each physical handoff in the agricultural supply chain generates an immutable cryptographic signature.
                  Consumers and retailers can independently audit origin certificates, harvest dates, and storage temperatures.
                </p>

                <div className="p-3 bg-light rounded-3 mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small fw-semibold text-dark">Sample Active Batch:</span>
                    <span className="badge bg-dark font-monospace">#101</span>
                  </div>
                  <div className="small text-success fw-bold">Organic Honeycrisp Apples</div>
                  <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                    Yakima Valley, WA ➔ Seattle Cold Logistics ➔ FreshMarket #104 ➔ Consumer
                  </div>
                </div>

                <Link to="/trace/101" className="btn btn-outline-success w-100 btn-sm fw-semibold">
                  Inspect Verified Batch Journey <i className="bi bi-arrow-right ms-1"></i>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Supply Chain Pillars */}
      <section className="container py-5">
        <div className="text-center max-w-700 mx-auto mb-5">
          <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 mb-2">
            Stakeholder Ecosystem
          </span>
          <h2 className="fw-bold">Seamless Multi-Stakeholder Coordination</h2>
          <p className="text-secondary small">
            Designed to reflect real agricultural logistics: from crop registration in the fields to retail shelf scanning.
          </p>
        </div>

        <div className="row g-4">
          {[
            {
              icon: "bi-person-badge",
              role: "1. Farmer",
              title: "Harvest & Genesis",
              desc: "Registers crop batches, harvest timestamps, agronomic quality grades, and dispatches to cold-chain carriers."
            },
            {
              icon: "bi-truck",
              role: "2. Distributor",
              title: "Cold-Chain Logistics",
              desc: "Receives freight from growers, logs refrigerated transit conditions, and manages distribution hub fulfillment."
            },
            {
              icon: "bi-shop",
              role: "3. Retailer",
              title: "Retail & Supermarkets",
              desc: "Receives shipments into supermarket inventory, validates origin certificates, and records point-of-sale checkout."
            },
            {
              icon: "bi-qr-code-scan",
              role: "4. Consumer",
              title: "Consumer Verification",
              desc: "Scans product QR codes in-store or at home to discover the complete, verified journey from soil to table."
            }
          ].map((item) => (
            <div className="col-md-6 col-lg-3" key={item.role}>
              <div className="agri-card h-100 p-4 d-flex flex-column">
                <div className="kpi-icon-wrapper bg-success-subtle text-success mb-3">
                  <i className={`bi ${item.icon} fs-4`}></i>
                </div>
                <span className="badge bg-light text-dark border mb-2 align-self-start">{item.role}</span>
                <h5 className="fw-bold mb-2">{item.title}</h5>
                <p className="text-secondary small mb-3 flex-grow-1">{item.desc}</p>
                <Link to="/login" className="btn btn-outline-success btn-sm w-100 fw-semibold">
                  Enter Portal <i className="bi bi-box-arrow-in-right ms-1"></i>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cloud & Technology Highlights */}
      <section className="bg-light py-5 border-top border-bottom">
        <div className="container py-4">
          <div className="row align-items-center g-4">
            <div className="col-lg-6">
              <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 mb-2">
                Cloud Computing Integration
              </span>
              <h2 className="fw-bold mb-3">Engineered for Scalable AWS Cloud Deployment</h2>
              <p className="text-secondary">
                Designed to operate under strict enterprise cloud architectures with minimal cost overhead:
              </p>
              <ul className="text-secondary small ps-3">
                <li className="mb-2">
                  <strong>Global Edge Distribution:</strong> Amazon CloudFront edge nodes deliver client assets with sub-50ms latency.
                </li>
                <li className="mb-2">
                  <strong>Elastic Container Compute:</strong> Dockerized Express backend deployable to AWS App Runner or Amazon EC2.
                </li>
                <li className="mb-2">
                  <strong>Zero-Config Fault Tolerance:</strong> Seamlessly transitions between MongoDB Atlas on AWS and local embedded fallback.
                </li>
                <li>
                  <strong>Enterprise Security:</strong> Strict IAM roles, private S3 Origin Access Control, and encrypted communication.
                </li>
              </ul>
              <Link to="/cloud-architecture" className="btn btn-success fw-semibold mt-2">
                Explore Cloud Architecture Specification <i className="bi bi-arrow-right ms-1"></i>
              </Link>
            </div>

            <div className="col-lg-6">
              <div className="agri-card p-4">
                <h6 className="fw-bold mb-3 text-dark">
                  <i className="bi bi-cpu-fill text-success me-2"></i>Cloud System Specifications
                </h6>
                <div className="table-responsive small">
                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      <tr>
                        <td className="text-muted">Hosting Tier:</td>
                        <td className="fw-bold text-dark">Amazon S3 + CloudFront CDN</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Compute Tier:</td>
                        <td className="fw-bold text-dark">AWS App Runner / Amazon EC2 (Node.js 20 LTS)</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Database:</td>
                        <td className="fw-bold text-dark">MongoDB / AWS DocumentDB</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Consensus Ledger:</td>
                        <td className="fw-bold text-dark">Ethereum Sepolia Testnet (EVM)</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Smart Contract:</td>
                        <td className="font-monospace text-success">0xB601...9a2D</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Deployment Cost:</td>
                        <td className="fw-bold text-success">$0.00 / mo (100% AWS Free Tier Eligible)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

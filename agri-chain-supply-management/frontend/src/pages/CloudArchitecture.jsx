// Path: frontend/src/pages/CloudArchitecture.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function CloudArchitecture() {
  const [healthData, setHealthData] = useState(null);
  const [latency, setLatency] = useState(null);
  const [loading, setLoading] = useState(false);

  async function checkLiveHealth() {
    setLoading(true);
    const start = performance.now();
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const res = await axios.get(`${apiUrl}/health`);
      const elapsed = Math.round(performance.now() - start);
      setHealthData(res.data);
      setLatency(elapsed);
    } catch (err) {
      setHealthData({ status: "error", message: err.message });
      setLatency(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkLiveHealth();
  }, []);

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="mb-4">
        <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 mb-2">
          <i className="bi bi-cloud-arrow-up-fill me-1"></i>University Cloud Computing Review
        </span>
        <h1 className="fw-bold tracking-tight mb-2">AWS Cloud Architecture & Infrastructure</h1>
        <p className="text-secondary lead fs-6">
          Production topology, service roles, deployment pipelines, and cost-conscious engineering
          for the Agriculture Supply Chain platform.
        </p>
      </div>

      {/* Live Cloud Health Monitor Card */}
      <div className="agri-card mb-5">
        <div className="agri-card-header bg-light">
          <div className="d-flex align-items-center gap-2">
            <span className="badge rounded-circle bg-success p-2"></span>
            <h6 className="fw-bold mb-0">Live Cloud Backend Health & Telemetry</h6>
          </div>
          <button
            className="btn btn-sm btn-outline-success"
            onClick={checkLiveHealth}
            disabled={loading}
          >
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? "spin" : ""}`}></i>
            {loading ? "Probing..." : "Test Health Probe"}
          </button>
        </div>
        <div className="agri-card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <div className="p-3 bg-light rounded-3">
                <div className="small text-muted">Probe Status</div>
                <div className="fw-bold text-success fs-5">
                  {healthData?.status === "healthy" ? "HEALTHY (200 OK)" : "PENDING PROBE"}
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="p-3 bg-light rounded-3">
                <div className="small text-muted">API Round-Trip Latency</div>
                <div className="fw-bold text-primary fs-5">
                  {latency !== null ? `${latency} ms` : "—"}
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="p-3 bg-light rounded-3">
                <div className="small text-muted">Active Database Layer</div>
                <div className="fw-bold text-dark fs-5">
                  {healthData?.database || "Detecting..."}
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="p-3 bg-light rounded-3">
                <div className="small text-muted">Target Environment</div>
                <div className="fw-bold text-dark fs-5">
                  {healthData?.environment ? healthData.environment.toUpperCase() : "AWS CLOUD READY"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Topology Breakdown */}
      <div className="row g-4 mb-5">
        <div className="col-lg-12">
          <div className="agri-card">
            <div className="agri-card-header">
              <h5 className="fw-bold mb-0">
                <i className="bi bi-diagram-3-fill text-success me-2"></i>
                End-to-End Cloud Services Topology
              </h5>
            </div>
            <div className="agri-card-body">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "220px" }}>AWS Service</th>
                      <th style={{ width: "160px" }}>Tier / Component</th>
                      <th>Operational Purpose & Architecture Rationale</th>
                      <th style={{ width: "160px" }}>Cost Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong className="d-block text-dark">Amazon CloudFront</strong>
                        <span className="small text-muted">Global Content Delivery</span>
                      </td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                          Edge CDN
                        </span>
                      </td>
                      <td className="small text-secondary">
                        Serves global HTTPS requests, terminates TLS at edge points of presence (PoPs),
                        and manages SPA routing rules (forwarding 404/403 to <code>index.html</code>).
                      </td>
                      <td><span className="badge bg-light text-dark">Free Tier (1 TB/mo)</span></td>
                    </tr>
                    <tr>
                      <td>
                        <strong className="d-block text-dark">Amazon S3</strong>
                        <span className="small text-muted">Object Storage</span>
                      </td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                          Static Frontend
                        </span>
                      </td>
                      <td className="small text-secondary">
                        Hosts production Vite React bundles with Origin Access Control (OAC). Direct public
                        access is completely blocked, enforcing secure CloudFront-only delivery.
                      </td>
                      <td><span className="badge bg-light text-dark">Free Tier (5 GB storage)</span></td>
                    </tr>
                    <tr>
                      <td>
                        <strong className="d-block text-dark">AWS App Runner / EC2</strong>
                        <span className="small text-muted">Elastic Compute</span>
                      </td>
                      <td>
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          Containerized API
                        </span>
                      </td>
                      <td className="small text-secondary">
                        Executes multi-stage Dockerized Express API container. Automatically scales compute
                        instances based on incoming HTTP concurrency, with built-in health probes on <code>/api/health</code>.
                      </td>
                      <td><span className="badge bg-light text-dark">Free Tier (750 hrs/mo)</span></td>
                    </tr>
                    <tr>
                      <td>
                        <strong className="d-block text-dark">Amazon DocumentDB / Atlas</strong>
                        <span className="small text-muted">Managed NoSQL</span>
                      </td>
                      <td>
                        <span className="badge bg-warning-subtle text-dark border border-warning-subtle">
                          Persistence Tier
                        </span>
                      </td>
                      <td className="small text-secondary">
                        Provides scalable, highly available BSON storage for product batches, state machine histories,
                        and telemetry indexes with automated snapshots and VPC peering.
                      </td>
                      <td><span className="badge bg-light text-dark">Free M0 / Free Tier</span></td>
                    </tr>
                    <tr>
                      <td>
                        <strong className="d-block text-dark">AWS IAM</strong>
                        <span className="small text-muted">Identity & Access</span>
                      </td>
                      <td>
                        <span className="badge bg-secondary-subtle text-secondary border">
                          Security & RBAC
                        </span>
                      </td>
                      <td className="small text-secondary">
                        Enforces least-privilege execution roles for App Runner, S3 bucket deployment, and
                        container registries. Eliminates hardcoded long-lived credentials.
                      </td>
                      <td><span className="badge bg-light text-dark">$0.00 / Always Free</span></td>
                    </tr>
                    <tr>
                      <td>
                        <strong className="d-block text-dark">Amazon CloudWatch</strong>
                        <span className="small text-muted">Telemetry & Logs</span>
                      </td>
                      <td>
                        <span className="badge bg-info-subtle text-info border border-info-subtle">
                          Observability
                        </span>
                      </td>
                      <td className="small text-secondary">
                        Aggregates container stdout/stderr log streams, monitors API request latency metrics,
                        and provides automated alerts on 5xx error spikes or latency degradations.
                      </td>
                      <td><span className="badge bg-light text-dark">Free Tier (5 GB logs)</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Cost Engineering */}
      <div className="row g-4">
        <div className="col-md-6">
          <div className="agri-card h-100">
            <div className="agri-card-header">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-shield-check text-success me-2"></i>
                Cloud Security Considerations
              </h6>
            </div>
            <div className="agri-card-body small text-secondary">
              <ul className="mb-0 ps-3">
                <li className="mb-2">
                  <strong>Zero Hardcoded Credentials:</strong> All blockchain RPC keys and database connection strings are injected via environment variables or AWS Secrets Manager.
                </li>
                <li className="mb-2">
                  <strong>Private Storage Enclosure:</strong> Amazon S3 bucket public access is disabled; CloudFront OAC authenticates requests.
                </li>
                <li className="mb-2">
                  <strong>Transport Layer Security:</strong> All traffic is enforced over HTTPS (TLS 1.3) with HSTS headers enabled.
                </li>
                <li>
                  <strong>Input Sanitization & Schema Validation:</strong> Server-side <code>express-validator</code> verifies Ethereum address regex patterns and dates before database writes.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="agri-card h-100">
            <div className="agri-card-header">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-piggy-bank text-warning me-2"></i>
                Cost-Conscious Deployment Strategy
              </h6>
            </div>
            <div className="agri-card-body small text-secondary">
              <ul className="mb-0 ps-3">
                <li className="mb-2">
                  <strong>100% Free Tier Deployable:</strong> S3 (5 GB), CloudFront (1 TB/mo), and EC2/App Runner fall squarely within AWS Free Tier allowances.
                </li>
                <li className="mb-2">
                  <strong>Automatic Scale to Zero:</strong> AWS App Runner pauses container instances during idle presentation periods to prevent unnecessary billing.
                </li>
                <li className="mb-2">
                  <strong>Zero-Config Academic Fallback:</strong> The application automatically enables an in-memory/embedded local store if external cloud database credits expire or are unavailable.
                </li>
                <li>
                  <strong>Estimated Cloud Run Rate:</strong> <strong>$0.00 / month</strong> on standard Free Tier.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

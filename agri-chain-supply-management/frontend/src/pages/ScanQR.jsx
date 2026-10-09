// Path: frontend/src/pages/ScanQR.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { getProducts } from "../services/api";

export default function ScanQR() {
  const scannerRef = useRef(null);
  const [error, setError] = useState("");
  const [manualId, setManualId] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getProducts()
      .then((data) => setCatalog(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    async function start() {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
          setError("No video camera hardware detected. You can select a sample batch below or enter the ID manually.");
          setCameraActive(false);
          return;
        }

        const cameraId = cameras[0].id;
        setCameraActive(true);
        await scanner.start(
          cameraId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            try {
              const data = JSON.parse(decodedText);
              if (!data.productId) throw new Error("QR does not contain a Product ID.");
              await scanner.stop();
              navigate(`/trace/${data.productId}`);
            } catch {
              // Check if raw numeric ID
              if (/^\d+$/.test(decodedText.trim())) {
                await scanner.stop();
                navigate(`/trace/${decodedText.trim()}`);
              } else {
                setError("Unrecognized agricultural batch QR format.");
              }
            }
          },
          () => {}
        );
      } catch (err) {
        setError(err.message || "Unable to access camera. Check browser permissions.");
        setCameraActive(false);
      }
    }

    start();

    return () => {
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [navigate]);

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualId.trim()) {
      navigate(`/trace/${manualId.trim()}`);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-7">
          <div className="agri-card">
            <div className="agri-card-header bg-light">
              <div>
                <span className="badge bg-success-subtle text-success border border-success-subtle mb-1">
                  <i className="bi bi-qr-code-scan me-1"></i>Mobile Scanner & Optical Lookup
                </span>
                <h4 className="fw-bold mb-0">Scan Agricultural Batch QR Code</h4>
              </div>
            </div>

            <div className="agri-card-body p-4">
              <p className="text-secondary small mb-3">
                Point your mobile or desktop webcam at the product QR code printed on the shipping crate
                or supermarket packaging.
              </p>

              {/* Camera Scanner Viewport */}
              <div
                id="qr-reader"
                className="rounded-3 overflow-hidden border bg-dark mb-3"
                style={{ minHeight: "260px" }}
              ></div>

              {error && (
                <div className="alert alert-warning small mb-3 border">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                </div>
              )}

              {/* Manual Lookup Option */}
              <div className="border-top pt-3 mt-4">
                <h6 className="fw-bold text-dark small mb-2">Or Enter Batch ID Manually:</h6>
                <form onSubmit={handleManualSubmit} className="input-group mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter Batch ID (e.g. 101)"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value.replace(/\D/g, ""))}
                  />
                  <button className="btn btn-success" type="submit" disabled={!manualId.trim()}>
                    Trace Batch
                  </button>
                </form>

                {/* Instant Sample Batch Simulation Links */}
                {catalog.length > 0 && (
                  <div className="p-3 bg-light rounded-3">
                    <span className="small fw-semibold text-secondary d-block mb-2">
                      <i className="bi bi-lightning-charge text-warning me-1"></i>
                      Simulate Scan with Active Batches:
                    </span>
                    <div className="d-flex flex-wrap gap-2">
                      {catalog.slice(0, 4).map((p) => (
                        <button
                          key={p.productId}
                          className="btn btn-sm btn-outline-dark"
                          onClick={() => navigate(`/trace/${p.productId}`)}
                        >
                          #{p.productId} • {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

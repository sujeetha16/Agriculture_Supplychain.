// Path: frontend/src/pages/ScanQR.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";

export default function ScanQR() {
  const scannerRef = useRef(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    async function start() {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) throw new Error("No camera was found.");

        const cameraId = cameras[0].id;
        await scanner.start(
          cameraId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            try {
              const data = JSON.parse(decodedText);
              if (!data.productId) throw new Error("QR code does not contain a Product ID.");
              await scanner.stop();
              navigate(`/trace/${data.productId}`);
            } catch {
              setError("Invalid AgriChain QR code.");
            }
          },
          () => {}
        );
      } catch (err) {
        setError(err.message || "Unable to start camera. Check browser camera permission.");
      }
    }

    start();

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [navigate]);

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="fw-bold">Scan Product QR</h2>
              <p className="text-secondary">Allow camera access and point it at an AgriChain QR code.</p>
              <div id="qr-reader" className="rounded overflow-hidden"></div>
              {error && <div className="alert alert-danger mt-3">{error}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Path: frontend/src/pages/ScanQR.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { getProducts } from "../services/api";

export default function ScanQR() {
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Mode: "instant" (default) | "upload" | "webcam"
  const [activeTab, setActiveTab] = useState("instant");

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // File upload state
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedFilePreview, setSelectedFilePreview] = useState(null);

  // Manual batch lookup
  const [manualId, setManualId] = useState("");

  // Catalog batches
  const [catalog, setCatalog] = useState([]);
  const [scanningBatchId, setScanningBatchId] = useState(null);

  useEffect(() => {
    getProducts()
      .then((data) => {
        if (data && data.length > 0) {
          setCatalog(data);
        } else {
          setCatalog([
            { productId: 101, name: "Organic Honeycrisp Apples", farmLocation: "Yakima Valley, WA", status: "HarvestRegistered" },
            { productId: 102, name: "Fresh Valencia Oranges", farmLocation: "Citrus Belt, CA", status: "InDistributionTransit" },
            { productId: 8801, name: "Verified Gala Apples", farmLocation: "Wenatchee, WA", status: "RetailDelivered" }
          ]);
        }
      })
      .catch(() => {
        setCatalog([
          { productId: 101, name: "Organic Honeycrisp Apples", farmLocation: "Yakima Valley, WA", status: "HarvestRegistered" },
          { productId: 102, name: "Fresh Valencia Oranges", farmLocation: "Citrus Belt, CA", status: "InDistributionTransit" },
          { productId: 8801, name: "Verified Gala Apples", farmLocation: "Wenatchee, WA", status: "RetailDelivered" }
        ]);
      });

    return () => {
      stopCamera();
    };
  }, []);

  function handleDecodedText(decodedText) {
    if (!decodedText) return;

    try {
      const data = JSON.parse(decodedText);
      if (data.productId) {
        stopCamera();
        navigate(`/trace/${data.productId}`);
        return;
      }
    } catch {}

    const urlMatch = decodedText.match(/\/trace\/(\d+)/i);
    if (urlMatch && urlMatch[1]) {
      stopCamera();
      navigate(`/trace/${urlMatch[1]}`);
      return;
    }

    const numMatch = decodedText.trim().match(/^#?(\d+)$/);
    if (numMatch && numMatch[1]) {
      stopCamera();
      navigate(`/trace/${numMatch[1]}`);
      return;
    }

    setCameraError(`Unrecognized QR code content: "${decodedText.slice(0, 45)}...".`);
  }

  async function startCamera() {
    setCameraError("");
    setIsPermissionDenied(false);
    setCameraStarting(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam is not supported in this browser environment.");
      }

      // Explicitly trigger the browser's native permission prompt
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        testStream.getTracks().forEach((track) => track.stop());
      } catch (promptErr) {
        throw promptErr;
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-camera-viewport");
      }
      const scanner = scannerRef.current;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => handleDecodedText(text),
          () => {}
        );
      } catch {
        await scanner.start(
          { facingMode: "user" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => handleDecodedText(text),
          () => {}
        );
      }

      setCameraActive(true);
      setCameraStarting(false);
    } catch (err) {
      setCameraActive(false);
      setCameraStarting(false);
      const msg = err?.message || String(err);
      if (
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("notallowed") ||
        err?.name === "NotAllowedError"
      ) {
        setIsPermissionDenied(true);
        setCameraError("Webcam permission is currently blocked in your browser.");
      } else if (err?.name === "NotFoundError" || msg.toLowerCase().includes("not found")) {
        setCameraError("No webcam hardware was detected on your computer.");
      } else {
        setCameraError(msg || "Could not access camera. Please check your browser settings.");
      }
    }
  }

  async function stopCamera() {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {}
    setCameraActive(false);
    setCameraStarting(false);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setIsProcessingFile(true);

    const previewUrl = URL.createObjectURL(file);
    setSelectedFilePreview(previewUrl);

    try {
      await stopCamera();

      const html5QrCode = new Html5Qrcode("qr-temp-decoder");
      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      setIsProcessingFile(false);
      handleDecodedText(decodedText);
    } catch {
      setIsProcessingFile(false);
      setUploadError("Could not detect a valid QR code in this image. Please upload a clear photo of an AgriChain batch QR code.");
    }
  }

  function handleSimulateOpticalScan(productId) {
    setScanningBatchId(productId);
    setTimeout(() => {
      navigate(`/trace/${productId}`);
    }, 400);
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualId.trim()) {
      navigate(`/trace/${manualId.trim()}`);
    }
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-9">
          <div className="agri-card shadow-sm border-0">
            {/* Header */}
            <div className="agri-card-header bg-white border-bottom p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <div className="brand-icon-box bg-success text-white" style={{ width: "38px", height: "38px", borderRadius: "10px" }}>
                  <i className="bi bi-qr-code-scan fs-5"></i>
                </div>
                <div>
                  <h5 className="fw-bold mb-0 text-dark">AgriChain QR Provenance Scanner</h5>
                  <span className="small text-muted">Scan, upload, or select an agricultural batch to verify provenance</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="btn-group btn-group-sm p-1 bg-light rounded-pill border">
                <button
                  type="button"
                  className={`btn rounded-pill px-3 fw-semibold ${activeTab === "instant" ? "btn-success shadow-sm" : "btn-light text-secondary"}`}
                  onClick={() => {
                    setActiveTab("instant");
                    stopCamera();
                  }}
                >
                  <i className="bi bi-lightning-charge-fill text-warning me-1"></i>Active Batches
                </button>
                <button
                  type="button"
                  className={`btn rounded-pill px-3 fw-semibold ${activeTab === "upload" ? "btn-success shadow-sm" : "btn-light text-secondary"}`}
                  onClick={() => {
                    setActiveTab("upload");
                    stopCamera();
                  }}
                >
                  <i className="bi bi-image me-1"></i>Upload QR Image
                </button>
                <button
                  type="button"
                  className={`btn rounded-pill px-3 fw-semibold ${activeTab === "webcam" ? "btn-success shadow-sm" : "btn-light text-secondary"}`}
                  onClick={() => setActiveTab("webcam")}
                >
                  <i className="bi bi-camera-video me-1"></i>Webcam
                </button>
              </div>
            </div>

            <div className="agri-card-body p-4">
              {/* Quick Manual Search Bar (Always Visible at Top) */}
              <div className="p-3 bg-light rounded-3 mb-4 border">
                <form onSubmit={handleManualSubmit} className="row g-2 align-items-center">
                  <div className="col-sm-8 col-md-9">
                    <div className="input-group">
                      <span className="input-group-text bg-white border-end-0">
                        <i className="bi bi-search text-muted"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control border-start-0"
                        placeholder="Enter Batch ID directly (e.g. 101, 102, 8801, 9088)..."
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </div>
                  <div className="col-sm-4 col-md-3">
                    <button className="btn btn-success w-100 fw-semibold" type="submit" disabled={!manualId.trim()}>
                      Trace Batch
                    </button>
                  </div>
                </form>
              </div>

              {/* ======================================================== */}
              {/* TAB 1: ACTIVE BATCHES & INSTANT OPTICAL SCANNER (DEFAULT) */}
              {/* ======================================================== */}
              {activeTab === "instant" && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                      <h6 className="fw-bold mb-0 text-dark">
                        <i className="bi bi-qr-code me-2 text-success"></i>Available Batch QR Codes
                      </h6>
                      <span className="small text-muted">
                        Click "Scan Batch QR" on any product below to simulate an optical scan and view its blockchain journey.
                      </span>
                    </div>
                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                      {catalog.length} Batches Registered
                    </span>
                  </div>

                  <div className="row g-3">
                    {catalog.map((product) => {
                      const isScanningThis = scanningBatchId === product.productId;
                      return (
                        <div className="col-md-6" key={product.productId}>
                          <div className={`p-3 border rounded-3 bg-white h-100 shadow-sm transition position-relative ${isScanningThis ? "border-success bg-success-subtle bg-opacity-25" : ""}`}>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <span className="badge bg-dark font-monospace">Batch #{product.productId}</span>
                              <span className="badge bg-success-subtle text-success border border-success-subtle small">
                                {product.status || "Active Ledger Batch"}
                              </span>
                            </div>

                            <h6 className="fw-bold text-dark mb-1">{product.name}</h6>
                            <div className="small text-muted mb-3">
                              <i className="bi bi-geo-alt me-1 text-danger"></i>{product.farmLocation || "Origin Farm"}
                            </div>

                            {/* QR Code and Action Button */}
                            <div className="d-flex align-items-center gap-3 pt-2 border-top">
                              <div className="p-2 bg-white border rounded shadow-sm position-relative">
                                <QRCodeSVG
                                  value={JSON.stringify({
                                    productId: product.productId,
                                    name: product.name,
                                    verificationStatus: "CONFIRMED_ON_CHAIN"
                                  })}
                                  size={78}
                                  level="M"
                                />
                                {isScanningThis && (
                                  <div
                                    className="position-absolute top-0 start-0 w-100 bg-success bg-opacity-50"
                                    style={{ height: "4px", animation: "pulse 0.4s infinite" }}
                                  ></div>
                                )}
                              </div>

                              <div className="flex-grow-1">
                                <button
                                  type="button"
                                  className={`btn w-100 fw-semibold rounded-pill ${isScanningThis ? "btn-success" : "btn-outline-success"}`}
                                  onClick={() => handleSimulateOpticalScan(product.productId)}
                                  disabled={Boolean(scanningBatchId)}
                                >
                                  <i className={`bi ${isScanningThis ? "bi-arrow-clockwise spin" : "bi-qr-code-scan"} me-1`}></i>
                                  {isScanningThis ? "Scanning..." : "Scan Batch QR"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 2: UPLOAD QR IMAGE                                    */}
              {/* ======================================================== */}
              {activeTab === "upload" && (
                <div>
                  <h6 className="fw-bold text-dark mb-1">
                    <i className="bi bi-cloud-arrow-up-fill text-success me-2"></i>Upload QR Code Photo or File
                  </h6>
                  <p className="text-secondary small mb-3">
                    Select any photo, packaging image, or screenshot of an AgriChain batch QR code from your computer.
                  </p>

                  <div
                    className="border border-2 border-dashed rounded-3 p-5 text-center mb-3 bg-light"
                    style={{ cursor: "pointer" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />

                    {selectedFilePreview ? (
                      <div>
                        <img
                          src={selectedFilePreview}
                          alt="QR Preview"
                          className="img-fluid rounded border mb-2 shadow-sm"
                          style={{ maxHeight: "180px" }}
                        />
                        <div className="small text-muted">
                          {isProcessingFile ? "Decoding QR code..." : "Click to select a different image"}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <i className="bi bi-file-earmark-image text-success fs-1 d-block mb-2"></i>
                        <h6 className="fw-bold mb-1 text-dark">Click to Choose QR Image File</h6>
                        <span className="text-muted small">Supports JPG, PNG, WEBP, and QR screenshots</span>
                      </div>
                    )}
                  </div>

                  {uploadError && (
                    <div className="alert alert-warning small mb-3 border">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      {uploadError}
                    </div>
                  )}

                  <div id="qr-temp-decoder" style={{ display: "none" }}></div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 3: WEBCAM SCANNER (OPTIONAL)                         */}
              {/* ======================================================== */}
              {activeTab === "webcam" && (
                <div>
                  <h6 className="fw-bold text-dark mb-1">
                    <i className="bi bi-camera-video-fill text-success me-2"></i>Live Webcam Scanner
                  </h6>
                  <p className="text-secondary small mb-3">
                    Use your desktop or laptop webcam to scan a physical printed QR code.
                  </p>

                  <div
                    id="qr-camera-viewport"
                    className="rounded-3 overflow-hidden border bg-dark mb-3 position-relative d-flex align-items-center justify-content-center text-center p-3"
                    style={{ minHeight: "260px" }}
                  >
                    {!cameraActive && (
                      <div className="text-white-50 p-4">
                        <i className="bi bi-camera-video fs-1 d-block mb-2 text-white"></i>
                        <h6 className="text-white fw-bold mb-1">Camera Standby</h6>
                        <p className="small mb-3" style={{ maxWidth: "340px" }}>
                          Click the button below to turn on the camera.
                        </p>
                        <button
                          type="button"
                          className="btn btn-success fw-semibold px-4 rounded-pill shadow-sm"
                          onClick={startCamera}
                          disabled={cameraStarting}
                        >
                          <i className={`bi ${cameraStarting ? "bi-arrow-clockwise spin" : "bi-camera-video-fill"} me-2`}></i>
                          {cameraStarting ? "Starting Camera..." : "Turn On Webcam"}
                        </button>
                      </div>
                    )}
                  </div>

                  {cameraActive && (
                    <div className="d-flex justify-content-between align-items-center mb-3 p-2 bg-success-subtle rounded-3 border border-success-subtle">
                      <span className="small text-success fw-semibold">
                        <i className="bi bi-record-circle-fill text-danger me-1"></i>Webcam Live — Hold QR code in front of camera
                      </span>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={stopCamera}>
                        Stop Camera
                      </button>
                    </div>
                  )}

                  {isPermissionDenied && (
                    <div className="card border-warning bg-warning bg-opacity-10 p-3 mb-3">
                      <div className="d-flex align-items-start gap-3">
                        <i className="bi bi-camera-video-off text-danger fs-3 mt-1"></i>
                        <div>
                          <h6 className="fw-bold text-dark mb-1">
                            Why was this blocked and how do you enable permission?
                          </h6>
                          <p className="small text-secondary mb-2">
                            Browsers (Chrome, Edge, Firefox) strictly block camera access to protect user privacy. A website cannot turn on your camera automatically without your browser's permission.
                          </p>

                          <div className="p-3 bg-white rounded border small mb-3">
                            <strong className="text-dark d-block mb-1">
                              How to allow your camera in 3 quick clicks:
                            </strong>
                            <ol className="mb-0 ps-3">
                              <li className="mb-1">
                                Look at your browser's top address bar where it says <code>http://localhost:5173</code>.
                              </li>
                              <li className="mb-1">
                                Click the <strong>Site Controls 🎚️</strong> or <strong>Padlock 🔒</strong> icon to the left of the URL.
                              </li>
                              <li className="mb-1">
                                Find <strong>Camera</strong> in the popup and toggle it to <strong>"Allow" / ON</strong>.
                              </li>
                              <li>
                                Click the green <strong>"Retry Webcam Now"</strong> button below!
                              </li>
                            </ol>
                          </div>

                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-success fw-semibold"
                              onClick={startCamera}
                            >
                              <i className="bi bi-arrow-clockwise me-1"></i>Retry Webcam Now
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-dark"
                              onClick={() => setActiveTab("instant")}
                            >
                              <i className="bi bi-lightning-charge me-1"></i>Use 1-Click Batch Cards Instead
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {cameraError && !isPermissionDenied && (
                    <div className="alert alert-warning small border mb-3">
                      <i className="bi bi-info-circle-fill me-2"></i>
                      {cameraError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

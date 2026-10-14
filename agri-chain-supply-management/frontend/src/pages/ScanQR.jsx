
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { getProducts } from "../services/api";
import { parseQRPayload } from "../utils/qrParser";

const FALLBACK_PRODUCTS = [
  {
    productId: 101,
    name: "Organic Honeycrisp Apples",
    farmLocation: "Yakima Valley, WA",
    status: "HarvestRegistered",
  },
  {
    productId: 102,
    name: "Fresh Valencia Oranges",
    farmLocation: "Citrus Belt, CA",
    status: "InDistributionTransit",
  },
  {
    productId: 8801,
    name: "Verified Gala Apples",
    farmLocation: "Wenatchee, WA",
    status: "RetailDelivered",
  },
];

export default function ScanQR() {
  const navigate = useNavigate();

  const scannerRef = useRef(null);
  const cameraStartingRef = useRef(false);
  const stoppingRef = useRef(false);
  const decodedRef = useRef(false);
  const mountedRef = useRef(false);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef(null);

  const [activeTab, setActiveTab] = useState("instant");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [catalog, setCatalog] = useState([]);
  const [manualId, setManualId] = useState("");
  const [scanningBatchId, setScanningBatchId] = useState(null);

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedFilePreview, setSelectedFilePreview] = useState(null);

  // Load products. Use sample batches if the API is unavailable or empty.
  useEffect(() => {
    let cancelled = false;

    getProducts()
      .then((data) => {
        if (cancelled) return;
        setCatalog(
          Array.isArray(data) && data.length > 0
            ? data
            : FALLBACK_PRODUCTS
        );
      })
      .catch(() => {
        if (!cancelled) setCatalog(FALLBACK_PRODUCTS);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Stop the scanner and release the camera.
  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      if (mountedRef.current) {
        setCameraActive(false);
        setCameraStarting(false);
      }
      return;
    }

    if (stoppingRef.current) return;
    stoppingRef.current = true;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (error) {
      console.warn("Could not stop QR scanner cleanly:", error);
    } finally {
      try {
        // This clears only the dedicated scanner container.
        scanner.clear();
      } catch (error) {
        console.warn("Could not clear QR scanner:", error);
      }

      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }

      stoppingRef.current = false;

      if (mountedRef.current) {
        setCameraActive(false);
        setCameraStarting(false);
      }
    }
  }, []);

  // Keep cleanup separate from the React-rendered scanner controls.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        void (async () => {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
          } catch (error) {
            console.warn("Scanner cleanup:", error);
          } finally {
            try {
              scanner.clear();
            } catch {
              // The component is already unmounting.
            }
          }
        })();
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const handleDecodedText = useCallback(
    async (decodedText) => {
      if (!decodedText || decodedRef.current) return;

      const result = parseQRPayload(decodedText);

      if (result.success && result.productId) {
        decodedRef.current = true;
        await stopCamera();
        navigate(`/trace/${result.productId}`);
        return;
      }

      setCameraError(
        result.error ||
          `Unrecognized QR code content: "${decodedText.slice(0, 45)}...".`
      );
    },
    [navigate, stopCamera]
  );

  // Start the camera only after the user clicks the button.
  async function startCamera() {
    if (cameraStartingRef.current || scannerRef.current?.isScanning) {
      return;
    }

    const viewport = document.getElementById("qr-camera-viewport");

    if (!viewport) {
      setCameraError(
        "The camera area is not ready. Switch to another tab and try again."
      );
      return;
    }

    cameraStartingRef.current = true;
    decodedRef.current = false;

    setCameraError("");
    setIsPermissionDenied(false);
    setCameraStarting(true);

    let scanner = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access is unavailable. Open this app on localhost or through HTTPS."
        );
      }

      // The library exclusively manages children of this empty container.
      viewport.replaceChildren();

      scanner = new Html5Qrcode("qr-camera-viewport");
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1,
      };

      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          (text) => void handleDecodedText(text),
          () => {}
        );
      } catch (rearCameraError) {
        // If the rear-facing camera is unavailable, try the front camera.
        if (rearCameraError?.name === "NotAllowedError") {
          throw rearCameraError;
        }

        if (scanner.isScanning) {
          await scanner.stop();
        }

        scanner.clear();
        viewport.replaceChildren();

        scanner = new Html5Qrcode("qr-camera-viewport");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "user" },
          config,
          (text) => void handleDecodedText(text),
          () => {}
        );
      }

      if (mountedRef.current) {
        setCameraActive(true);
        setCameraStarting(false);
      }
    } catch (error) {
      console.error("QR camera startup failed:", error);

      if (scanner) {
        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
        } catch {
          // Continue cleanup even if stopping fails.
        }

        try {
          scanner.clear();
        } catch {
          // Continue cleanup.
        }

        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }
      }

      if (mountedRef.current) {
        setCameraActive(false);
        setCameraStarting(false);

        const message = error?.message || String(error);

        if (
          error?.name === "NotAllowedError" ||
          error?.name === "PermissionDeniedError" ||
          message.toLowerCase().includes("permission")
        ) {
          setIsPermissionDenied(true);
          setCameraError(
            "Camera permission was denied. Allow camera access in your browser settings and retry."
          );
        } else if (
          error?.name === "NotFoundError" ||
          message.toLowerCase().includes("no camera")
        ) {
          setCameraError(
            "No available camera was found. Check that your webcam is connected."
          );
        } else {
          setCameraError(
            `${message}. Close other apps using the webcam and try again.`
          );
        }
      }
    } finally {
      cameraStartingRef.current = false;
    }
  }

  function switchTab(tab) {
    if (tab !== "webcam") {
      void stopCamera();
    }

    setCameraError("");
    setIsPermissionDenied(false);
    setActiveTab(tab);
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setIsProcessingFile(true);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setSelectedFilePreview(previewUrl);

    let decoder = null;

    try {
      await stopCamera();

      decoder = new Html5Qrcode("qr-temp-decoder");
      const decodedText = await decoder.scanFile(file, true);

      try {
        decoder.clear();
      } catch {
        // The decoder may already have cleared its temporary elements.
      }

      decoder = null;

      if (mountedRef.current) {
        setIsProcessingFile(false);
      }

      await handleDecodedText(decodedText);
    } catch (error) {
      console.error("QR image decoding failed:", error);

      if (decoder) {
        try {
          decoder.clear();
        } catch {
          // Ignore cleanup errors.
        }
      }

      if (mountedRef.current) {
        setIsProcessingFile(false);
        setUploadError(
          "Could not read a valid QR code from this image. Try a clearer, well-lit QR photo."
        );
      }
    } finally {
      // Allows selecting the same image again.
      if (event.target) event.target.value = "";
    }
  }

  function handleManualSubmit(event) {
    event.preventDefault();

    const id = manualId.trim();
    if (id) navigate(`/trace/${id}`);
  }

  function handleSimulateOpticalScan(productId) {
    setScanningBatchId(productId);
    navigate(`/trace/${productId}`);
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-9">
          <div className="agri-card shadow-sm border-0">
            <div className="agri-card-header bg-white border-bottom p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <div
                  className="brand-icon-box bg-success text-white"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <i className="bi bi-qr-code-scan fs-5" />
                </div>

                <div>
                  <h5 className="fw-bold mb-0 text-dark">
                    AgriChain QR Provenance Scanner
                  </h5>
                  <span className="small text-muted">
                    Scan, upload, or select an agricultural batch to verify
                    provenance
                  </span>
                </div>
              </div>

              <div className="btn-group btn-group-sm p-1 bg-light rounded-pill border">
                <button
                  type="button"
                  className={`btn rounded-pill px-3 fw-semibold ${
                    activeTab === "instant"
                      ? "btn-success shadow-sm"
                      : "btn-light text-secondary"
                  }`}
                  onClick={() => switchTab("instant")}
                >
                  <i className="bi bi-lightning-charge-fill text-warning me-1" />
                  Active Batches
                </button>

                <button
                  type="button"
                  className={`btn rounded-pill px-3 fw-semibold ${
                    activeTab === "upload"
                      ? "btn-success shadow-sm"
                      : "btn-light text-secondary"
                  }`}
                  onClick={() => switchTab("upload")}
                >
                  <i className="bi bi-image me-1" />
                  Upload QR Image
                </button>

                <button
                  type="button"
                  className={`btn rounded-pill px-3 fw-semibold ${
                    activeTab === "webcam"
                      ? "btn-success shadow-sm"
                      : "btn-light text-secondary"
                  }`}
                  onClick={() => switchTab("webcam")}
                >
                  <i className="bi bi-camera-video me-1" />
                  Webcam
                </button>
              </div>
            </div>

            <div className="agri-card-body p-4">
              <div className="p-3 bg-light rounded-3 mb-4 border">
                <form
                  onSubmit={handleManualSubmit}
                  className="row g-2 align-items-center"
                >
                  <div className="col-sm-8 col-md-9">
                    <div className="input-group">
                      <span className="input-group-text bg-white border-end-0">
                        <i className="bi bi-search text-muted" />
                      </span>
                      <input
                        type="text"
                        className="form-control border-start-0"
                        placeholder="Enter Batch ID (e.g. 101, 102, 8801)"
                        value={manualId}
                        onChange={(event) =>
                          setManualId(event.target.value.replace(/\D/g, ""))
                        }
                      />
                    </div>
                  </div>

                  <div className="col-sm-4 col-md-3">
                    <button
                      className="btn btn-success w-100 fw-semibold"
                      type="submit"
                      disabled={!manualId.trim()}
                    >
                      Trace Batch
                    </button>
                  </div>
                </form>
              </div>

              {activeTab === "instant" && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                      <h6 className="fw-bold mb-0 text-dark">
                        <i className="bi bi-qr-code me-2 text-success" />
                        Available Batch QR Codes
                      </h6>
                      <span className="small text-muted">
                        Select a batch to open its traceability record.
                      </span>
                    </div>

                    <span className="badge bg-success-subtle text-success border">
                      {catalog.length} Batches Registered
                    </span>
                  </div>

                  <div className="row g-3">
                    {catalog.map((product) => {
                      const id = product.productId ?? product._id;
                      const isScanningThis = scanningBatchId === id;

                      return (
                        <div className="col-md-6" key={String(id)}>
                          <div className="p-3 border rounded-3 bg-white h-100 shadow-sm">
                            <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
                              <span className="badge bg-dark font-monospace">
                                Batch #{id}
                              </span>
                              <span className="badge bg-success-subtle text-success border small">
                                {product.status || "Active Ledger Batch"}
                              </span>
                            </div>

                            <h6 className="fw-bold text-dark mb-1">
                              {product.name || product.productName || "Agricultural Product"}
                            </h6>

                            <div className="small text-muted mb-3">
                              <i className="bi bi-geo-alt me-1 text-danger" />
                              {product.farmLocation || product.origin || "Origin Farm"}
                            </div>

                            <div className="d-flex align-items-center gap-3 pt-2 border-top">
                              <div className="p-2 bg-white border rounded shadow-sm">
                                <QRCodeSVG
                                  value={JSON.stringify({
                                    productId: id,
                                    name: product.name || product.productName || "",
                                    verificationStatus: "CONFIRMED_ON_CHAIN",
                                  })}
                                  size={78}
                                  level="M"
                                />
                              </div>

                              <div className="flex-grow-1">
                                <button
                                  type="button"
                                  className={`btn w-100 fw-semibold rounded-pill ${
                                    isScanningThis
                                      ? "btn-success"
                                      : "btn-outline-success"
                                  }`}
                                  onClick={() => handleSimulateOpticalScan(id)}
                                >
                                  <i className="bi bi-qr-code-scan me-1" />
                                  Trace This Batch
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

              {activeTab === "upload" && (
                <div>
                  <h6 className="fw-bold text-dark mb-1">
                    <i className="bi bi-cloud-arrow-up-fill text-success me-2" />
                    Upload QR Code Photo or File
                  </h6>

                  <p className="text-secondary small mb-3">
                    Select a photo, packaging image, or screenshot containing
                    an AgriChain batch QR code.
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
                          alt="Selected QR preview"
                          className="img-fluid rounded border mb-2 shadow-sm"
                          style={{ maxHeight: 180 }}
                        />
                        <div className="small text-muted">
                          {isProcessingFile
                            ? "Decoding QR code..."
                            : "Click to choose a different image"}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <i className="bi bi-file-earmark-image text-success fs-1 d-block mb-2" />
                        <h6 className="fw-bold mb-1 text-dark">
                          Click to Choose QR Image File
                        </h6>
                        <span className="text-muted small">
                          Supports JPG, PNG, WEBP, and QR screenshots
                        </span>
                      </div>
                    )}
                  </div>

                  {isProcessingFile && (
                    <div className="small text-muted mb-3">
                      <span className="spinner-border spinner-border-sm me-2" />
                      Reading image...
                    </div>
                  )}

                  {uploadError && (
                    <div className="alert alert-warning small mb-3 border">
                      <i className="bi bi-exclamation-triangle-fill me-2" />
                      {uploadError}
                    </div>
                  )}

                  <div
                    id="qr-temp-decoder"
                    style={{ position: "absolute", left: "-10000px", top: 0 }}
                    aria-hidden="true"
                  />
                </div>
              )}

              {activeTab === "webcam" && (
                <div>
                  <h6 className="fw-bold text-dark mb-1">
                    <i className="bi bi-camera-video-fill text-success me-2" />
                    Live Webcam Scanner
                  </h6>

                  <p className="text-secondary small mb-3">
                    Allow camera access, then hold a printed QR code in front
                    of your webcam.
                  </p>

                  {/* IMPORTANT: html5-qrcode owns this empty element. */}
                  <div
                    className="rounded-3 overflow-hidden border bg-dark mb-3"
                    style={{ minHeight: cameraActive ? "auto" : 260 }}
                  >
                    <div
                      id="qr-camera-viewport"
                      style={{ width: "100%" }}
                    />
                  </div>

                  {!cameraActive && (
                    <div className="text-center p-4 bg-light rounded-3 mb-3">
                      <i className="bi bi-camera-video fs-1 d-block mb-2 text-success" />

                      <h6 className="fw-bold text-dark mb-1">
                        {cameraStarting ? "Starting Camera..." : "Camera Standby"}
                      </h6>

                      <p className="small text-muted mb-3">
                        Click below to start the live QR scanner.
                      </p>

                      <button
                        type="button"
                        className="btn btn-success fw-semibold px-4 rounded-pill"
                        onClick={startCamera}
                        disabled={cameraStarting}
                      >
                        <i
                          className={`bi ${
                            cameraStarting
                              ? "bi-arrow-repeat"
                              : "bi-camera-video-fill"
                          } me-2`}
                        />
                        {cameraStarting ? "Starting..." : "Turn On Webcam"}
                      </button>
                    </div>
                  )}

                  {cameraActive && (
                    <div className="d-flex justify-content-between align-items-center mb-3 p-2 bg-success-subtle rounded-3 border">
                      <span className="small text-success fw-semibold">
                        <i className="bi bi-record-circle-fill text-danger me-1" />
                        Webcam live — hold the QR code in front of the camera.
                      </span>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => void stopCamera()}
                      >
                        Stop Camera
                      </button>
                    </div>
                  )}

                  {isPermissionDenied && (
                    <div className="alert alert-warning small">
                      <strong>Camera permission is blocked.</strong>
                      <p className="mb-2 mt-1">
                        In Chrome, click the site controls icon beside the
                        address bar, set Camera to Allow, and retry.
                      </p>
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        onClick={startCamera}
                        disabled={cameraStarting}
                      >
                        Retry Webcam
                      </button>
                    </div>
                  )}

                  {cameraError && !isPermissionDenied && (
                    <div className="alert alert-warning small border mb-3">
                      <i className="bi bi-info-circle-fill me-2" />
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
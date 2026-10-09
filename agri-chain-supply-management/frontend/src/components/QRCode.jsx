// Path: frontend/src/components/QRCode.jsx
import React, { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function ProductQRCode({ product }) {
  const canvasRef = useRef(null);

  const value = JSON.stringify({
    productId: product.productId,
    name: product.name,
    blockchainHash: product.qrBlockchainHash
  });

  function downloadQR() {
    const canvas = document.querySelector("#product-qr-canvas canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Batch-${product.productId}-QR.png`;
    a.click();
  }

  return (
    <div className="text-center" id="product-qr-canvas">
      <div className="p-2 bg-white rounded-3 shadow-sm d-inline-block border">
        <QRCodeCanvas
          value={value}
          size={180}
          level="H"
          includeMargin
          imageSettings={{
            src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23198754'><path d='M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z'/></svg>",
            height: 24,
            width: 24,
            excavate: true
          }}
        />
      </div>
      <div className="small text-secondary mt-2 fw-medium">
        Batch #{product.productId} Optical Identifier
      </div>
      <button
        type="button"
        className="btn btn-link btn-sm text-success text-decoration-none p-0 mt-1"
        onClick={downloadQR}
        title="Download printable PNG badge"
      >
        <i className="bi bi-download me-1"></i>Download QR Badge
      </button>
    </div>
  );
}

// Path: frontend/src/components/QRCode.jsx
import React from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function ProductQRCode({ product }) {
  const value = JSON.stringify({
    productId: product.productId,
    blockchainHash: product.qrBlockchainHash
  });

  return (
    <div className="text-center">
      <QRCodeCanvas value={value} size={210} level="H" includeMargin />
      <div className="small text-secondary mt-2">
        Scan to trace Product #{product.productId}
      </div>
    </div>
  );
}

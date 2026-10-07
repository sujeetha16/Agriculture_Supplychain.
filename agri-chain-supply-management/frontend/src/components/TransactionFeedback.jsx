// Path: frontend/src/components/TransactionFeedback.jsx
import React from "react";

export default function TransactionFeedback({ hash }) {
  if (!hash) return null;

  return (
    <div className="alert alert-success mt-3">
      <strong>Blockchain transaction confirmed.</strong>
      <div className="small text-break mt-1">
        TX Hash:{" "}
        <a
          href={`https://sepolia.etherscan.io/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
        >
          {hash}
        </a>
      </div>
    </div>
  );
}

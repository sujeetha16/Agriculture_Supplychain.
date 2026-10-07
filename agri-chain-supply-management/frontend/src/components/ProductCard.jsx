// Path: frontend/src/components/ProductCard.jsx
import React from "react";
import { Link } from "react-router-dom";

const roleNames = { 1: "Farmer", 2: "Distributor", 3: "Retailer", 4: "Consumer" };

export default function ProductCard({ product, role }) {
  const canManage = role && role !== 4 && product.status !== "SoldToConsumer";

  return (
    <div className="card h-100 border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <h5 className="fw-bold mb-1">{product.name}</h5>
          <span className="badge text-bg-success">#{product.productId}</span>
        </div>
        <div className="small text-secondary mb-3">Harvest: {product.harvestDate}</div>
        <span className="badge text-bg-light border">{product.status}</span>
      </div>
      <div className="card-footer bg-white border-0 pb-3 d-grid gap-2">
        <Link className="btn btn-sm btn-outline-success" to={`/trace/${product.productId}`}>
          View Journey
        </Link>
        {canManage && (
          <Link className="btn btn-sm btn-success" to={`/product/${product.productId}`}>
            {roleNames[role]} Action
          </Link>
        )}
      </div>
    </div>
  );
}

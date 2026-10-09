// Path: frontend/src/components/ProductCard.jsx
import React from "react";
import { Link } from "react-router-dom";

const roleNames = { 1: "Farmer", 2: "Distributor", 3: "Retailer", 4: "Consumer" };

export default function ProductCard({ product, role }) {
  const canManage = role && role !== 4 && product.status !== "SoldToConsumer";

  const getStatusBadge = (status) => {
    switch (status) {
      case "Created":
        return <span className="badge-status status-created"><i className="bi bi-seedling"></i>Created (Farm)</span>;
      case "DispatchedToDistributor":
        return <span className="badge-status status-in-transit"><i className="bi bi-truck"></i>In Transit to Hub</span>;
      case "ReceivedByDistributor":
        return <span className="badge-status status-received"><i className="bi bi-building"></i>At Distributor</span>;
      case "DispatchedToRetailer":
        return <span className="badge-status status-in-transit"><i className="bi bi-truck"></i>In Transit to Store</span>;
      case "ReceivedByRetailer":
        return <span className="badge-status status-received"><i className="bi bi-shop"></i>In Retail Store</span>;
      case "SoldToConsumer":
        return <span className="badge-status status-completed"><i className="bi bi-check-circle-fill"></i>Sold to Consumer</span>;
      default:
        return <span className="badge-status bg-light text-dark">{status}</span>;
    }
  };

  return (
    <div className="product-card">
      <div className="product-card-top">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <span className="badge bg-dark bg-opacity-75 text-white font-monospace">
            #{product.productId}
          </span>
          <span className="badge bg-success-subtle text-success border border-success-subtle">
            {product.cropType || "Agricultural Produce"}
          </span>
        </div>

        <h5 className="fw-bold text-dark mb-1 text-truncate" title={product.name}>
          {product.name}
        </h5>

        <div className="d-flex align-items-center gap-1 text-muted small mb-2">
          <i className="bi bi-geo-alt text-success"></i>
          <span className="text-truncate">{product.farmLocation || "Origin Farm"}</span>
        </div>

        <div className="mb-2">
          {getStatusBadge(product.status)}
        </div>
      </div>

      <div className="product-card-meta">
        <div className="row g-2 mb-2">
          <div className="col-6">
            <span className="text-muted d-block small">Harvest Date:</span>
            <strong className="text-dark small">{product.harvestDate}</strong>
          </div>
          <div className="col-6">
            <span className="text-muted d-block small">Batch Size:</span>
            <strong className="text-dark small">{product.quantity || "1,000 kg"}</strong>
          </div>
        </div>

        {product.qualityGrade && (
          <div className="badge-tag d-inline-block text-truncate max-w-100">
            <i className="bi bi-award me-1 text-warning"></i>
            {product.qualityGrade}
          </div>
        )}
      </div>

      <div className="product-card-actions">
        <Link
          className="btn btn-outline-success btn-sm flex-grow-1"
          to={`/trace/${product.productId}`}
        >
          <i className="bi bi-search me-1"></i>Trace Journey
        </Link>
        {canManage && (
          <Link
            className="btn btn-success btn-sm flex-grow-1"
            to={`/product/${product.productId}`}
          >
            <i className="bi bi-arrow-right-circle me-1"></i>
            {roleNames[role] || "Manage"} Action
          </Link>
        )}
      </div>
    </div>
  );
}

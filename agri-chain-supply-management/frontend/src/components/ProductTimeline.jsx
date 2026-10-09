// Path: frontend/src/components/ProductTimeline.jsx
import React from "react";

const STAGES = [
  {
    action: "CREATED",
    title: "1. Harvest & Batch Genesis",
    desc: "Crop harvested, inspected, and smart contract tokenized at origin farm.",
    icon: "bi-flower1"
  },
  {
    action: "DISPATCHED_TO_DISTRIBUTOR",
    title: "2. Dispatched to Cold-Chain Logistics",
    desc: "Loaded into temperature-controlled transport bound for regional distributor.",
    icon: "bi-truck"
  },
  {
    action: "RECEIVED_BY_DISTRIBUTOR",
    title: "3. Received at Distribution Hub",
    desc: "Arrived at logistics facility; barcode and batch credentials verified.",
    icon: "bi-building-check"
  },
  {
    action: "DISPATCHED_TO_RETAILER",
    title: "4. Dispatched to Supermarket / Retailer",
    desc: "Released from distributor inventory and routed to commercial retail outlet.",
    icon: "bi-box-arrow-right"
  },
  {
    action: "RECEIVED_BY_RETAILER",
    title: "5. Stocked at Retail Store",
    desc: "Received at grocery retail shelf; ready for final consumer purchase.",
    icon: "bi-shop"
  },
  {
    action: "SOLD_TO_CONSUMER",
    title: "6. Purchased by Consumer",
    desc: "Point-of-sale checkout complete; end-to-end provenance lifecycle fulfilled.",
    icon: "bi-bag-check-fill"
  }
];

export default function ProductTimeline({ product }) {
  if (!product) return null;

  const historyMap = Object.fromEntries(
    (product.history || []).map((h) => [h.action, h])
  );

  return (
    <div className="agri-timeline">
      {STAGES.map((stage, idx) => {
        const event = historyMap[stage.action];
        const isDone = Boolean(event);

        return (
          <div
            className={`agri-timeline-item ${isDone ? "done" : ""}`}
            key={stage.action}
          >
            <div className="agri-timeline-pin">
              {isDone ? <i className="bi bi-check-lg"></i> : <span>{idx + 1}</span>}
            </div>

            <div className="agri-timeline-content">
              <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-1">
                <h6 className="fw-bold mb-0 text-dark">
                  <i className={`bi ${stage.icon} me-2 ${isDone ? "text-success" : "text-muted"}`}></i>
                  {stage.title}
                </h6>
                {isDone ? (
                  <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle">
                    <i className="bi bi-calendar-check me-1"></i>
                    {event.date}
                  </span>
                ) : (
                  <span className="badge bg-light text-muted border">
                    Pending
                  </span>
                )}
              </div>

              <p className="text-secondary small mb-2">{stage.desc}</p>

              {isDone ? (
                <div className="p-2 bg-light rounded border border-light-subtle small mt-2">
                  <div className="row g-1 text-secondary">
                    <div className="col-sm-6">
                      <span className="d-block text-muted" style={{ fontSize: "0.75rem" }}>Signer Actor:</span>
                      <span className="text-break-address font-monospace text-dark">
                        {event.actorAddress}
                      </span>
                    </div>

                    {event.receiverAddress && (
                      <div className="col-sm-6">
                        <span className="d-block text-muted" style={{ fontSize: "0.75rem" }}>Designated Receiver:</span>
                        <span className="text-break-address font-monospace text-dark">
                          {event.receiverAddress}
                        </span>
                      </div>
                    )}

                    {event.location && (
                      <div className="col-12 mt-1">
                        <span className="text-muted">Location: </span>
                        <span className="text-dark fw-medium">{event.location}</span>
                      </div>
                    )}

                    {event.notes && (
                      <div className="col-12 mt-1">
                        <span className="text-muted">Transit Notes: </span>
                        <span className="text-dark fst-italic">{event.notes}</span>
                      </div>
                    )}

                    <div className="col-12 mt-2 pt-1 border-top">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                          <i className="bi bi-link-45deg me-1"></i>On-Chain Transaction:
                        </span>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-monospace text-decoration-none text-success small fw-semibold"
                        >
                          {event.txHash.slice(0, 10)}...{event.txHash.slice(-8)}{" "}
                          <i className="bi bi-box-arrow-up-right ms-1"></i>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted fst-italic small">
                  Step awaiting execution by authorized supply chain stakeholder.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

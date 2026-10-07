// Path: frontend/src/components/ProductTimeline.jsx
import React from "react";

const labels = [
  ["CREATED", "Harvested / Created"],
  ["DISPATCHED_TO_DISTRIBUTOR", "Dispatched to Distributor"],
  ["RECEIVED_BY_DISTRIBUTOR", "Received by Distributor"],
  ["DISPATCHED_TO_RETAILER", "Dispatched to Retailer"],
  ["RECEIVED_BY_RETAILER", "Received by Retailer"],
  ["SOLD_TO_CONSUMER", "Sold to Consumer"]
];

export default function ProductTimeline({ product }) {
  return (
    <div className="timeline">
      {labels.map(([action, label], index) => {
        const event = product.history?.find((item) => item.action === action);
        return (
          <div className={`timeline-item ${event ? "completed" : ""}`} key={action}>
            <div className="timeline-dot">{event ? "✓" : index + 1}</div>
            <div className="timeline-content">
              <h6 className="mb-1 fw-bold">{label}</h6>
              {event ? (
                <>
                  <div className="small">{event.date}</div>
                  <div className="small text-secondary text-break">
                    Actor: {event.actorAddress}
                  </div>
                  {event.receiverAddress && (
                    <div className="small text-secondary text-break">
                      Receiver: {event.receiverAddress}
                    </div>
                  )}
                  <a
                    className="small"
                    href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Verify TX
                  </a>
                </>
              ) : (
                <span className="small text-secondary">Pending</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

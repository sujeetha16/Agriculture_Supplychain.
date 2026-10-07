// Path: frontend/src/components/Alert.jsx
import React from "react";

export default function Alert({ message, type = "danger", onClose }) {
  if (!message) return null;

  return (
    <div className={`alert alert-${type} alert-dismissible fade show`} role="alert">
      {message}
      {onClose && (
        <button type="button" className="btn-close" onClick={onClose}></button>
      )}
    </div>
  );
}

import React from "react";

export default function ServiceControls({
  onSaveBackend,
  onTestConnection,
  backendHealthClass,
  backendHealthLabel,
  backendConnectionClass,
  backendConnectionLabel,
}) {
  return (
    <div className="button-row">
      <button type="button" className="primary" onClick={onSaveBackend}>
        Save backend
      </button>
      <div className={backendHealthClass}>
        <span className="health-dot" />
        <span>{backendHealthLabel}</span>
      </div>
      <div className="connection-group">
        <div className={backendConnectionClass}>
          <span className="health-dot" />
          <span>Connection: {backendConnectionLabel}</span>
        </div>
        <button type="button" onClick={onTestConnection}>
          Test connection
        </button>
      </div>
    </div>
  );
}

import React from "react";

export default function Filters({
  className = "results-aside",
  summary,
  open = true,
  onToggle,
  detailsClassName = "",
  children,
}) {
  return (
    <aside className={className}>
      <details className={detailsClassName} open={open} onToggle={onToggle}>
        <summary>{summary}</summary>
        <div className="results-sidebar-card">{children}</div>
      </details>
    </aside>
  );
}

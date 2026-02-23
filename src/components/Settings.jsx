import React, { useEffect, useRef } from "react";

function useModalFocusTrap(enabled, modalRef, onClose) {
  useEffect(() => {
    if (!enabled) return undefined;
    const root = modalRef.current;
    if (!root) return undefined;
    const selectors =
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
    const findFocusable = () =>
      Array.from(root.querySelectorAll(selectors)).filter(
        (node) => !node.hasAttribute("disabled")
      );
    const initial = findFocusable()[0];
    initial?.focus?.();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (typeof onClose === "function") onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = findFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener("keydown", handleKeyDown);
    return () => root.removeEventListener("keydown", handleKeyDown);
  }, [enabled, modalRef, onClose]);
}

export function AppMenuModal({ open, onClose, sections, onOpenSection }) {
  const modalRef = useRef(null);
  useModalFocusTrap(Boolean(open), modalRef, onClose);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal app-menu-modal"
        role="dialog"
        aria-modal="true"
        aria-label="App menu"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          X
        </button>
        <h2 className="modal-title">App menu</h2>
        <p className="modal-description">
          Open a settings panel to fine-tune your Current Scope experience.
        </p>
        <div className="app-menu-grid">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className="app-menu-card"
              onClick={() => onOpenSection(section.id)}
            >
              <span className="app-menu-header">
                <span className="app-menu-icon" aria-hidden="true">
                  <i className={`fa-solid ${section.icon || "fa-sliders"}`}></i>
                </span>
                <span className="app-menu-title">
                  {section.menuLabel || section.label}
                </span>
              </span>
              <span className="app-menu-sub">{section.summary}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppSettingsModal({ section, onClose, onBack }) {
  const modalRef = useRef(null);
  useModalFocusTrap(Boolean(section), modalRef, onClose);
  if (!section) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${section.label} settings`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          X
        </button>
        <div className="settings-modal-header">
          <div className="badge">Settings</div>
          <h2>{section.label}</h2>
          <p className="muted">{section.summary}</p>
        </div>
        <div className="settings-modal-body">{section.content}</div>
        <div className="modal-links">
          <button type="button" onClick={onBack}>
            Back to menu
          </button>
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

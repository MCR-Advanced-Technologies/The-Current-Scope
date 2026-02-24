import React from "react";
import { createRoot } from "react-dom/client";
import "@fortawesome/fontawesome-free/css/all.min.css";
import App from "./App";
import "./styles.css";

if (typeof window !== "undefined") {
  const host = (window.location.hostname || "").toLowerCase();
  if (host === "frontend.thecurrentscope.com") {
    const target = `https://thecurrentscope.com${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (window.location.href !== target) {
      window.location.replace(target);
    }
  }
}

function CrashScreen({ error }) {
  const message =
    error && (error.stack || error.message || String(error))
      ? String(error.stack || error.message || error)
      : "Unknown error";
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px 20px",
        fontFamily:
          "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: "#1f2937",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          background: "rgba(255,250,245,0.96)",
          border: "1px solid rgba(231,222,210,0.9)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Current Scope crashed</h1>
        <p style={{ margin: "0 0 14px", color: "#6b7280" }}>
          The app hit an unexpected error. Reloading usually fixes it. If it
          persists, reset stored settings.
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "rgba(15,118,110,0.06)",
            border: "1px solid rgba(15,118,110,0.16)",
            borderRadius: 12,
            padding: 12,
            margin: "0 0 14px",
            maxHeight: 280,
            overflow: "auto",
            fontSize: 12,
          }}
        >
          {message}
        </pre>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(15,118,110,0.28)",
              background: "#0f766e",
              color: "white",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage?.clear?.();
              } catch (err) {
                // ignore
              }
              window.location.reload();
            }}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(231,222,210,0.9)",
              background: "white",
              color: "#1f2937",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reset settings
          </button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep console noise for debugging; UI should still display a friendly message.
    // eslint-disable-next-line no-console
    console.error("Frontend crashed", error, info);
  }

  render() {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

const SW_DEBUG_ENABLED = ["1", "true", "yes"].includes(
  String(import.meta.env.VITE_SW_DEBUG || "").toLowerCase()
);

function logSwDebug(...args) {
  if (!SW_DEBUG_ENABLED) return;
  // eslint-disable-next-line no-console
  console.info("[SW]", ...args);
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    let reloadTriggered = false;

    const onControllerChange = () => {
      if (reloadTriggered) return;
      reloadTriggered = true;
      logSwDebug("controllerchange -> reload");
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const promptForUpdate = (registration) => {
      if (!registration?.waiting) return;
      const accepted =
        typeof window.confirm === "function"
          ? window.confirm("Update available. Reload to apply it now?")
          : true;
      if (!accepted) {
        logSwDebug("update available, user deferred");
        return;
      }
      logSwDebug("sending SKIP_WAITING");
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    };

    const baseUrl = import.meta.env.BASE_URL || "/";
    const swScriptUrl = new URL(
      `service-worker.js${SW_DEBUG_ENABLED ? "?debug=1" : ""}`,
      window.location.origin + baseUrl
    ).toString();

    navigator.serviceWorker
      .register(swScriptUrl, { scope: baseUrl })
      .then((registration) => {
        logSwDebug("registered", swScriptUrl, "scope", baseUrl);
        if (registration.waiting) {
          promptForUpdate(registration);
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            logSwDebug("installing state", installing.state);
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptForUpdate(registration);
            }
          });
        });
      })
      .catch((err) => {
        logSwDebug("registration failed", err);
      });
  });
}

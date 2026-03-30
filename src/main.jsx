import React from "react";
import { createRoot } from "react-dom/client";
import "@fortawesome/fontawesome-free/css/all.min.css";
import App from "./App";
import "./styles.css";

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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    let isRefreshing = false;
    const onControllerChange = () => {
      if (isRefreshing) return;
      isRefreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const requestRuntimeCacheClear = async (registration) => {
      if (!registration) return;
      if (registration.sync && typeof registration.sync.register === "function") {
        try {
          await registration.sync.register("clear-runtime-cache");
          return;
        } catch (_) {
          // Fall through to direct worker messaging when Background Sync is unavailable.
        }
      }
      try {
        const worker =
          registration.waiting ||
          registration.active ||
          navigator.serviceWorker.controller;
        worker?.postMessage({ type: "CLEAR_RUNTIME_CACHE" });
      } catch (_) {
        // Cache clearing is best-effort and should not block activation.
      }
    };

    const promptForUpdate = (registration) => {
      if (!registration?.waiting) return;
      const message = "Update available. Reload now?";
      const accepted = typeof window.confirm === "function" ? window.confirm(message) : true;
      if (accepted) {
        void requestRuntimeCacheClear(registration);
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };

    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        if (registration.waiting) {
          promptForUpdate(registration);
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptForUpdate(registration);
            }
          });
        });
      })
      .catch(() => {
        // Service worker registration failure should not block the app.
      });
  });
}

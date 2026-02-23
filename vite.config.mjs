import { defineConfig, loadEnv } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_FRONTEND_PORT = 5174;
const DEFAULT_BACKEND_PROXY_TARGET = "http://localhost:8001";

function resolveEnv(mode) {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  return { ...fileEnv, ...process.env };
}

function resolveHttps(env) {
  const cert = env.SSL_CERTFILE;
  const key = env.SSL_KEYFILE;
  if (!cert && !key) {
    return false;
  }
  if (!cert || !key) {
    throw new Error("SSL_CERTFILE and SSL_KEYFILE must both be set for HTTPS.");
  }
  return {
    cert: fs.readFileSync(cert),
    key: fs.readFileSync(key),
  };
}

function resolvePort(env, fallback) {
  const raw = env.DEV_PORT || env.VITE_DEV_PORT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch (err) {
    return "";
  }
}

function resolveBackendProxyTarget(env) {
  const raw =
    env.VITE_BACKEND_PROXY_TARGET ||
    env.BACKEND_PROXY_TARGET ||
    DEFAULT_BACKEND_PROXY_TARGET;
  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/+$/, "");
  } catch (err) {
    throw new Error(
      `Invalid backend proxy target "${raw}". Set VITE_BACKEND_PROXY_TARGET/BACKEND_PROXY_TARGET to a valid URL.`
    );
  }
}

function normalizeBasePath(value) {
  const raw = String(value || "/").trim();
  if (!raw || raw === "/") return "/";
  let next = raw;
  if (!next.startsWith("/")) {
    next = `/${next}`;
  }
  if (!next.endsWith("/")) {
    next = `${next}/`;
  }
  return next;
}

function buildConnectSrc(env, mode) {
  const connect = new Set(["'self'"]);
  const backendOrigin = normalizeOrigin(
    env.VITE_BACKEND_URL || env.BACKEND_URL || ""
  );
  if (backendOrigin) {
    connect.add(backendOrigin);
  }
  if (mode === "development") {
    connect.add("http:");
    connect.add("https:");
    connect.add("ws:");
    connect.add("wss:");
  } else {
    connect.add("https:");
  }
  return Array.from(connect).join(" ");
}

function buildCspHeader(env, mode) {
  const connectSrc = buildConnectSrc(env, mode);
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.youtube-nocookie.com https://static.cloudflareinsights.com https://maps.googleapis.com https://maps.gstatic.com",
    "script-src-elem 'self' 'unsafe-inline' https://www.youtube.com https://www.youtube-nocookie.com https://static.cloudflareinsights.com https://maps.googleapis.com https://maps.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://i.ytimg.com https:",
    `connect-src ${connectSrc}`,
    "media-src 'self' https: blob:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function injectCspMeta(html, csp) {
  return html.replaceAll("__APP_CSP__", csp);
}

export default defineConfig(({ mode }) => {
  const env = resolveEnv(mode);
  const https = resolveHttps(env);
  const port = resolvePort(env, DEFAULT_FRONTEND_PORT);
  const backendProxyTarget = resolveBackendProxyTarget(env);
  const basePath = normalizeBasePath(env.VITE_BASE_PATH || env.BASE_PATH || "/");
  let packageVersion = "0.1.0";
  try {
    const pkg = JSON.parse(
      fs.readFileSync(new URL("./package.json", import.meta.url), "utf8")
    );
    packageVersion = pkg?.version || packageVersion;
  } catch (err) {
    packageVersion = "0.1.0";
  }
  const csp = buildCspHeader(env, mode);
  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  return {
    base: basePath,
    define: {
      "import.meta.env.PACKAGE_VERSION": JSON.stringify(packageVersion),
    },
    plugins: [
      {
        name: "inject-csp-meta",
        transformIndexHtml(html) {
          return injectCspMeta(html, csp);
        },
      },
    ],
    server: {
      host: "0.0.0.0",
      port,
      https,
      headers: {
        // YouTube embedded players require a Referer; do not suppress it.
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": csp,
      },
      proxy: {
        "/api": {
          target: backendProxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(rootDir, "index.html"),
          terms: path.resolve(rootDir, "terms.html"),
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port,
      https,
      headers: {
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": csp,
      },
    },
  };
});

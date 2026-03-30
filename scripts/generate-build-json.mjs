import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const publicDir = path.join(rootDir, "public");
const buildJsonPath = path.join(publicDir, "build.json");

function readPackageVersion() {
  const raw = fs.readFileSync(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  return String(pkg?.version || "0.0.0");
}

function resolveCommit() {
  const envCommit =
    process.env.VITE_BUILD_HASH ||
    process.env.BUILD_SOURCEVERSION ||
    process.env.GITHUB_SHA ||
    "";
  if (envCommit) {
    return String(envCommit).trim();
  }
  try {
    return execSync("git rev-parse HEAD", {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch (err) {
    try {
      const existing = JSON.parse(fs.readFileSync(buildJsonPath, "utf8"));
      return String(existing?.build_hash || existing?.commit || "").trim();
    } catch (readErr) {
      return "";
    }
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const version = readPackageVersion();
const commit = resolveCommit();
const payload = {
  version,
  build_hash: commit,
  commit,
  built_at: new Date().toISOString(),
};

ensureDir(publicDir);
fs.writeFileSync(buildJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(rootDir, buildJsonPath)} for version ${version}${commit ? ` (${commit.slice(0, 7)})` : ""}.`);

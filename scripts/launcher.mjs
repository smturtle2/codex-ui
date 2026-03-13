import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MIN_NODE_MAJOR = 20;
const MIN_CODEX_VERSION = [0, 114, 0];
const FULL_SUPPORT_MINOR = 114;
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";
const BROWSER_DISABLED = new Set(["0", "false", "none"]);

const command = process.argv[2] ?? "dev";
const flags = new Set(process.argv.slice(3));

function printUsage() {
  console.log(`Codex WebUI launcher

Usage:
  node scripts/launcher.mjs setup
  node scripts/launcher.mjs doctor
  node scripts/launcher.mjs dev
  node scripts/launcher.mjs start

Flags:
  --no-open     Do not open a browser tab automatically
  --skip-install  Skip npm install even if dependencies look missing
  --skip-build    Skip the production build step before start
`);
}

function log(message) {
  console.log(`[codex-ui] ${message}`);
}

function warn(message) {
  console.warn(`[codex-ui] Warning: ${message}`);
}

function fail(message) {
  console.error(`[codex-ui] Error: ${message}`);
  process.exit(1);
}

function parseSemver(text) {
  const match = text.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) {
      return 1;
    }
    if (left[index] < right[index]) {
      return -1;
    }
  }
  return 0;
}

function detectWsl() {
  return Boolean(process.env.WSL_DISTRO_NAME) || os.release().toLowerCase().includes("microsoft");
}

function detectPlatformStatus() {
  const isWsl = detectWsl();

  if (process.platform === "win32" && !isWsl) {
    return {
      ok: false,
      detail: "Bare Windows is not supported. Use Windows 11 via WSL2 instead.",
    };
  }

  return {
    ok: true,
    detail: isWsl ? `WSL (${process.env.WSL_DISTRO_NAME ?? "detected"})` : `${process.platform} ${os.release()}`,
  };
}

function detectNodeStatus() {
  const parsed = parseSemver(process.version);
  if (!parsed || parsed[0] < MIN_NODE_MAJOR) {
    return {
      ok: false,
      detail: `Node.js ${process.version} detected. Node.js ${MIN_NODE_MAJOR}+ is required.`,
    };
  }

  return {
    ok: true,
    detail: process.version,
  };
}

function detectNpmStatus() {
  const result = spawnSync(NPM_COMMAND, ["--version"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return {
      ok: false,
      detail: "npm is required but was not found.",
    };
  }

  return {
    ok: true,
    detail: `npm ${result.stdout.trim()}`,
  };
}

function detectCodexStatus() {
  const result = spawnSync("codex", ["--version"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      detail: "codex-cli is not available on PATH.",
      level: "error",
    };
  }

  const versionText = result.stdout.trim();
  const parsed = parseSemver(versionText);
  if (!parsed) {
    return {
      ok: false,
      detail: `Unable to parse codex-cli version from "${versionText}".`,
      level: "error",
    };
  }

  if (compareSemver(parsed, MIN_CODEX_VERSION) < 0) {
    return {
      ok: false,
      detail: `${versionText} is below the minimum supported version 0.114.0.`,
      level: "error",
    };
  }

  if (parsed[0] === 0 && parsed[1] === FULL_SUPPORT_MINOR) {
    return {
      ok: true,
      detail: `${versionText} (full support)`,
      level: "ok",
    };
  }

  return {
    ok: true,
    detail: `${versionText} (degraded support, experimental APIs disabled)`,
    level: "warn",
  };
}

function requiredDependencyPaths() {
  return [
    ["next", "package.json"],
    ["react", "package.json"],
    ["react-dom", "package.json"],
    ["ws", "package.json"],
    ["zod", "package.json"],
    ["tsx", "package.json"],
  ].map((segments) => path.join(ROOT_DIR, "node_modules", ...segments));
}

function dependenciesAreInstalled() {
  return requiredDependencyPaths().every((entry) => existsSync(entry));
}

function lockfileIsFresh() {
  const lockfile = path.join(ROOT_DIR, "package-lock.json");
  const installedLockfile = path.join(ROOT_DIR, "node_modules", ".package-lock.json");

  if (!existsSync(lockfile) || !existsSync(installedLockfile)) {
    return false;
  }

  return statSync(installedLockfile).mtimeMs >= statSync(lockfile).mtimeMs;
}

function detectDependencyStatus() {
  if (!dependenciesAreInstalled()) {
    return {
      ok: false,
      detail: "Dependencies are missing.",
    };
  }

  if (!lockfileIsFresh()) {
    return {
      ok: false,
      detail: "Dependencies look older than package-lock.json.",
    };
  }

  return {
    ok: true,
    detail: "Dependencies are installed.",
  };
}

function runChecked(commandName, args, description) {
  log(description);

  const result = spawnSync(commandName, args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    fail(`${description} failed.`);
  }
}

function ensureDependencies() {
  if (flags.has("--skip-install")) {
    return;
  }

  const dependencyStatus = detectDependencyStatus();
  if (dependencyStatus.ok) {
    return;
  }

  runChecked(NPM_COMMAND, ["install", "--no-audit", "--no-fund"], "Installing npm dependencies");
}

function ensureBuildOutput() {
  if (flags.has("--skip-build")) {
    return;
  }

  runChecked(NPM_COMMAND, ["run", "build"], "Building the production app");
}

function printDoctor() {
  const statuses = [
    ["Platform", detectPlatformStatus()],
    ["Node.js", detectNodeStatus()],
    ["npm", detectNpmStatus()],
    ["codex-cli", detectCodexStatus()],
    ["Dependencies", detectDependencyStatus()],
  ];

  for (const [label, status] of statuses) {
    const badge = status.ok ? "OK " : "ERR";
    console.log(`${label.padEnd(14)} ${badge}  ${status.detail}`);
  }

  if (statuses.some(([, status]) => !status.ok)) {
    process.exit(1);
  }
}

function openBrowser(url) {
  if (flags.has("--no-open")) {
    return;
  }

  if (process.env.CI === "1" || process.env.CI === "true") {
    return;
  }

  if (process.env.BROWSER && BROWSER_DISABLED.has(process.env.BROWSER.toLowerCase())) {
    return;
  }

  const commands = [];
  if (detectWsl()) {
    commands.push(["wslview", [url]]);
    commands.push(["cmd.exe", ["/c", "start", "", url]]);
  } else if (process.platform === "darwin") {
    commands.push(["open", [url]]);
  } else if (process.platform === "win32") {
    commands.push(["cmd", ["/c", "start", "", url]]);
  } else {
    commands.push(["xdg-open", [url]]);
  }

  for (const [binary, args] of commands) {
    const result = spawnSync(binary, ["--help"], {
      cwd: ROOT_DIR,
      stdio: "ignore",
      env: process.env,
    });

    if (result.status !== 0 && result.error) {
      continue;
    }

    const child = spawn(binary, args, {
      cwd: ROOT_DIR,
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
    return;
  }

  warn(`Could not find a browser opener. Open ${url} manually.`);
}

function launch(scriptName, options = {}) {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = process.env.PORT ?? "3000";
  const fallbackUrl = `http://${host}:${port}`;
  let browserOpened = false;

  log(`Starting Codex WebUI on ${fallbackUrl}`);

  const child = spawn(NPM_COMMAND, ["run", scriptName], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  const scanOutput = (chunk) => {
    if (!options.openBrowser || browserOpened) {
      return;
    }

    const text = chunk.toString();
    const match = text.match(/https?:\/\/[^\s]+/);
    if (!match) {
      return;
    }

    browserOpened = true;
    openBrowser(match[0]);
  };

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    scanOutput(chunk);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    scanOutput(chunk);
  });

  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

function ensureRuntimeReadiness({ requireCodex }) {
  const platformStatus = detectPlatformStatus();
  if (!platformStatus.ok) {
    fail(platformStatus.detail);
  }

  const nodeStatus = detectNodeStatus();
  if (!nodeStatus.ok) {
    fail(nodeStatus.detail);
  }

  const npmStatus = detectNpmStatus();
  if (!npmStatus.ok) {
    fail(npmStatus.detail);
  }

  if (requireCodex) {
    const codexStatus = detectCodexStatus();
    if (!codexStatus.ok) {
      fail(codexStatus.detail);
    }
    if (codexStatus.level === "warn") {
      warn(codexStatus.detail);
    } else {
      log(codexStatus.detail);
    }
  } else {
    const codexStatus = detectCodexStatus();
    if (!codexStatus.ok) {
      warn(`${codexStatus.detail} You can still run setup, but the app will not start until Codex is installed.`);
    } else if (codexStatus.level === "warn") {
      warn(codexStatus.detail);
    } else {
      log(codexStatus.detail);
    }
  }
}

switch (command) {
  case "setup":
    ensureRuntimeReadiness({ requireCodex: false });
    ensureDependencies();
    log("Setup complete. Next step: npm run up");
    break;
  case "doctor":
    printDoctor();
    break;
  case "dev":
    ensureRuntimeReadiness({ requireCodex: true });
    ensureDependencies();
    launch("dev:raw", { openBrowser: true });
    break;
  case "start":
    ensureRuntimeReadiness({ requireCodex: true });
    ensureDependencies();
    ensureBuildOutput();
    launch("start:raw", { openBrowser: false });
    break;
  case "help":
  case "--help":
  case "-h":
    printUsage();
    break;
  default:
    printUsage();
    fail(`Unknown command "${command}".`);
}

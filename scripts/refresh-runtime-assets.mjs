import { cp, mkdir, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeAssetsRoot = join(root, "runtime-assets");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      ...options,
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "null"}.`));
    });
  });
}

async function copyDirectory(source, target) {
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, {
    recursive: true,
    force: true,
  });
}

async function copyFile(source, target) {
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, {
    force: true,
  });
}

async function main() {
  const compiledRoot = await mkdtemp(join(tmpdir(), "webpty-runtime-js-"));

  await run(npmCommand, ["run", "build"]);
  await run("node", [
    "./node_modules/typescript/bin/tsc",
    "-p",
    "tsconfig.json",
    "--outDir",
    compiledRoot,
    "--module",
    "commonjs",
    "--target",
    "ES2022",
    "--moduleResolution",
    "node",
    "--declaration",
    "false",
    "--sourceMap",
    "false",
    "--noEmit",
    "false",
  ]);

  await rm(runtimeAssetsRoot, { recursive: true, force: true });
  await mkdir(runtimeAssetsRoot, { recursive: true });

  await copyDirectory(join(root, "out"), join(runtimeAssetsRoot, "out"));
  await copyFile(
    join(compiledRoot, "server", "codex-bridge.js"),
    join(runtimeAssetsRoot, "server", "codex-bridge.js"),
  );
  await copyFile(
    join(compiledRoot, "server", "legacy-bridge.js"),
    join(runtimeAssetsRoot, "server", "legacy-bridge.js"),
  );
  await copyFile(
    join(compiledRoot, "server", "settings-store.js"),
    join(runtimeAssetsRoot, "server", "settings-store.js"),
  );
  await copyFile(
    join(compiledRoot, "src", "lib", "shared.js"),
    join(runtimeAssetsRoot, "src", "lib", "shared.js"),
  );
  await copyFile(
    join(compiledRoot, "src", "lib", "windows-terminal.js"),
    join(runtimeAssetsRoot, "src", "lib", "windows-terminal.js"),
  );
  await copyDirectory(join(root, "node_modules", "ws"), join(runtimeAssetsRoot, "node_modules", "ws"));

  console.log(`Runtime assets refreshed in ${runtimeAssetsRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

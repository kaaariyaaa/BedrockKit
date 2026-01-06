import { resolve } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import type { BkitConfig } from "../types.js";

const localBuildScript = `import { rm, cp, stat, access } from "node:fs/promises";
import { resolve } from "node:path";
import { build as esbuild } from "esbuild";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

async function main() {
  const config = JSON.parse(await readFile("./bkit.config.json", "utf8"));
  const rootDir = config.paths?.root ? resolve(config.paths.root) : process.cwd();
  const outDir = resolve(rootDir, config.build?.outDir ?? "dist");
  const behaviorEnabled = config.packSelection?.behavior !== false;
  const resourceEnabled = config.packSelection?.resource !== false;
  const behaviorSrc = behaviorEnabled ? resolve(rootDir, config.packs.behavior) : null;
  const resourceSrc = resourceEnabled ? resolve(rootDir, config.packs.resource) : null;
  const behaviorDest = behaviorSrc ? resolve(outDir, config.packs.behavior) : null;
  const resourceDest = resourceSrc ? resolve(outDir, config.packs.resource) : null;

  await rm(outDir, { recursive: true, force: true });

  // Run ESLint if available
  const eslintBin = process.platform === "win32" ? "eslint.cmd" : "eslint";
  const eslintPath = resolve(rootDir, "node_modules", ".bin", eslintBin);
  try {
    await access(eslintPath);
    await new Promise((resolvePromise, reject) => {
      const child = spawn(eslintPath, ["packs/behavior/scripts/**/*.{ts,js}"], {
        cwd: rootDir,
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) resolvePromise();
        else reject(new Error(\`eslint exited with code \${code}\`));
      });
    });
  } catch {
    console.warn("[local] eslint not found or failed; skipping lint.");
  }

  // Bundle TS entry if present
  if (behaviorEnabled && config.script?.entry?.endsWith(".ts")) {
    if (!behaviorSrc || !behaviorDest) throw new Error("Behavior pack path missing");
    const entryAbs = resolve(behaviorSrc, config.script.entry);
    const outfile = resolve(
      behaviorDest,
      config.script.entry.replace(/\\.ts$/, ".js"),
    );
    const externals =
      (config.script.dependencies ?? [])
        .filter(
          (d) => d.module_name !== "@minecraft/math" && d.module_name !== "@minecraft/vanilla-data",
        )
        .map((d) => d.module_name) ?? [];
    await esbuild({
      entryPoints: [entryAbs],
      outfile,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "es2021",
      sourcemap: true,
      external: externals,
    });
  }

  if (behaviorEnabled && behaviorSrc && behaviorDest) {
    await cp(behaviorSrc, behaviorDest, {
      recursive: true,
      force: true,
      filter: (src) => {
        if (!config.script?.entry?.endsWith(".ts")) return true;
        const entryAbs = resolve(behaviorSrc, config.script.entry);
        return src !== entryAbs; // skip TS entry when bundled
      },
    });
  }
  if (resourceEnabled && resourceSrc && resourceDest) {
    await cp(resourceSrc, resourceDest, { recursive: true, force: true });
  }
  const outStat = await stat(outDir);
  if (!outStat.isDirectory()) {
    throw new Error(\`Build output missing: \${outDir}\`);
  }
  console.log(\`[local] build completed -> \${outDir}\`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
`;

const localPackageScript = `import { resolve, dirname } from "node:path";
import { stat } from "node:fs/promises";
import { readFile } from "node:fs/promises";

async function getZipTask() {
  const coreBuild = await import("@minecraft/core-build-tasks");
  const task = coreBuild.zipTask || coreBuild["zipTask"];
  if (!task) throw new Error("zipTask not found in @minecraft/core-build-tasks");
  return task;
}

async function main() {
  const config = JSON.parse(await readFile("./bkit.config.json", "utf8"));
  const rootDir = config.paths?.root ? resolve(config.paths.root) : process.cwd();
  const buildDir = resolve(rootDir, config.build?.outDir ?? "dist");
  const behaviorEnabled = config.packSelection?.behavior !== false;
  const resourceEnabled = config.packSelection?.resource !== false;
  const behaviorPath = behaviorEnabled ? resolve(buildDir, config.packs.behavior) : null;
  const resourcePath = resourceEnabled ? resolve(buildDir, config.packs.resource) : null;

  const st = await stat(buildDir);
  if (!st.isDirectory()) throw new Error(\`Build directory not found: \${buildDir}\`);

  const baseName = config.project?.name ?? "addon";
  const behaviorOut = resolve(buildDir, \`\${baseName}_behavior.mcpack\`);
  const resourceOut = resolve(buildDir, \`\${baseName}_resource.mcpack\`);
  const zipTask = await getZipTask();

  if (behaviorEnabled && behaviorPath) {
    await zipTask(behaviorOut, [{ contents: [behaviorPath], targetPath: "" }])((err) => {
      if (err) throw err;
    });
    console.log(\`[local] behavior mcpack -> \${behaviorOut}\`);
  }
  if (resourceEnabled && resourcePath) {
    await zipTask(resourceOut, [{ contents: [resourcePath], targetPath: "" }])((err) => {
      if (err) throw err;
    });
    console.log(\`[local] resource mcpack -> \${resourceOut}\`);
  }
  if (behaviorEnabled && resourceEnabled && behaviorPath && resourcePath) {
    const addonOut = resolve(buildDir, \`\${baseName}.mcaddon\`);
    await zipTask(addonOut, [
      { contents: [behaviorPath], targetPath: "behavior_pack" },
      { contents: [resourcePath], targetPath: "resource_pack" },
    ])((err) => {
      if (err) throw err;
    });
    console.log(\`[local] mcaddon -> \${addonOut}\`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
`;

export async function writeLocalToolScripts(targetDir: string, config: BkitConfig): Promise<void> {
  const toolsDir = resolve(targetDir, "tools");
  await mkdir(toolsDir, { recursive: true });
  await writeFile(resolve(toolsDir, "local-build.mjs"), localBuildScript, "utf8");
  await writeFile(resolve(toolsDir, "local-package.mjs"), localPackageScript, "utf8");
}

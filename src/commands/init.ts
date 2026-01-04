import {
  confirm,
  intro,
  isCancel,
  outro,
  select,
  spinner,
  text,
  multiselect,
} from "@clack/prompts";
import { resolve } from "node:path";
import {
  DEFAULT_SCRIPT_API_VERSION,
  buildScriptDependencies,
  buildScriptDependenciesFromMap,
  generateManifest,
} from "../manifest.js";
import { knownTemplates } from "../templates.js";
import type { CommandContext, ScriptApiSelection, ScriptApiVersionMap } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, isDirEmpty, writeJson } from "../utils/fs.js";
import { writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fetchNpmVersionChannels } from "../utils/npm.js";

const cwd = process.cwd();

export async function handleInit(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  let projectName =
    (parsed.flags.name as string | undefined) ?? parsed.positional[0];
  const templateArg = parsed.flags.template as string | undefined;
  const nonInteractive = !!parsed.flags.yes;
  let includeScript = parsed.flags["no-script"] ? false : true;
  const scriptEntry = (parsed.flags["script-entry"] as string | undefined) ?? "scripts/main.ts";
  const scriptLanguage: "typescript" | "javascript" | undefined = includeScript
    ? "typescript"
    : undefined;
  let scriptApiVersion =
    (parsed.flags["script-api-version"] as string | undefined) || DEFAULT_SCRIPT_API_VERSION;
  let scriptApiVersions: ScriptApiVersionMap = {};
  let scriptApiSelection: ScriptApiSelection = {
    server: true,
    serverUi: true,
    common: false,
    math: false,
  };
  let skipInstall = !!parsed.flags["skip-install"];
  let installStatus: "skipped" | "completed" | "failed" = skipInstall
    ? "skipped"
    : "completed";
  let installCommandLabel = "npm install";
  const force = !!parsed.flags.force;

  if (!projectName && !nonInteractive) {
    const nameInput = await text({
      message: "Project name",
      initialValue: "example-addon",
      validate: (value) =>
        value.trim().length === 0 ? "Project name is required" : undefined,
    });
    if (isCancel(nameInput)) {
      outro("Cancelled.");
      return;
    }
    projectName = String(nameInput).trim();
    parsed.positional[0] = projectName;
  }

  const dirFlag =
    (parsed.flags.dir as string | undefined) ??
    (parsed.flags["target-dir"] as string | undefined);
  const baseDir = resolve(cwd, "project", "addon");
  const nameForPath = projectName ?? "addon";
  const targetDir = dirFlag ? resolve(cwd, dirFlag) : resolve(baseDir, nameForPath);
  const targetName =
    projectName ??
    ((dirFlag ?? targetDir).split(/[/\\]/).filter(Boolean).pop() ?? "project");
  let template = templateArg;
  if (!template && !nonInteractive) {
    const choice = await select({
      message: "Choose a template",
      options: knownTemplates,
    });
    if (isCancel(choice)) {
      outro("Cancelled.");
      return;
    }
    template = String(choice);
  }

  if (!nonInteractive && parsed.flags["no-script"] === undefined) {
    const scriptChoice = await confirm({
      message: "Include script module?",
      initialValue: includeScript,
    });
    if (isCancel(scriptChoice)) {
      outro("Cancelled.");
      return;
    }
    includeScript = !!scriptChoice;
  }

  if (includeScript && !nonInteractive && parsed.flags["script-api-version"] === undefined) {
    const pkgChoice = await multiselect({
      message: "Select Script API packages to include (space to toggle)",
      options: [
        { value: "server", label: "@minecraft/server", hint: "Core Script API" },
        { value: "serverUi", label: "@minecraft/server-ui", hint: "UI helpers" },
        { value: "common", label: "@minecraft/common", hint: "Shared utilities" },
        { value: "math", label: "@minecraft/math", hint: "Math helpers" },
      ],
      initialValues: ["server", "serverUi", "common", "math"],
    });
    if (isCancel(pkgChoice)) {
      outro("Cancelled.");
      return;
    }
    const selected = new Set(pkgChoice as string[]);
    scriptApiSelection = {
      server: selected.has("server"),
      serverUi: selected.has("serverUi"),
      common: selected.has("common"),
      math: selected.has("math"),
    };
    if (!selected.size) {
      includeScript = false;
    }

    const cached = new Map<string, { channel: string; versions: string[] }>();

    const pickVersion = async (
      pkg: string,
      current: string,
    ): Promise<string | null> => {
      if (!cached.has(pkg)) {
        const channels = await fetchNpmVersionChannels(pkg, { limit: 15 });
        cached.set(pkg, {
          channel: "stable",
          versions: channels.stable.length
            ? channels.stable
            : [
                ...channels.beta,
                ...channels.alpha,
                ...channels.preview,
                ...channels.other,
              ],
        });
        cached.set(`${pkg}:beta`, { channel: "beta", versions: channels.beta });
        cached.set(`${pkg}:alpha`, { channel: "alpha", versions: channels.alpha });
        cached.set(`${pkg}:preview`, { channel: "preview", versions: channels.preview });
        cached.set(`${pkg}:other`, { channel: "other", versions: channels.other });
      }

      const channelChoice = await select({
        message: `${pkg} channel`,
        options: [
          { value: "stable", label: "stable" },
          { value: "beta", label: "beta" },
          { value: "alpha", label: "alpha" },
          { value: "preview", label: "preview" },
          { value: "other", label: "other" },
          { value: "__manual__", label: "Enter manually" },
        ],
        initialValue: "stable",
      });
      if (isCancel(channelChoice)) return null;

      if (channelChoice === "__manual__") {
        const manual = await text({
          message: `${pkg} version (manual)`,
          initialValue: current,
          validate: (v) => (!v.trim() ? "Version is required" : undefined),
        });
        return isCancel(manual) ? null : manual.trim();
      }

      const bucket =
        channelChoice === "stable"
          ? cached.get(pkg)
          : cached.get(`${pkg}:${channelChoice}`);
      const versions = bucket?.versions ?? [];
      if (!versions.length) {
        const manual = await text({
          message: `${pkg} version (manual, no versions for channel ${channelChoice})`,
          initialValue: current,
          validate: (v) => (!v.trim() ? "Version is required" : undefined),
        });
        return isCancel(manual) ? null : manual.trim();
      }

      const choice = await select({
        message: `${pkg} version (${channelChoice})`,
        options: [
          ...versions.map((v) => ({ value: v, label: v })),
          { value: "__manual__", label: "Enter manually" },
        ],
        initialValue: versions[0] ?? current,
      });
      if (isCancel(choice)) return null;
      if (choice === "__manual__") {
        const manual = await text({
          message: `${pkg} version (manual)`,
          initialValue: current,
          validate: (v) => (!v.trim() ? "Version is required" : undefined),
        });
        return isCancel(manual) ? null : manual.trim();
      }
      return String(choice);
    };

    scriptApiVersions = {};
    const selectedPackages: [keyof ScriptApiVersionMap, string][] = [];
    if (scriptApiSelection.server) selectedPackages.push(["server", "@minecraft/server"]);
    if (scriptApiSelection.serverUi) selectedPackages.push(["serverUi", "@minecraft/server-ui"]);
    if (scriptApiSelection.common) selectedPackages.push(["common", "@minecraft/common"]);
    if (scriptApiSelection.math) selectedPackages.push(["math", "@minecraft/math"]);

    for (const [key, pkg] of selectedPackages) {
      const picked = await pickVersion(pkg, scriptApiVersion);
      if (picked === null) {
        outro("Cancelled.");
        return;
      }
      scriptApiVersions[key] = picked;
      if (!scriptApiVersion) {
        scriptApiVersion = picked;
      }
    }
  }

  if (includeScript && !nonInteractive && parsed.flags["skip-install"] === undefined) {
    const installChoice = await select({
      message: "Install dependencies?",
      options: [
        { value: "npm-install", label: "npm install" },
        { value: "npm-ci", label: "npm ci" },
        { value: "pnpm-install", label: "pnpm install" },
        { value: "yarn-install", label: "yarn install" },
        { value: "skip", label: "Skip" },
      ],
      initialValue: "npm-install",
    });
    if (isCancel(installChoice)) {
      outro("Cancelled.");
      return;
    }
    if (installChoice === "skip") {
      skipInstall = true;
      installStatus = "skipped";
    } else {
      installCommandLabel = installChoice.replace("-", " ");
    }
  }

  if (!force && !isDirEmpty(targetDir)) {
    console.error(
      `Target directory ${targetDir} is not empty. Use --force to initialize anyway.`,
    );
    process.exitCode = 1;
    return;
  }

  intro("Initializing workspace");
  const spin = spinner();
  spin.start("Generating manifests and config");

  const behaviorManifest = generateManifest({
    type: "behavior",
    name: targetName,
    includeScriptModule: includeScript,
    scriptEntry,
    scriptLanguage,
    scriptApiVersion,
    scriptApiVersions,
    scriptApiSelection,
  });
  const resourceManifest = generateManifest({
    type: "resource",
    name: targetName,
  });
  behaviorManifest.dependencies = [
    ...(behaviorManifest.dependencies ?? []),
    { uuid: resourceManifest.header.uuid, version: resourceManifest.header.version },
  ];
  resourceManifest.dependencies = [
    { uuid: behaviorManifest.header.uuid, version: behaviorManifest.header.version },
  ];

  const configPath = resolve(targetDir, "bkit.config.json");
  const config = {
    project: { name: targetName, version: "1.0.0" },
    template: template ?? "bkit-default",
    packs: {
      behavior: "packs/behavior",
      resource: "packs/resource",
    },
    build: {
      outDir: "dist",
      target: "dev",
    },
    sync: {
      defaultTarget: "dev",
    },
    paths: {
      root: targetDir,
    },
    script: includeScript
      ? {
          entry: scriptEntry,
          language: scriptLanguage,
          dependencies:
            Object.keys(scriptApiVersions).length > 0
              ? buildScriptDependenciesFromMap(scriptApiVersions, scriptApiVersion)
              : buildScriptDependencies(scriptApiVersion),
          apiVersion: scriptApiVersion,
        }
      : undefined,
  };

  try {
    await writeJson(resolve(targetDir, "packs/behavior/manifest.json"), behaviorManifest);
    await writeJson(resolve(targetDir, "packs/resource/manifest.json"), resourceManifest);
    await writeJson(configPath, config);
    await ensureDir(resolve(targetDir, "dist"));
    if (includeScript) {
      const scriptPath = resolve(targetDir, "packs/behavior", scriptEntry);
      const scriptDir = resolve(scriptPath, "..");
      await ensureDir(scriptDir);
      const defaultScript =
        scriptLanguage === "typescript"
          ? `import { world, system } from "@minecraft/server";\nlet init = false;\n\nsystem.runInterval(() => {\n  if (!init) {\n    world.sendMessage(\`["${targetName}"] Initialized\`);\n    init = true;\n  }\n});\n`
          : `import { world, system } from "@minecraft/server";\nlet init = false;\n\nsystem.runInterval(() => {\n  if (!init) {\n    world.sendMessage(\`["${targetName}"] Initialized\`);\n    init = true;\n  }\n});\n`;
      await writeFile(scriptPath, defaultScript, { encoding: "utf8" });
      await writeJson(
        resolve(targetDir, "package.json"),
        buildPackageJson(targetName, scriptApiVersion, scriptApiVersions),
      );
      await writeJson(resolve(targetDir, "tsconfig.json"), buildTsConfig(scriptEntry));
    }
  } catch (err) {
    spin.stop("Failed to write files");
    throw err;
  }

  spin.stop("Workspace files created");

  if (includeScript && !skipInstall) {
    const installSpin = spinner();
    installSpin.start(`Installing dependencies (${installCommandLabel})`);
    try {
      await runInstall(targetDir, installCommandLabel);
      installSpin.stop("Dependencies installed");
      installStatus = "completed";
    } catch (err) {
      installSpin.stop("Failed to install dependencies (continuing without install)");
      console.error(err instanceof Error ? err.message : String(err));
      installStatus = "failed";
    }
  } else if (includeScript) {
    console.log("Skipped dependency install (use --skip-install to control this).");
  }

  outro(
    [
      `Created workspace at ${targetDir}`,
      `- behavior pack manifest: packs/behavior/manifest.json`,
      `- resource pack manifest: packs/resource/manifest.json`,
      `- config: bkit.config.json`,
      includeScript
        ? `- script entry: ${scriptEntry} (language: ${scriptLanguage}, api: ${scriptApiVersion}, dependencies: ${buildScriptDependencies(scriptApiVersion)
            .map((d) => d.module_name)
            .join(", ")})`
        : "",
      includeScript
        ? installStatus === "completed"
          ? `- ${installCommandLabel} completed`
          : installStatus === "skipped"
            ? `- ${installCommandLabel} skipped`
            : `- ${installCommandLabel} failed (see log above)`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function buildPackageJson(
  name: string,
  scriptApiVersion: string,
  scriptApiVersions: ScriptApiVersionMap,
) {
  return {
    name,
    version: "1.0.0",
    private: true,
    type: "module",
    description: "BedrockKit addon project",
    dependencies: {
      "@minecraft/server": scriptApiVersions.server ?? scriptApiVersion,
      "@minecraft/server-ui": scriptApiVersions.serverUi ?? scriptApiVersion,
      "@minecraft/common": scriptApiVersions.common ?? scriptApiVersion,
      "@minecraft/math": scriptApiVersions.math ?? scriptApiVersion,
    },
    devDependencies: {
      typescript: "^5.3.3",
    },
    scripts: {
      typecheck: "tsc --noEmit",
    },
  };
}

function buildTsConfig(scriptEntry: string) {
  return {
    compilerOptions: {
      target: "ES2021",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
    },
    include: [scriptEntry, "packs/behavior/scripts/**/*.ts"],
  };
}

function runInstall(cwd: string, label: string): Promise<void> {
  const isWin = process.platform === "win32";
  const normalizeLabel = label.trim().toLowerCase();

  const parseLabel = (): { cmd: string; args: string[]; shell: boolean } => {
    if (normalizeLabel.startsWith("npm ci")) {
      return { cmd: "npm", args: ["ci"], shell: isWin };
    }
    if (normalizeLabel.startsWith("npm install")) {
      return { cmd: "npm", args: ["install"], shell: isWin };
    }
    if (normalizeLabel.startsWith("pnpm install")) {
      return { cmd: "pnpm", args: ["install"], shell: true };
    }
    if (normalizeLabel.startsWith("yarn install")) {
      return { cmd: "yarn", args: ["install"], shell: true };
    }
    return { cmd: "npm", args: ["install"], shell: isWin };
  };

  return new Promise((resolve, reject) => {
    const { cmd, args, shell } = parseLabel();

    const run = (useShell: boolean, reason?: string) => {
      if (useShell && reason) {
        console.warn(`Falling back to shell install (${reason})`);
      }
      const child = spawn(cmd, args, {
        cwd,
        stdio: "inherit",
        shell: useShell || shell,
      });

      child.on("error", (err) => {
        if (!useShell && (err as NodeJS.ErrnoException).code === "EINVAL") {
          run(true, "EINVAL");
        } else {
          reject(err);
        }
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else if (!useShell) {
          run(true, `exit ${code}`);
        } else {
          reject(new Error(`${label} exited with code ${code}`));
        }
      });
    };

    run(false);
  });
}

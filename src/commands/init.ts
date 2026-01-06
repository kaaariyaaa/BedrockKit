import {
  confirm,
  intro,
  isCancel,
  outro,
  select,
  spinner,
  text,
  multiselect,
  log, // Import log
} from "@clack/prompts";
import pc from "picocolors";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  DEFAULT_SCRIPT_API_VERSION,
  buildScriptDependencies,
  buildScriptDependenciesFromMap,
  generateManifest,
} from "../core/manifest.js";
import {
  SCRIPT_API_OPTIONS,
  createScriptApiVersionPicker,
  defaultScriptApiSelection,
  toScriptApiSelection,
} from "../core/script-api.js";
import { knownTemplates, loadTemplateRegistry, materializeTemplate } from "../core/templates.js";
import { writeIgnoreFiles } from "../core/scaffold.js";
import type {
  BkitConfig,
  CommandContext,
  ScriptApiSelection,
  ScriptApiVersionMap,
  ScriptLanguage,
} from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, isDirEmpty, writeJson } from "../utils/fs.js";
import { writeFile, cp } from "node:fs/promises";
import { runInstallCommand } from "../utils/npm-install.js";
import { resolveLang, t } from "../utils/i18n.js";
import { writeLocalToolScripts } from "../utils/tooling.js";
import { loadSettings, resolveProjectRoot } from "../utils/settings.js";

const cwd = process.cwd();

export async function handleInit(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  let projectName =
    (parsed.flags.name as string | undefined) ?? parsed.positional[0];
  const templateArg = parsed.flags.template as string | undefined;
  const nonInteractive = !!parsed.flags.yes;
  let includeScript = parsed.flags["no-script"] ? false : true;
  const scriptEntry = (parsed.flags["script-entry"] as string | undefined) ?? "scripts/main.ts";
  const scriptLanguage: ScriptLanguage | undefined =
    includeScript && scriptEntry.endsWith(".ts") ? "typescript" : includeScript ? "javascript" : undefined;
  let scriptApiVersion =
    (parsed.flags["script-api-version"] as string | undefined) || DEFAULT_SCRIPT_API_VERSION;
  let scriptApiVersions: ScriptApiVersionMap = {};
  let scriptApiSelection: ScriptApiSelection = defaultScriptApiSelection();
  const eslintRulesFlag = parsed.flags["eslint-rules"] as string | undefined;
  const disableEslint = !!parsed.flags["no-eslint"];
  const availableEslintRules = ["minecraft-linting/avoid-unnecessary-command"];
  let eslintRules: string[] =
    eslintRulesFlag?.split(",").map((s) => s.trim()).filter(Boolean) ??
    (disableEslint ? [] : [...availableEslintRules]);
  let skipInstall = !!parsed.flags["skip-install"];
  let installStatus: "skipped" | "completed" | "failed" = skipInstall
    ? "skipped"
    : "completed";
  let installCommandLabel = "npm install";
  const force = !!parsed.flags.force;

  if (!projectName && !nonInteractive) {
    const nameInput = await text({
      message: t("init.projectName", lang),
      initialValue: "example-addon",
      validate: (value) =>
        value.trim().length === 0 ? t("init.projectNameRequired", lang) : undefined,
    });
    if (isCancel(nameInput)) {
      outro(t("common.cancelled", lang));
      return;
    }
    projectName = String(nameInput).trim();
    parsed.positional[0] = projectName;
  }

  const dirFlag =
    (parsed.flags.dir as string | undefined) ??
    (parsed.flags["target-dir"] as string | undefined);
  const settings = await loadSettings();
  const baseDir = resolveProjectRoot(settings);
  const nameForPath = projectName ?? "addon";
  const targetDir = dirFlag ? resolve(cwd, dirFlag) : resolve(baseDir, nameForPath);
  const targetName =
    projectName ??
    ((dirFlag ?? targetDir).split(/[/\\]/).filter(Boolean).pop() ?? "project");
  let template = templateArg;
  if (!template && !nonInteractive) {
    const choice = await select({
      message: t("init.chooseTemplate", lang),
      options: knownTemplates,
    });
    if (isCancel(choice)) {
      outro(t("common.cancelled", lang));
      return;
    }
    template = String(choice);
  }

  let packSelection = {
    behavior: true,
    resource: true,
  };
  if (!nonInteractive) {
    const selectedPacks = await multiselect({
      message: t("init.selectPacks", lang),
      options: [
        { value: "behavior", label: t("init.pack.behavior", lang) },
        { value: "resource", label: t("init.pack.resource", lang) },
      ],
      initialValues: ["behavior", "resource"],
    });
    if (isCancel(selectedPacks)) {
      outro(t("common.cancelled", lang));
      return;
    }
    const set = new Set(selectedPacks as string[]);
    packSelection = {
      behavior: set.has("behavior"),
      resource: set.has("resource"),
    };
    if (!packSelection.behavior && !packSelection.resource) {
      log.error(t("init.packsRequired", lang));
      process.exitCode = 1;
      return;
    }
  }

  if (!nonInteractive && parsed.flags["no-script"] === undefined) {
    const scriptChoice = await confirm({
      message: t("init.includeScript", lang),
      initialValue: includeScript,
    });
    if (isCancel(scriptChoice)) {
      outro(t("common.cancelled", lang));
      return;
    }
    includeScript = !!scriptChoice;
  }

  if (includeScript && !nonInteractive && !disableEslint && !eslintRulesFlag) {
    const ruleChoice = await multiselect({
      message: t("init.enableEslintRules", lang),
      options: availableEslintRules.map((r) => ({ value: r, label: r })),
      initialValues: availableEslintRules,
    });
    if (isCancel(ruleChoice)) {
      outro(t("common.cancelled", lang));
      return;
    }
    eslintRules = ruleChoice as string[];
  }

  if (includeScript && !nonInteractive && parsed.flags["script-api-version"] === undefined) {
    const pkgChoice = await multiselect({
      message: t("init.selectPackages", lang),
      options: SCRIPT_API_OPTIONS.map((opt) => ({
        value: opt.key,
        label: opt.label,
        hint: opt.hint,
      })),
      initialValues: ["server", "serverUi"],
    });
    if (isCancel(pkgChoice)) {
      outro(t("common.cancelled", lang));
      return;
    }
    const selected = new Set(pkgChoice as string[]);
    scriptApiSelection = toScriptApiSelection(selected);
    if (!selected.size) {
      includeScript = false;
    }

    const pickVersion = createScriptApiVersionPicker(lang);
    scriptApiVersions = {};
    for (const opt of SCRIPT_API_OPTIONS) {
      if (!scriptApiSelection[opt.key]) continue;
      const picked = await pickVersion(opt.pkg, scriptApiVersion);
      if (picked === null) {
        outro(t("common.cancelled", lang));
        return;
      }
      scriptApiVersions[opt.key] = picked;
      if (!scriptApiVersion) {
        scriptApiVersion = picked;
      }
    }
  }

  if (includeScript && !nonInteractive && parsed.flags["skip-install"] === undefined) {
    const installChoice = await select({
      message: t("init.installDeps", lang),
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
      outro(t("common.cancelled", lang));
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
    log.error(
      `Target directory ${targetDir} is not empty. Use --force to initialize anyway.`,
    );
    process.exitCode = 1;
    return;
  }

  const registry = await loadTemplateRegistry();
  
  // Note: We don't verify if we are in interactive mode to clear screen, 
  // but let's just make the intro nice.
  intro(pc.inverse(" BedrockKit Init "));
  
  const spin = spinner();
  spin.start(t("init.generating", lang));

  const manifestScriptEntry =
    scriptEntry?.endsWith(".ts") && includeScript ? scriptEntry.replace(/\.ts$/, ".js") : scriptEntry;

  const behaviorManifest = packSelection.behavior
    ? generateManifest({
        type: "behavior",
      name: targetName,
      includeScriptModule: includeScript,
      scriptEntry: manifestScriptEntry,
      scriptLanguage: "javascript",
      scriptApiVersion,
      scriptApiVersions,
      scriptApiSelection,
    })
    : undefined;

  const resourceManifest = packSelection.resource
    ? generateManifest({
        type: "resource",
        name: targetName,
      })
    : undefined;

  if (behaviorManifest && resourceManifest) {
    behaviorManifest.dependencies = [
      ...(behaviorManifest.dependencies ?? []),
      { uuid: resourceManifest.header.uuid, version: resourceManifest.header.version },
    ];
    resourceManifest.dependencies = [
      { uuid: behaviorManifest.header.uuid, version: behaviorManifest.header.version },
    ];
  }

  const configPath = resolve(targetDir, "bkit.config.json");
  const config: BkitConfig = {
    project: { name: targetName, version: "1.0.0" },
    template: template ?? "bkit-default",
    packSelection,
    packs: {
      behavior: "packs/behavior",
      resource: "packs/resource",
    },
    build: {
      outDir: "dist",
      target: "dev",
    },
    sync: {
      defaultTarget: "gdk",
      targets: {
        gdk: {
          product: "BedrockGDK",
          projectName: targetName,
        },
      },
    },
    paths: {
      root: targetDir,
    },
    script: includeScript
      ? {
          entry: scriptEntry,
          language: (scriptLanguage ?? "javascript") as ScriptLanguage,
          dependencies:
            Object.keys(scriptApiVersions).length > 0
              ? buildScriptDependenciesFromMap(scriptApiVersions, scriptApiVersion, scriptApiSelection)
              : buildScriptDependencies(scriptApiVersion, scriptApiSelection),
          apiVersion: scriptApiVersion,
        }
      : undefined,
  };

  try {
    // If a template repo is selected and available, copy its contents before generating files.
    let templatePath: string | null = null;
    if (template === "custom-git" && !templateArg && !nonInteractive) {
      const gitUrl = await text({
        message: "Enter Git URL for template",
        validate: (v) => (!v.trim() ? t("common.required", lang) : undefined),
      });
      if (isCancel(gitUrl)) {
        outro(t("common.cancelled", lang));
        return;
      }
      templatePath = await materializeTemplate(String(gitUrl).trim(), registry, { allowUrl: true });
    } else if (template) {
      templatePath = await materializeTemplate(template, registry, { allowUrl: false });
    }
    if (templatePath) {
      await ensureDir(targetDir);
      await cp(templatePath, targetDir, { recursive: true, force: true });
    }

    if (behaviorManifest) {
      await writeJson(resolve(targetDir, "packs/behavior/manifest.json"), behaviorManifest);
    }
    if (resourceManifest) {
      await writeJson(resolve(targetDir, "packs/resource/manifest.json"), resourceManifest);
    }
    await writeJson(configPath, config);
    await writeIgnoreFiles(targetDir);
    await writeLocalToolScripts(targetDir, config);
    // ESLint config (TS + minecraft-linting)
    const eslintConfig = `import minecraftLinting from "eslint-plugin-minecraft-linting";
import tsParser from "@typescript-eslint/parser";
import ts from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["packs/behavior/scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
    },
    plugins: {
      ts,
      "minecraft-linting": minecraftLinting,
    },
    rules: {
${eslintRules
  .map((r) => `      "${r}": "error",`)
  .join("\n") || "      // no rules enabled"}
    },
  },
];
`;
    await writeFile(resolve(targetDir, "eslint.config.js"), eslintConfig, { encoding: "utf8" });
    await ensureDir(resolve(targetDir, "dist"));
    if (includeScript && packSelection.behavior) {
      const scriptPath = resolve(targetDir, "packs/behavior", scriptEntry);
      const scriptDir = resolve(scriptPath, "..");
      await ensureDir(scriptDir);
      const defaultScript = `import { world, system } from "@minecraft/server";\nconst addonName = "${targetName}";\nlet init = false;\n\nsystem.runInterval(() => {\n  if (!init) {\n    world.sendMessage(\`[\${addonName}] Initialized\`);\n    init = true;\n  }\n});\n`;
      await writeFile(scriptPath, defaultScript, { encoding: "utf8" });
      await writeJson(
        resolve(targetDir, "package.json"),
        buildPackageJson(targetName, scriptApiVersion, scriptApiVersions, scriptApiSelection),
      );
      await writeJson(resolve(targetDir, "tsconfig.json"), buildTsConfig(scriptEntry));
    }
  } catch (err) {
    spin.stop("Failed to write files");
    throw err;
  }

  spin.stop(t("init.summary", lang));

  if (includeScript && !skipInstall) {
    const installSpin = spinner();
    installSpin.start(`${t("init.installingDeps", lang)} (${installCommandLabel})`);
    try {
      await runInstall(targetDir, installCommandLabel);
      installSpin.stop("Dependencies installed");
      installStatus = "completed";
    } catch (err) {
      installSpin.stop(t("init.installFailed", lang));
      log.error(err instanceof Error ? err.message : String(err));
      installStatus = "failed";
    }
  } else if (includeScript) {
    log.info("Skipped dependency install (use --skip-install to control this).");
  }

  outro(
    [
      `Created workspace at ${targetDir}`,
      `- behavior pack manifest: packs/behavior/manifest.json`,
      `- resource pack manifest: packs/resource/manifest.json`,
      `- config: bkit.config.json`,
      includeScript
        ? `- script entry: ${scriptEntry} (language: ${scriptLanguage}, api: ${scriptApiVersion}, dependencies: ${buildScriptDependencies(scriptApiVersion, scriptApiSelection)
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
  selection: ScriptApiSelection,
) {
  return {
    name,
    version: "1.0.0",
    private: true,
    type: "module",
    description: "BedrockKit addon project",
    dependencies: {
      "@minecraft/server": selection.server ? scriptApiVersions.server ?? scriptApiVersion : undefined,
      "@minecraft/server-ui": selection.serverUi
        ? scriptApiVersions.serverUi ?? scriptApiVersion
        : undefined,
      "@minecraft/common": selection.common ? scriptApiVersions.common ?? scriptApiVersion : undefined,
      "@minecraft/math": selection.math ? scriptApiVersions.math ?? scriptApiVersion : undefined,
      "@minecraft/server-net": selection.serverNet
        ? scriptApiVersions.serverNet ?? scriptApiVersion
        : undefined,
      "@minecraft/server-gametest": selection.serverGametest
        ? scriptApiVersions.serverGametest ?? scriptApiVersion
        : undefined,
      "@minecraft/server-admin": selection.serverAdmin
        ? scriptApiVersions.serverAdmin ?? scriptApiVersion
        : undefined,
      "@minecraft/debug-utilities": selection.debugUtilities
        ? scriptApiVersions.debugUtilities ?? scriptApiVersion
        : undefined,
      "@minecraft/vanilla-data": selection.vanillaData
        ? scriptApiVersions.vanillaData ?? scriptApiVersion
        : undefined,
    },
    devDependencies: {
      typescript: "^5.3.3",
      eslint: "^9.14.0",
      "@typescript-eslint/parser": "^8.13.0",
      "@typescript-eslint/eslint-plugin": "^8.13.0",
      "eslint-plugin-minecraft-linting": "^1.0.0",
      esbuild: "^0.24.0",
      "@minecraft/core-build-tasks": "^1.1.6",
    },
    scripts: {
      typecheck: "tsc --noEmit",
      lint: "eslint \"packs/behavior/scripts/**/*.{ts,js}\"",
      "build:local": "node ./tools/local-build.mjs",
      "package:local": "node ./tools/local-package.mjs",
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
  const normalizeLabel = label.trim().toLowerCase();
  if (normalizeLabel.startsWith("npm ci")) {
    return runInstallCommand(cwd, [], { args: ["ci"] });
  }
  if (normalizeLabel.startsWith("npm install")) {
    return runInstallCommand(cwd, [], { args: ["install"] });
  }
  if (normalizeLabel.startsWith("pnpm install")) {
    return runInstallCommand(cwd, [], { cmd: "pnpm", args: ["install"], shell: true });
  }
  if (normalizeLabel.startsWith("yarn install")) {
    return runInstallCommand(cwd, [], { cmd: "yarn", args: ["install"], shell: true });
  }
  return runInstallCommand(cwd, [], { args: ["install"] });
}

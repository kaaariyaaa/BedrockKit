import {
  confirm,
  intro,
  isCancel,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { resolve } from "node:path";
import {
  DEFAULT_SCRIPT_API_VERSION,
  buildScriptDependencies,
  generateManifest,
} from "../manifest.js";
import { knownTemplates } from "../templates.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { ensureDir, isDirEmpty, writeJson } from "../utils/fs.js";

const cwd = process.cwd();

export async function handleInit(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  let projectName =
    (parsed.flags.name as string | undefined) ?? parsed.positional[0];
  const templateArg = parsed.flags.template as string | undefined;
  const nonInteractive = !!parsed.flags.yes;
  const includeScript = parsed.flags["no-script"] ? false : true;
  const scriptEntry = (parsed.flags["script-entry"] as string | undefined) ?? "scripts/main.js";
  const scriptLanguage = (parsed.flags["script-language"] as
    | "javascript"
    | "typescript"
    | undefined) ?? "javascript";
  const scriptApiVersion =
    (parsed.flags["script-api-version"] as string | undefined) ||
    DEFAULT_SCRIPT_API_VERSION;
  const force = !!parsed.flags.force;

  if (!projectName && !nonInteractive) {
    const nameInput = await text({
      message: "Project name",
      initialValue: "addon",
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
  const targetDir = dirFlag
    ? resolve(cwd, dirFlag)
    : resolve(baseDir, nameForPath);
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
    script: includeScript
      ? {
          entry: scriptEntry,
          language: scriptLanguage,
          dependencies: buildScriptDependencies(scriptApiVersion),
          apiVersion: scriptApiVersion,
        }
      : undefined,
  };

  try {
    await writeJson(resolve(targetDir, "packs/behavior/manifest.json"), behaviorManifest);
    await writeJson(resolve(targetDir, "packs/resource/manifest.json"), resourceManifest);
    await writeJson(configPath, config);
    await ensureDir(resolve(targetDir, "dist"));
  } catch (err) {
    spin.stop("Failed to write files");
    throw err;
  }

  spin.stop("Workspace initialized");
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
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

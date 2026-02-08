import { rm, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { confirm, isCancel, select } from "../tui/prompts.js";
import { loadConfigContext } from "../core/config.js";
import { removeSymlinkEntries } from "../core/pack-ops.js";
import type { Lang } from "../types.js";
import type { ParsedArgsLike, ProjectInfo } from "../core/projects.js";
import {
  discoverProjects,
  parseProjectNames,
  promptSelectProjects,
} from "../core/projects.js";
import { pathExists } from "../utils/fs.js";
import { t } from "../utils/i18n.js";
import { resolveTargetPaths, type SyncTargetConfig } from "./sync-targets.js";

export async function runRemove(params: {
  parsed: ParsedArgsLike;
  lang: Lang;
  quiet: boolean;
  yes: boolean;
  interactive: boolean;
}): Promise<boolean> {
  const { parsed, lang, quiet, yes, interactive } = params;

  const projects = await discoverProjects();
  if (!projects.length) {
    console.error(t("remove.none", lang));
    return false;
  }

  const names = parseProjectNames(parsed);
  let selectedProjects: ProjectInfo[] | null = null;
  if (names.length > 0) {
    selectedProjects = projects.filter((p) => names.includes(p.name));
  } else if (interactive) {
    selectedProjects = await promptSelectProjects(lang, { initialAll: false });
  } else {
    selectedProjects = [];
  }

  selectedProjects = selectedProjects ?? [];
  if (!selectedProjects.length) {
    console.error(t("common.cancelled", lang));
    return false;
  }

  for (const name of names) {
    if (!projects.some((p) => p.name === name)) {
      console.error(t("remove.notFound", lang, { name }));
      return false;
    }
  }

  const removeDist = parsed.flags.dist ? true : false;
  const removeWatch = parsed.flags.watch ? true : false;

  if (!quiet && !yes) {
    const ok = await confirm({
      message:
        selectedProjects.length === 1
          ? t("remove.confirmProject", lang, { name: selectedProjects[0]!.name })
          : t("remove.confirmProjects", lang, { count: String(selectedProjects.length) }),
      initialValue: false,
    });
    if (isCancel(ok) || !ok) {
      console.error(t("common.cancelled", lang));
      return false;
    }
  }

  for (const project of selectedProjects) {
    const configCtx = await loadConfigContext(project.configPath);
    const distDir = resolve(project.root, configCtx.config.build?.outDir ?? "dist");
    const watchDir = resolve(project.root, ".watch-dist");
    const targetNames = Object.keys(configCtx.config.sync?.targets ?? {});
    let targetName = (parsed.flags.target as string | undefined) ?? configCtx.config.sync?.defaultTarget;
    if (!targetName || !(targetName in (configCtx.config.sync?.targets ?? {}))) {
      if (targetNames.length === 1) {
        targetName = targetNames[0];
      } else if (targetNames.length && !quiet) {
        const choice = await select({
          message: t("sync.selectTarget", lang),
          options: targetNames.map((n) => ({ value: n, label: n })),
        });
        if (!isCancel(choice)) targetName = String(choice);
      }
    }

    if (targetName) {
      const targetConfig = (configCtx.config.sync?.targets ?? {})[targetName] as
        | SyncTargetConfig
        | undefined;
      if (targetConfig) {
        const projectName = targetConfig.projectName ?? configCtx.config.project?.name ?? project.name;
        const targetPaths = resolveTargetPaths(targetConfig, projectName);
        const candidates = [targetPaths.behavior, targetPaths.resource].filter(
          (p): p is string => !!p,
        );
        for (const targetPath of candidates) {
          if (!(await pathExists(targetPath))) continue;
          const stat = await lstat(targetPath);
          if (stat.isSymbolicLink()) {
            await rm(targetPath, { recursive: true, force: true });
            continue;
          }
          if (!stat.isDirectory()) continue;
          await removeSymlinkEntries(targetPath);
        }
      }
    }

    await rm(project.root, { recursive: true, force: true });
    if (removeDist) {
      await rm(distDir, { recursive: true, force: true });
    }
    if (removeWatch) {
      await rm(watchDir, { recursive: true, force: true });
    }

    if (!quiet) {
      console.log(t("remove.done", lang, { name: project.name }));
    }
  }

  return true;
}

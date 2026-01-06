import { confirm, isCancel, select, text } from "@clack/prompts";
import {
  loadTemplateRegistry,
  saveTemplateRegistry,
  templateRegistryPath,
  cloneTemplate,
} from "../core/templates.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { resolveLang, t } from "../utils/i18n.js";

export async function handleTemplate(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  let [sub] = parsed.positional;
  const registry = await loadTemplateRegistry();

  if (!sub) {
    const choice = await select({
      message: t("template.commandPrompt", lang),
      options: [
        { value: "list", label: "List" },
        { value: "add", label: "Add(Git URL)" },
        { value: "pull", label: "Update" },
        { value: "rm", label: "Remove" },
      ],
      initialValue: "list",
    });
    if (isCancel(choice)) {
      console.log(t("template.aborted", lang));
      return;
    }
    sub = String(choice);
  }

  if (!sub || sub === "list") {
    console.log("[template] Known templates:");
    registry.forEach((t) =>
      console.log(`- ${t.name.padEnd(16)} ${t.url}${t.path ? ` (path: ${t.path})` : ""}`),
    );
    console.log(
      `Registry file: ${templateRegistryPath} (auto-created on add/remove)`,
    );
    return;
  }

  if (sub === "add") {
    let name = parsed.positional[1];
    let url = parsed.positional[2] ?? (parsed.flags.url as string | undefined);
    if (!name) {
      const input = await text({
        message: t("template.name", lang),
        validate: (v) => (!v.trim() ? t("template.nameRequired", lang) : undefined),
      });
      if (isCancel(input)) {
        console.log(t("template.aborted", lang));
        return;
      }
      name = String(input).trim();
    }
    if (!url) {
      const input = await text({
        message: t("template.url", lang),
        validate: (v) => (!v.trim() ? t("template.urlRequired", lang) : undefined),
      });
      if (isCancel(input)) {
        console.log(t("template.aborted", lang));
        return;
      }
      url = String(input).trim();
    }
    if (!name || !url) {
      console.error("Usage: template add <name> <git-url>");
      process.exitCode = 1;
      return;
    }
    if (registry.some((t) => t.name === name)) {
      console.error(`Template '${name}' already exists.`);
      process.exitCode = 1;
      return;
    }
    try {
      const path = await cloneTemplate(name, url);
      registry.push({ name, url, path });
      await saveTemplateRegistry(registry);
      console.log(`[template] Registered template '${name}' from ${url} (path: ${path})`);
    } catch (err) {
      console.error(
        `[template] Failed to clone template: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exitCode = 1;
    }
    return;
  }

  if (sub === "rm" || sub === "remove") {
    const name = parsed.positional[1];
    if (!name) {
      console.error("Usage: template rm <name>");
      process.exitCode = 1;
      return;
    }
    const ok = await confirm({
      message: t("template.removeConfirm", lang, { name }),
      initialValue: false,
    });
    if (isCancel(ok) || !ok) {
      console.log(t("template.aborted", lang));
      return;
    }
    const next = registry.filter((t) => t.name !== name);
    if (next.length === registry.length) {
      console.error(`Template '${name}' not found.`);
      process.exitCode = 1;
      return;
    }
    await saveTemplateRegistry(next);
    console.log(`[template] Removed template '${name}'`);
    return;
  }

  if (sub === "pull") {
    let name = parsed.positional[1];
    if (!name) {
      const input = await text({
        message: t("template.nameToUpdate", lang),
        validate: (v) => (!v.trim() ? t("template.nameRequired", lang) : undefined),
      });
      if (isCancel(input)) {
        console.log(t("template.aborted", lang));
        return;
      }
      name = String(input).trim();
    }
    if (!name) {
      console.error("Usage: template pull <name>");
      process.exitCode = 1;
      return;
    }
    const entry = registry.find((t) => t.name === name);
    if (!entry) {
      console.error(`Template '${name}' not found.`);
      process.exitCode = 1;
      return;
    }
    try {
      const path = await cloneTemplate(name, entry.url);
      entry.path = path;
      await saveTemplateRegistry(registry);
      console.log(`[template] Updated '${name}' from ${entry.url} (path: ${path})`);
    } catch (err) {
      console.error(
        `[template] Failed to update template: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exitCode = 1;
    }
    return;
  }

  console.error(`Unknown template subcommand: ${sub}`);
  process.exitCode = 1;
}

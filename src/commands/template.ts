import { confirm, isCancel, select, text } from "../tui/prompts.js";
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
        { value: "list", label: t("template.option.list", lang) },
        { value: "add", label: t("template.option.add", lang) },
        { value: "pull", label: t("template.option.pull", lang) },
        { value: "rm", label: t("template.option.remove", lang) },
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
    console.log(t("template.known", lang));
    registry.forEach((entry) =>
      console.log(
        t("template.listEntry", lang, {
          name: entry.name.padEnd(16),
          url: entry.url,
          path: entry.path ? t("template.listPath", lang, { path: entry.path }) : "",
        }),
      ),
    );
    console.log(t("template.registryFile", lang, { path: templateRegistryPath }));
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
      console.error(t("template.usageAdd", lang));
      process.exitCode = 1;
      return;
    }
    if (registry.some((t) => t.name === name)) {
      console.error(t("template.exists", lang, { name }));
      process.exitCode = 1;
      return;
    }
    try {
      const path = await cloneTemplate(name, url);
      registry.push({ name, url, path });
      await saveTemplateRegistry(registry);
      console.log(
        t("template.registered", lang, {
          name,
          url,
          path,
        }),
      );
    } catch (err) {
      console.error(
        t("template.cloneFailed", lang, {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      process.exitCode = 1;
    }
    return;
  }

  if (sub === "rm" || sub === "remove") {
    const name = parsed.positional[1];
    if (!name) {
      console.error(t("template.usageRemove", lang));
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
      console.error(t("template.notFound", lang, { name }));
      process.exitCode = 1;
      return;
    }
    await saveTemplateRegistry(next);
    console.log(t("template.removed", lang, { name }));
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
      console.error(t("template.usagePull", lang));
      process.exitCode = 1;
      return;
    }
    const entry = registry.find((t) => t.name === name);
    if (!entry) {
      console.error(t("template.notFound", lang, { name }));
      process.exitCode = 1;
      return;
    }
    try {
      const path = await cloneTemplate(name, entry.url);
      entry.path = path;
      await saveTemplateRegistry(registry);
      console.log(
        t("template.updated", lang, {
          name,
          url: entry.url,
          path,
        }),
      );
    } catch (err) {
      console.error(
        t("template.updateFailed", lang, {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      process.exitCode = 1;
    }
    return;
  }

  console.error(t("template.unknownSubcommand", lang, { sub: String(sub) }));
  process.exitCode = 1;
}

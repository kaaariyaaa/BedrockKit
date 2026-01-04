import { confirm, isCancel } from "@clack/prompts";
import { loadTemplateRegistry, saveTemplateRegistry, templateRegistryPath } from "../templates.js";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";

export async function handleTemplate(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const [sub] = parsed.positional;
  const registry = await loadTemplateRegistry();
  if (!sub || sub === "list") {
    console.log("[template] Known templates:");
    registry.forEach((t) =>
      console.log(`- ${t.name.padEnd(16)} ${t.url}`),
    );
    console.log(
      `Registry file: ${templateRegistryPath} (auto-created on add/remove)`,
    );
    return;
  }

  if (sub === "add") {
    const name = parsed.positional[1];
    const url = parsed.positional[2] ?? (parsed.flags.url as string | undefined);
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
    registry.push({ name, url });
    await saveTemplateRegistry(registry);
    console.log(`[template] Registered template '${name}' from ${url}`);
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
      message: `Remove template '${name}'?`,
      initialValue: false,
    });
    if (isCancel(ok) || !ok) {
      console.log("Aborted.");
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

  console.error(`Unknown template subcommand: ${sub}`);
  process.exitCode = 1;
}

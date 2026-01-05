import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { loadConfig, defaultConfigPath } from "../config.js";

export async function handleConfig(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const path = parsed.flags.path
    ? String(parsed.flags.path)
    : defaultConfigPath;

  const config = await loadConfig(path);
  if (parsed.flags.json) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  console.log(`Config (${path}):`);
  console.log(`- project: ${config.project.name} @ ${config.project.version}`);
  console.log(`- template: ${config.template}`);
  console.log(`- packs.behavior: ${config.packs.behavior}`);
  console.log(`- packs.resource: ${config.packs.resource}`);
  console.log(`- build.outDir: ${config.build.outDir} (target: ${config.build.target})`);
  console.log(`- sync.defaultTarget: ${config.sync.defaultTarget}`);
  if (config.sync.targets) {
    console.log(`- sync.targets: ${Object.keys(config.sync.targets).join(", ") || "(none)"}`);
  }
  if (config.script) {
    console.log(
      `- script: entry=${config.script.entry}, language=${config.script.language}, deps=${config.script.dependencies
        .map((d) => d.module_name)
        .join(", ")}`,
    );
  }
}

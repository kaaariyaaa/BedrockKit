import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { resolveLang } from "../utils/i18n.js";
import { runRemove } from "../services/remove.js";

export async function handleRemove(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const yes = !!parsed.flags.yes;
  const interactive = !quiet && !yes;

  const ok = await runRemove({ parsed, lang, quiet, yes, interactive });
  if (!ok) process.exitCode = 1;
}


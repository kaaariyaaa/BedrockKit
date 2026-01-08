import { isCancel, select } from "@clack/prompts";
import type { CommandContext } from "../types.js";
import { parseArgs } from "../utils/args.js";
import { resolveLang, t } from "../utils/i18n.js";
import { runLink } from "../services/link.js";

type LinkAction = "create" | "remove" | "edit";

export async function handleLink(ctx: CommandContext): Promise<void> {
  const parsed = parseArgs(ctx.argv);
  const lang = ctx.lang ?? resolveLang(parsed.flags.lang);
  const jsonOut = !!parsed.flags.json;
  const quiet = !!parsed.flags.quiet || !!parsed.flags.q;
  const dryRun = !!parsed.flags["dry-run"];
  const interactive = !jsonOut && !quiet && !parsed.flags.yes;

  const actionFlag = (parsed.flags.action as string | undefined)?.toLowerCase();
  let action: LinkAction | undefined =
    actionFlag === "remove" || actionFlag === "rm" || actionFlag === "unlink"
      ? "remove"
      : actionFlag === "edit" || actionFlag === "update"
        ? "edit"
        : actionFlag === "create" || actionFlag === "link"
          ? "create"
          : undefined;
  if (!action && interactive) {
    const choice = await select({
      message: t("link.selectAction", lang),
      options: [
        { value: "create", label: t("link.action.create", lang) },
        { value: "remove", label: t("link.action.remove", lang) },
        { value: "edit", label: t("link.action.edit", lang) },
      ],
      initialValue: "create",
    });
    if (isCancel(choice)) {
      console.error(t("link.cancelled", lang));
      process.exitCode = 1;
      return;
    }
    action = String(choice) as LinkAction;
  }
  action = action ?? "create";

  const ok = await runLink({
    parsed,
    action,
    lang,
    jsonOut,
    quiet,
    dryRun,
    interactive,
  });
  if (!ok) process.exitCode = 1;
}


import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { ensureDir, pathExists } from "./utils/fs.js";
import { spawn } from "node:child_process";

export const knownTemplates = [
  { value: "official-sample", label: "Official sample", hint: "Mojang sample packs" },
  { value: "bkit-default", label: "BedrockKit default", hint: "Built-in starter template" },
  { value: "custom-git", label: "Custom Git URL", hint: "Provide your own repository" },
];

export type TemplateEntry = {
  name: string;
  url: string;
  path?: string;
};

export const templateRegistryPath = resolve(
  process.cwd(),
  ".bkit",
  "templates.json",
);

export async function loadTemplateRegistry(): Promise<TemplateEntry[]> {
  if (!(await pathExists(templateRegistryPath))) {
    return knownTemplates.map((t) => ({
      name: t.value,
      url: "",
    }));
  }
  const raw = await readFile(templateRegistryPath, { encoding: "utf8" });
  return JSON.parse(raw) as TemplateEntry[];
}

export async function saveTemplateRegistry(entries: TemplateEntry[]): Promise<void> {
  const dir = resolve(templateRegistryPath, "..");
  await ensureDir(dir);
  await writeFile(templateRegistryPath, JSON.stringify(entries, null, 2), {
    encoding: "utf8",
  });
}

export async function cloneTemplate(
  name: string,
  url: string,
  opts: { targetDir?: string; sshCommand?: string } = {},
): Promise<string> {
  const baseDir = resolve(process.cwd(), ".bkit", "templates");
  const dest = opts.targetDir ?? resolve(baseDir, name);
  await ensureDir(baseDir);
  await ensureDir(dest);

  const env = { ...process.env };
  const sshCommand =
    opts.sshCommand ??
    process.env.BKIT_SSH_COMMAND ??
    (process.env.BKIT_SSH_KEY
      ? `ssh -i "${process.env.BKIT_SSH_KEY}" -o StrictHostKeyChecking=accept-new`
      : undefined);
  if (sshCommand) {
    env.GIT_SSH_COMMAND = sshCommand;
  }

  const run = (useShell: boolean): Promise<void> =>
    new Promise((resolveRun, rejectRun) => {
      const child = spawn("git", ["clone", "--depth", "1", url, dest], {
        stdio: "inherit",
        shell: useShell,
        env,
      });
      child.on("error", (err) => {
        if (!useShell && (err as NodeJS.ErrnoException).code === "EINVAL") {
          run(true).then(resolveRun).catch(rejectRun);
        } else {
          rejectRun(err);
        }
      });
      child.on("exit", (code) => {
        if (code === 0) resolveRun();
        else if (!useShell) run(true).then(resolveRun).catch(rejectRun);
        else rejectRun(new Error(`git clone exited with code ${code}`));
      });
    });

  await run(process.platform === "win32");
  return dest;
}

export async function materializeTemplate(
  nameOrUrl: string,
  registry: TemplateEntry[],
  opts: { allowUrl?: boolean },
): Promise<string | null> {
  const entry = registry.find((t) => t.name === nameOrUrl);
  const isLikelyGit = (u?: string) =>
    !!u && /^(https?:\/\/|git@|ssh:\/\/|file:\/\/|\.{0,2}\/)/i.test(u.trim());
  if (entry) {
    if (!isLikelyGit(entry.url)) {
      return null;
    }
    if (entry.path && (await pathExists(entry.path))) return entry.path;
    const cloned = await cloneTemplate(entry.name, entry.url);
    entry.path = cloned;
    await saveTemplateRegistry(registry);
    return cloned;
  }
  if (opts.allowUrl) {
    if (!isLikelyGit(nameOrUrl)) return null;
    const tmpName = `tmp-${randomUUID()}`;
    return cloneTemplate(tmpName, nameOrUrl, {
      targetDir: resolve(process.cwd(), ".bkit", "tmp", tmpName),
    });
  }
  return null;
}

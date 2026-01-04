import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ensureDir, pathExists } from "./utils/fs.js";

export const knownTemplates = [
  { value: "official-sample", label: "Official sample", hint: "Mojang sample packs" },
  { value: "bkit-default", label: "BedrockKit default", hint: "Built-in starter template" },
  { value: "custom-git", label: "Custom Git URL", hint: "Provide your own repository" },
];

export type TemplateEntry = {
  name: string;
  url: string;
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
      url: t.hint ?? "",
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

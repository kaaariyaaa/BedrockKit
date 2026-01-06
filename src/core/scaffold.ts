import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DEFAULT_BKIT_IGNORE, DEFAULT_GIT_IGNORE, buildIgnoreFileContent } from "./constants.js";
import { ensureDir } from "../utils/fs.js";

export async function writeIgnoreFiles(targetDir: string): Promise<void> {
  await ensureDir(targetDir);
  await writeFile(resolve(targetDir, ".bkitignore"), buildIgnoreFileContent(DEFAULT_BKIT_IGNORE), {
    encoding: "utf8",
  });
  await writeFile(resolve(targetDir, ".gitignore"), buildIgnoreFileContent(DEFAULT_GIT_IGNORE), {
    encoding: "utf8",
  });
}

import { spawn } from "node:child_process";
import { platform } from "node:os";

export function zipDirectory(srcDir: string, outFile: string): Promise<void> {
  const isWin = platform() === "win32";
  return new Promise((resolve, reject) => {
    const cmd = isWin ? "powershell" : "zip";
    const args = isWin
      ? [
          "-NoProfile",
          "-Command",
          `Compress-Archive -Path "${srcDir}\\*" -DestinationPath "${outFile}" -Force`,
        ]
      : ["-r", outFile, "."];

    const options = isWin
      ? { stdio: "inherit" as const }
      : { cwd: srcDir, stdio: "inherit" as const };

    const child = spawn(cmd, args, options);
    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`zip failed with code ${code}`));
    });
  });
}

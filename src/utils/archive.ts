import { spawn } from "node:child_process";
import { platform } from "node:os";
import { resolve } from "node:path";

// Validate path to prevent command injection
function validatePath(input: string): string {
  // Remove dangerous characters that could be used for command injection
  const sanitized = input.replace(/["`$;|&<>\x00-\x1f]/g, "");
  // Resolve to absolute path
  return resolve(sanitized);
}

export function zipDirectory(srcDir: string, outFile: string): Promise<void> {
  const isWin = platform() === "win32";
  const safeSrcDir = validatePath(srcDir);
  const safeOutFile = validatePath(outFile);

  return new Promise((resolve, reject) => {
    let cmd: string;
    let args: string[];
    let options: { cwd?: string; stdio: "inherit" };

    if (isWin) {
      cmd = "powershell";
      // Use -LiteralPath to handle special characters safely
      args = [
        "-NoProfile",
        "-Command",
        "Compress-Archive",
        "-LiteralPath",
        `${safeSrcDir}\\*`,
        "-DestinationPath",
        safeOutFile,
        "-Force",
      ];
      options = { stdio: "inherit" };
    } else {
      cmd = "zip";
      args = ["-r", safeOutFile, "."];
      options = { cwd: safeSrcDir, stdio: "inherit" };
    }

    const child = spawn(cmd, args, options);
    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`zip failed with code ${code}`));
    });
  });
}

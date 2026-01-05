import gradient from 'gradient-string';
import boxen from 'boxen';
import pc from 'picocolors';
import figlet from 'figlet';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "../..");

const pkg = JSON.parse(
  readFileSync(resolve(root, "package.json"), { encoding: "utf8" }),
) as { version?: string };

export function printBanner() {
  console.clear();
  
  // Huge ASCII Art
  const art = figlet.textSync('BEDROCK KIT', {
    font: 'Slant',
    horizontalLayout: 'default',
    verticalLayout: 'default',
    width: 80,
    whitespaceBreak: true
  });

  // Center the ASCII art using boxen
  console.log(
    boxen(gradient.pastel.multiline(art), {
      padding: 0,
      margin: 0,
      borderStyle: 'none',
      float: 'center',
    })
  );
  
  console.log(
    boxen(`${pc.cyan('v' + (pkg.version || '0.0.0'))} ${pc.gray('•')} ${pc.white('TypeScript CLI for Minecraft Bedrock')}`, {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
      float: 'center',
    })
  );
  console.log('');
}

export function printCommandHeader(commandName: string, description: string) {
  console.log(
    boxen(pc.bold(pc.cyan(` ${commandName.toUpperCase()} `)), {
      padding: 0,
      margin: { top: 1, bottom: 0, left: 1, right: 0 },
      borderStyle: 'classic',
      borderColor: 'gray',
    })
  );
  console.log(gradient.atlas(`  ${description}`));
  console.log(pc.dim('  ' + '─'.repeat(50)));
  console.log('');
}

export function formatStep(step: string) {
  return pc.bold(pc.cyan(`◆ ${step}`));
}

export function formatSuccess(msg: string) {
  return pc.bold(pc.green(`✔ ${msg}`));
}

export function formatError(msg: string) {
  return pc.bold(pc.red(`✖ ${msg}`));
}

export function formatDim(msg: string) {
  return pc.dim(msg);
}


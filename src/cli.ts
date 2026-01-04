#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function main(): void {
  const root = resolve(__dirname, "..");
  console.log(`BedrockKit CLI bootstrap (root: ${root})`);
  console.log("TODO: implement command dispatch per requirements.md");
}

main();

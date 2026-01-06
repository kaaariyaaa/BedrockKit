import { readFile, writeFile, rm, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as recast from "recast";
import { parse } from "@babel/parser";
import { ensureDir } from "./fs.js";

const parser = {
  parse(source: string) {
    return parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      allowReturnOutsideFunction: true,
      ranges: false,
    });
  },
};

function shouldRewrite(spec: string): boolean {
  return spec.endsWith(".js") || spec.endsWith(".cjs") || spec.endsWith(".mjs");
}

function rewriteSpec(spec: string, importerDir: string): string {
  if (spec.endsWith(".js")) spec = spec.slice(0, -3) + ".ts";
  else if (spec.endsWith(".cjs")) spec = spec.slice(0, -4) + ".ts";
  else if (spec.endsWith(".mjs")) spec = spec.slice(0, -4) + ".ts";
  else return spec;
  if (!spec.startsWith(".") && !spec.startsWith("/")) {
    spec = "./" + spec;
  }
  return spec.replace(/\\/g, "/");
}

async function collectJs(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await collectJs(full, acc);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      acc.push(full);
    }
  }
  return acc;
}

export async function convertJsTreeToTs(root: string): Promise<void> {
  const files = await collectJs(root);
  if (!files.length) return;

  for (const jsPath of files) {
    const src = await readFile(jsPath, "utf8");
    const ast = recast.parse(src, { parser });

    recast.types.visit(ast, {
      visitImportDeclaration(path) {
        const spec = path.value.source.value as string;
        if (typeof spec === "string" && shouldRewrite(spec)) {
          path.value.source.value = rewriteSpec(spec, dirname(jsPath));
        }
        this.traverse(path);
      },
      visitCallExpression(path) {
        const { node } = path;
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments.length &&
          node.arguments[0].type === "StringLiteral"
        ) {
          const spec = node.arguments[0].value as string;
          if (shouldRewrite(spec)) {
            node.arguments[0].value = rewriteSpec(spec, dirname(jsPath));
          }
        }
        if (
          node.callee.type === "Import" &&
          node.arguments.length &&
          node.arguments[0].type === "StringLiteral"
        ) {
          const spec = node.arguments[0].value as string;
          if (shouldRewrite(spec)) {
            node.arguments[0].value = rewriteSpec(spec, dirname(jsPath));
          }
        }
        this.traverse(path);
      },
    });

    const output = recast.print(ast).code;
    const tsPath = jsPath.replace(/\.js$/, ".ts");
    await ensureDir(dirname(tsPath));
    await writeFile(tsPath, output, { encoding: "utf8" });
    await rm(jsPath, { force: true });
  }
}

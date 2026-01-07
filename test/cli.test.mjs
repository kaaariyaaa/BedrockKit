import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

async function makeTempWorkspace(withProject = false) {
  const dir = await mkdtemp(join(tmpdir(), "bkit-test-"));
  const settingsDir = resolve(dir, ".bkit");
  await mkdir(settingsDir, { recursive: true });
  const projectRoot = resolve(dir, "project");
  const settings = {
    lang: { value: "ja", setupDone: true, onboarding: false },
    projectRoot: { path: projectRoot, setupDone: true, onboarding: false },
  };
  await writeFile(resolve(settingsDir, "settings.json"), JSON.stringify(settings, null, 2), "utf8");
  if (withProject) {
    await scaffoldProject(projectRoot);
  }
  return dir;
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [resolve("dist/cli.js"), ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
}

async function scaffoldProject(projectRoot) {
  const name = "sample-addon";
  const root = resolve(projectRoot, name);
  await mkdir(resolve(root, "packs/behavior"), { recursive: true });
  await mkdir(resolve(root, "packs/resource"), { recursive: true });
  const config = {
    project: { name, version: "1.0.0" },
    template: "test",
    packSelection: { behavior: true, resource: true },
    packs: { behavior: "packs/behavior", resource: "packs/resource" },
    build: { outDir: "dist", target: "dev" },
    sync: {
      defaultTarget: "local",
      targets: {
        local: {
          behavior: resolve(root, "dev-target", "behavior"),
          resource: resolve(root, "dev-target", "resource"),
        },
      },
    },
    paths: { root },
  };
  const behaviorManifest = {
    format_version: 2,
    header: {
      name: `${name} (behavior)`,
      description: "test",
      uuid: "11111111-1111-1111-1111-111111111111",
      version: [1, 0, 0],
      min_engine_version: [1, 21, 2],
    },
    modules: [
      {
        type: "data",
        uuid: "22222222-2222-2222-2222-222222222222",
        version: [1, 0, 0],
      },
      {
        type: "script",
        language: "javascript",
        entry: "scripts/main.js",
        uuid: "33333333-3333-3333-3333-333333333333",
        version: [1, 0, 0],
      },
    ],
    dependencies: [
      {
        uuid: "44444444-4444-4444-4444-444444444444",
        version: [1, 0, 0],
      },
    ],
  };
  const resourceManifest = {
    format_version: 2,
    header: {
      name: `${name} (resource)`,
      description: "test",
      uuid: "44444444-4444-4444-4444-444444444444",
      version: [1, 0, 0],
      min_engine_version: [1, 21, 2],
    },
    modules: [
      {
        type: "resources",
        uuid: "55555555-5555-5555-5555-555555555555",
        version: [1, 0, 0],
      },
    ],
    dependencies: [
      {
        uuid: "11111111-1111-1111-1111-111111111111",
        version: [1, 0, 0],
      },
    ],
  };
  await writeFile(resolve(root, "bkit.config.json"), JSON.stringify(config, null, 2), "utf8");
  await writeFile(
    resolve(root, "packs/behavior/manifest.json"),
    JSON.stringify(behaviorManifest, null, 2),
    "utf8",
  );
  await writeFile(
    resolve(root, "packs/resource/manifest.json"),
    JSON.stringify(resourceManifest, null, 2),
    "utf8",
  );
}

test("CLI commands (smoke tests)", async (t) => {
  const cwd = await makeTempWorkspace(true);
  const projectDir = resolve(cwd, "project", "sample-addon");
  const configPath = resolve(projectDir, "bkit.config.json");

  await t.test("version", async () => {
    const res = runCli(["--version"], cwd);
    assert.equal(res.status, 0);
    assert.match(res.stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  await t.test("help", async () => {
    const res = runCli(["--help"], cwd);
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes("Commands"));
  });

  await t.test("help command", async () => {
    const res = runCli(["help"], cwd);
    assert.equal(res.status, 0);
  });

  await t.test("init (non-interactive)", async () => {
    const res = runCli(
      ["init", "--yes", "--skip-install", "--no-script", "--name", "init-addon"],
      cwd,
    );
    assert.equal(res.status, 0);
  });

  await t.test("build", async () => {
    const res = runCli(["build", "--config", configPath, "--quiet"], cwd);
    assert.equal(res.status, 0);
  });

  await t.test("package", async () => {
    const res = runCli(["package", "--config", configPath, "--build=false", "--quiet"], cwd);
    assert.equal(res.status, 0);
  });

  await t.test("sync (dry-run)", async () => {
    const res = runCli(["sync", "--config", configPath, "--dry-run", "--quiet"], cwd);
    assert.equal(res.status, 0);
  });

  await t.test("link (dry-run)", async () => {
    const res = runCli(
      [
        "link",
        "--config",
        configPath,
        "--target",
        "local",
        "--source",
        "packs",
        "--mode",
        "junction",
        "--behavior",
        "--resource",
        "--dry-run",
        "--on-existing",
        "skip",
        "--quiet",
      ],
      cwd,
    );
    assert.equal(res.status, 0);
  });

  await t.test("validate", async () => {
    const res = runCli(["validate", "--config", configPath, "--json"], cwd);
    assert.equal(res.status, 0);
  });

  await t.test("bump", async () => {
    const res = runCli(["bump", "patch", "--config", configPath, "--yes"], cwd);
    assert.equal(res.status, 0);
    const updated = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(updated.project.version, "1.0.1");
  });

  await t.test("deps (expected failure without script)", async () => {
    const res = runCli(["deps", "--config", configPath], cwd);
    assert.notEqual(res.status, 0);
  });

  await t.test("import (expected failure)", async () => {
    const res = runCli(["import", "missing.zip"], cwd);
    assert.notEqual(res.status, 0);
  });

  await t.test("template list", async () => {
    const res = runCli(["template", "list"], cwd);
    assert.equal(res.status, 0);
  });

  await t.test("setting --lang", async () => {
    const res = runCli(["setting", "--lang", "en"], cwd);
    assert.equal(res.status, 0);
  });

  await t.test("remove --yes", async () => {
    const removeCwd = await makeTempWorkspace(true);
    const removeProject = resolve(removeCwd, "project", "sample-addon");
    const res = runCli(["remove", "--project", "sample-addon", "--yes"], removeCwd);
    assert.equal(res.status, 0);
    let exists = true;
    try {
      await stat(removeProject);
    } catch {
      exists = false;
    }
    assert.equal(exists, false);
  });

  await t.test("watch (no projects)", async () => {
    const empty = await makeTempWorkspace(false);
    const res = runCli(["watch"], empty);
    assert.equal(res.status, 0);
  });
});

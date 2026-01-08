import { join } from "node:path";
import { createRequire } from "node:module";

const DEVELOPMENT_BEHAVIOR = "development_behavior_packs";
const DEVELOPMENT_RESOURCE = "development_resource_packs";

export type SyncTargetConfig = {
  behavior?: string;
  resource?: string;
  product?: string;
  projectName?: string;
};

export function resolveTargetPaths(
  target: SyncTargetConfig,
  projectName: string,
): { behavior?: string; resource?: string } {
  if (target.behavior || target.resource) {
    return { behavior: target.behavior, resource: target.resource };
  }
  if (!target.product) return {};
  const require = createRequire(import.meta.url);
  const coreBuild = require("@minecraft/core-build-tasks");
  const getGameDeploymentRootPaths = (coreBuild as any).getGameDeploymentRootPaths as
    | (() => Record<string, string | undefined>)
    | undefined;
  if (!getGameDeploymentRootPaths) return {};
  const rootPaths = getGameDeploymentRootPaths();
  const root = rootPaths[target.product];
  if (!root) return {};
  return {
    behavior: join(root, DEVELOPMENT_BEHAVIOR, projectName),
    resource: join(root, DEVELOPMENT_RESOURCE, projectName),
  };
}


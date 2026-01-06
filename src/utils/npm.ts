export type VersionChannels = {
  stable: string[];
  beta: string[];
  alpha: string[];
  preview: string[];
  other: string[];
};

type FetchOptions = {
  limit?: number;
};

function compareSemverDesc(a: string, b: string): number {
  const ap = a.split(".").map(Number);
  const bp = b.split(".").map(Number);
  const hasNaN = ap.some(Number.isNaN) || bp.some(Number.isNaN);
  if (!hasNaN) {
    for (let i = 0; i < 3; i += 1) {
      const av = ap[i] ?? 0;
      const bv = bp[i] ?? 0;
      if (av !== bv) return bv - av;
    }
    return 0;
  }
  // Fallback for non-semver-ish tags (e.g., beta-1.25.9-stable): lexical desc
  return b.localeCompare(a);
}

function classifyVersion(version: string): keyof VersionChannels {
  if (version.includes("beta")) return "beta";
  if (version.includes("alpha")) return "alpha";
  if (version.includes("preview")) return "preview";
  if (version.includes("-")) return "other";
  return "stable";
}

export function formatVersionLabel(version: string): string {
  // Trim trailing numeric build counters that follow a prerelease tag component
  // e.g., 2.1.0-beta.1.26.0-preview.26 -> 2.1.0-beta.1.26.0-preview
  return version.replace(/([A-Za-z][^.]*)(?:\.\d+)$/, "$1");
}

export async function fetchNpmVersionChannels(
  pkg: string,
  opts: FetchOptions = {},
): Promise<VersionChannels> {
  const limit = opts.limit ?? 15;
  const encoded = encodeURIComponent(pkg);
  const url = `https://registry.npmjs.org/${encoded}`;
  const result: VersionChannels = {
    stable: [],
    beta: [],
    alpha: [],
    preview: [],
    other: [],
  };
  try {
    // タイムアウト設定（10秒）でハングを防止
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return result;
    const data = (await res.json()) as { versions?: Record<string, unknown> };
    const versions = Object.keys(data.versions ?? {}).sort(compareSemverDesc);
    const seen = new Set<string>();
    for (const v of versions) {
      // Collapse build-suffix variants (e.g., preview.24/25/26) to one entry per base.
      const collapse =
        v.replace(/((?:preview|beta|alpha|rc)[^.]*)\.\d+$/i, "$1").replace(/(-[^.]+)\.\d+$/, "$1") ||
        v;
      const key = collapse || v;
      if (seen.has(key)) continue;
      seen.add(key);
      const channel = classifyVersion(v);
      if (result[channel].length < limit) {
        result[channel].push(v);
      }
    }
  } catch {
    // ignore network errors, return empty buckets
  }
  return result;
}

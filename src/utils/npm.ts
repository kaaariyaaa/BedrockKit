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
  for (let i = 0; i < 3; i += 1) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return bv - av;
  }
  return 0;
}

function classifyVersion(version: string): keyof VersionChannels {
  if (version.includes("beta")) return "beta";
  if (version.includes("alpha")) return "alpha";
  if (version.includes("preview")) return "preview";
  if (version.includes("-")) return "other";
  return "stable";
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
  const seenBase = new Set<string>();
  try {
    // タイムアウト設定（10秒）でハングを防止
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return result;
    const data = (await res.json()) as { versions?: Record<string, unknown> };
    const versions = Object.keys(data.versions ?? {}).sort(compareSemverDesc);
    for (const v of versions) {
      // Drop build-number style variants (e.g., 1.0.0-beta.00001b26) entirely.
      if (/[.-]\d+b\d+/i.test(v)) {
        continue;
      }
      // Ignore build numbers like ".00001b37" by collapsing to a base key.
      const base = v.replace(/([0-9]+(?:\.[0-9]+){2}(?:-[^.]+)?)(?:\..*)$/, "$1");
      if (seenBase.has(base)) continue;
      seenBase.add(base);
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

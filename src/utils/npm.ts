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
  try {
    const res = await fetch(url);
    if (!res.ok) return result;
    const data = (await res.json()) as { versions?: Record<string, unknown> };
    const versions = Object.keys(data.versions ?? {}).sort(compareSemverDesc);
    for (const v of versions) {
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

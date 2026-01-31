type UpdateCheck = {
  latest: string;
  hasUpdate: boolean;
  shouldPrompt: boolean;
};

function parseSemver(v: string): [number, number, number] | null {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(a: string, b: string): number {
  const ap = parseSemver(a);
  const bp = parseSemver(b);
  if (!ap || !bp) return a.localeCompare(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = ap[i] - bp[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

const FETCH_TIMEOUT_MS = 10_000;

export async function checkForUpdate(
  pkgName: string,
  current: string,
  skipVersion?: string,
): Promise<UpdateCheck | null> {
  try {
    const encoded = encodeURIComponent(pkgName);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`https://registry.npmjs.org/${encoded}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = (await res.json()) as { "dist-tags"?: { latest?: string } };
    const latest = data["dist-tags"]?.latest;
    if (!latest) return null;
    const hasUpdate = compareSemver(latest, current) > 0;
    const shouldPrompt =
      hasUpdate && (!skipVersion || compareSemver(latest, skipVersion) > 0);
    return { latest, hasUpdate, shouldPrompt };
  } catch {
    return null;
  }
}

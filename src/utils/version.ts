export type BumpLevel = "major" | "minor" | "patch";

export function stringToVersionTuple(version: string): [number, number, number] {
  const [major, minor, patch] = version.split(".").map((n) => Number.parseInt(n, 10));
  return [
    Number.isFinite(major) ? major : 0,
    Number.isFinite(minor) ? minor : 0,
    Number.isFinite(patch) ? patch : 0,
  ];
}

export function versionTupleToString(tuple: [number, number, number]): string {
  return `${tuple[0]}.${tuple[1]}.${tuple[2]}`;
}

export function bumpTuple(
  tuple: [number, number, number],
  level: BumpLevel,
): [number, number, number] {
  const [maj, min, pat] = tuple;
  if (level === "major") return [maj + 1, 0, 0];
  if (level === "minor") return [maj, min + 1, 0];
  return [maj, min, pat + 1];
}

export function bumpVersionString(version: string, level: BumpLevel): string {
  return versionTupleToString(bumpTuple(stringToVersionTuple(version), level));
}

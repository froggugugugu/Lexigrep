/** `--key value` / `--flag` / 位置引数 の最小パーサ */
export type ParsedArgs = {
  positional: string[];
  flags: Map<string, string | true>;
};

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(a.slice(2), next);
        i++;
      } else {
        flags.set(a.slice(2), true);
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

export function flagString(
  flags: ParsedArgs["flags"],
  key: string,
  fallback: string,
): string {
  const v = flags.get(key);
  return typeof v === "string" ? v : fallback;
}

export function flagNumber(
  flags: ParsedArgs["flags"],
  key: string,
  fallback: number,
): number {
  const v = flags.get(key);
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

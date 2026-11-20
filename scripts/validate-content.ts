/**
 * content/ 配下の題材パッケージを検証する。
 *
 *   pnpm content:validate                 # 全題材を検証
 *   pnpm content:validate typescript      # 題材を指定
 *   pnpm content:validate --write-manifest  # 検証後に manifest.json を(再)生成
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  ContentValidationError,
  readPackage,
  writeManifest,
} from "../src/shared/content/package";

const CONTENT_DIR = path.resolve(process.cwd(), "content");

async function listSubjectDirs(filter: string[]): Promise<string[]> {
  const entries = await readdir(CONTENT_DIR);
  const dirs: string[] = [];
  for (const e of entries) {
    const p = path.join(CONTENT_DIR, e);
    if (!(await stat(p)).isDirectory()) continue;
    if (filter.length > 0 && !filter.includes(e)) continue;
    dirs.push(p);
  }
  return dirs.sort();
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const write = args.includes("--write-manifest");
  const filter = args.filter((a) => !a.startsWith("--"));
  const dirs = await listSubjectDirs(filter);
  if (dirs.length === 0) {
    console.error("題材ディレクトリが見つかりません: content/<subject_id>/");
    return 1;
  }

  let failed = 0;
  for (const dir of dirs) {
    const name = path.basename(dir);
    try {
      if (write) {
        const m = await writeManifest(
          dir,
          `validate-content@${process.env.npm_package_version ?? "0"}`,
          new Date(),
        );
        console.log(
          `✔ ${name}: manifest を更新(${m.card_count} 枚, ${m.checksum.slice(0, 12)}…)`,
        );
      }
      const pkg = await readPackage(dir);
      const byStatus = new Map<string, number>();
      for (const c of pkg.cards)
        byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
      const summary = [...byStatus.entries()]
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      console.log(
        `✔ ${name}: ${pkg.cards.length} 枚 (${summary})${pkg.manifest ? "" : " [manifest なし]"}`,
      );
    } catch (err) {
      failed += 1;
      if (err instanceof ContentValidationError) {
        console.error(`✘ ${name}\n${err.message}`);
      } else {
        console.error(`✘ ${name}: ${(err as Error).message}`);
      }
    }
  }
  return failed === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });

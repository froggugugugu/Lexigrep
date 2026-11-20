// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPackage } from "../../src/shared/content/package";
import { buildSubjectScaffold, writeSubjectScaffold } from "./init-subject";

const NOW = new Date("2026-11-03T00:00:00.000Z");
const opts = {
  id: "aws-s3",
  name: "Amazon S3",
  category: "object-storage",
  categoryLabel: "ストレージ",
  urls: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/"],
};

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "lexigrep-init-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("content:init", () => {
  it("書き出した雛形がパッケージ検証を通る", async () => {
    const written = await writeSubjectScaffold(
      dir,
      buildSubjectScaffold(opts, NOW),
    );
    const pkg = await readPackage(written);
    expect(pkg.subject.id).toBe("aws-s3");
    expect(pkg.subject.category_label).toBe("ストレージ");
    expect(pkg.subject.description_ja).toBe("Amazon S3 の公式ドキュメント");
    expect(pkg.cards).toEqual([]);
    expect(pkg.manifest?.card_count).toBe(0);
  });

  it("既存の題材は上書きしない", async () => {
    await writeSubjectScaffold(dir, buildSubjectScaffold(opts, NOW));
    await expect(
      writeSubjectScaffold(dir, buildSubjectScaffold(opts, NOW)),
    ).rejects.toThrow(/上書きしません/);
  });

  it("不正な ID・URL・カテゴリを拒否する", () => {
    expect(() =>
      buildSubjectScaffold({ ...opts, id: "AWS S3" }, NOW),
    ).toThrow();
    expect(() =>
      buildSubjectScaffold({ ...opts, urls: ["ftp://example.com/"] }, NOW),
    ).toThrow();
    expect(() => buildSubjectScaffold({ ...opts, urls: [] }, NOW)).toThrow();
    expect(() =>
      buildSubjectScaffold({ ...opts, category: "Object Storage" }, NOW),
    ).toThrow();
  });
});

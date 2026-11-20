import { describe, expect, it } from "vitest";
import { hashSeed, shuffledOrder } from "./shuffle";

describe("shuffledOrder", () => {
  it("同じ seed からは同じ順列を返す(決定論)", () => {
    expect(shuffledOrder("card-1:2026", 4)).toEqual(
      shuffledOrder("card-1:2026", 4),
    );
  });

  it("順列である(各インデックスが 1 回ずつ現れる)", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      expect([...shuffledOrder(seed, 6)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });

  it("seed が違えば並びも概ね違う", () => {
    const orders = new Set(
      ["s1", "s2", "s3", "s4", "s5", "s6"].map((s) =>
        shuffledOrder(s, 4).join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("hashSeed は 32bit 符号なし整数", () => {
    const h = hashSeed("lexigrep");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

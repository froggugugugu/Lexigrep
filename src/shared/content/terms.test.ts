import { describe, expect, it } from "vitest";
import { normalizeTerm } from "./terms";

describe("normalizeTerm", () => {
  it("大文字小文字と空白のゆれを吸収する", () => {
    expect(normalizeTerm("  By   Default ")).toBe("by default");
    expect(normalizeTerm("by default")).toBe("by default");
  });
});

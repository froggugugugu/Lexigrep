import { describe, expect, it } from "vitest";
import {
  BASE_FILTER,
  filterForGoal,
  loggedLayer,
  resolveSessionFilter,
} from "./course";

const general = { learning_goal: "general", focus_subject_id: null } as const;
const focused = {
  learning_goal: "subject",
  focus_subject_id: "nextjs",
} as const;

describe("filterForGoal", () => {
  it("目的が題材集中なら選んだ題材、それ以外はベース", () => {
    expect(filterForGoal(general)).toEqual(BASE_FILTER);
    expect(filterForGoal(focused)).toEqual({
      subjectId: "nextjs",
      layers: null,
    });
  });

  it("題材未選択の題材集中はベースに倒す", () => {
    expect(
      filterForGoal({ learning_goal: "subject", focus_subject_id: null }),
    ).toEqual(BASE_FILTER);
  });
});

describe("resolveSessionFilter", () => {
  it("URL 指定が無ければ保存済みの目的に従う", () => {
    expect(resolveSessionFilter({}, focused).subjectId).toBe("nextjs");
  });

  it("URL の題材・層・コース指定を優先する", () => {
    expect(
      resolveSessionFilter(
        { subject: "typescript", layer: "system_term" },
        focused,
      ),
    ).toEqual({
      subjectId: "typescript",
      layers: ["system_term"],
    });
    expect(resolveSessionFilter({ course: "base" }, focused)).toEqual(
      BASE_FILTER,
    );
    expect(
      resolveSessionFilter({ course: "base", layer: "vocab" }, focused).layers,
    ).toEqual(["vocab"]);
  });

  it("不正な層は無視する", () => {
    expect(
      resolveSessionFilter({ subject: "typescript", layer: "nope" }, general)
        .layers,
    ).toBeNull();
  });
});

describe("loggedLayer", () => {
  it("単一の層だけを記録する", () => {
    expect(loggedLayer({ subjectId: null, layers: ["vocab"] })).toBe("vocab");
    expect(loggedLayer(BASE_FILTER)).toBeNull();
    expect(loggedLayer({ subjectId: null, layers: null })).toBeNull();
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { crawl, isUnderRoots, normalizeUrl } from "./crawler";

function fakeFetch(
  site: Record<string, string>,
  robots = "User-agent: *\nDisallow: /docs/private\n",
): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/robots.txt")) {
      return new Response(robots, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    const body = site[url];
    if (body === undefined)
      return new Response("nope", {
        status: 404,
        headers: { "content-type": "text/html" },
      });
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }) as typeof fetch;
}

const page = (title: string, body: string) =>
  `<html><head><title>${title}</title></head><body><main>${body}</main></body></html>`;

describe("normalizeUrl / isUnderRoots", () => {
  it("フラグメント・クエリ・末尾スラッシュを正規化する", () => {
    expect(normalizeUrl("/docs/a/#x?y=1", "https://ex.com/docs/")).toBe(
      "https://ex.com/docs/a",
    );
    expect(normalizeUrl("mailto:a@b", "https://ex.com/")).toBeNull();
  });

  it("ルート配下だけを対象にする", () => {
    expect(isUnderRoots("https://ex.com/docs/a", ["https://ex.com/docs"])).toBe(
      true,
    );
    expect(isUnderRoots("https://ex.com/docsx", ["https://ex.com/docs"])).toBe(
      false,
    );
    expect(
      isUnderRoots("https://other.com/docs/a", ["https://ex.com/docs"]),
    ).toBe(false);
  });
});

describe("crawl", () => {
  it("ルート配下をたどり、robots.txt の禁止と外部リンクをスキップし、間隔を空ける", async () => {
    const site = {
      "https://ex.com/docs": page(
        "Docs",
        `<p>Welcome to the documentation site for testing.</p><a href="/docs/a">a</a><a href="/docs/private/x">p</a><a href="https://other.com/">o</a>`,
      ),
      "https://ex.com/docs/a": page(
        "A",
        `<p>This page explains how the crawler should behave in tests.</p><a href="/docs/a#frag">self</a>`,
      ),
      "https://ex.com/docs/private/x": page(
        "P",
        `<p>Private page that must never be fetched by the crawler.</p>`,
      ),
    };
    const sleeps: number[] = [];
    const result = await crawl({
      roots: ["https://ex.com/docs"],
      maxPages: 10,
      delayMs: 250,
      fetchImpl: fakeFetch(site),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => new Date("2026-11-01T00:00:00.000Z"),
    });
    expect(result.pages.map((p) => p.url)).toEqual([
      "https://ex.com/docs",
      "https://ex.com/docs/a",
    ]);
    expect(result.skipped).toEqual([
      { url: "https://ex.com/docs/private/x", reason: "robots.txt" },
    ]);
    expect(sleeps).toEqual([250, 250]);
    expect(result.pages[0]!.fetched_at).toBe("2026-11-01T00:00:00.000Z");
  });

  it("maxPages で打ち切る", async () => {
    const site = {
      "https://ex.com/docs": page(
        "Docs",
        `<p>Root page with enough words to pass the filter.</p><a href="/docs/a">a</a><a href="/docs/b">b</a>`,
      ),
      "https://ex.com/docs/a": page(
        "A",
        `<p>Page A with enough words to pass the filter.</p>`,
      ),
      "https://ex.com/docs/b": page(
        "B",
        `<p>Page B with enough words to pass the filter.</p>`,
      ),
    };
    const result = await crawl({
      roots: ["https://ex.com/docs"],
      maxPages: 2,
      delayMs: 0,
      fetchImpl: fakeFetch(site),
      sleep: async () => {},
    });
    expect(result.pages).toHaveLength(2);
  });
});

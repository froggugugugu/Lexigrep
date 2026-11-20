import type { Highlight } from "@/shared/content/schema";

/**
 * 実文をコード風に表示し、学習対象をハイライトする。
 * blank=true のときは対象部分を空欄にする(fill_blank)。
 */
export function HighlightedSentence({
  sentence,
  highlight,
  blank = false,
  className = "",
}: {
  sentence: string;
  highlight: Highlight;
  blank?: boolean;
  className?: string;
}) {
  const before = sentence.slice(0, highlight.start);
  const target = sentence.slice(highlight.start, highlight.end);
  const after = sentence.slice(highlight.end);
  return (
    <p
      lang="en"
      className={`rounded-lg border border-border bg-code-bg px-3 py-3 font-mono text-[15px] leading-7 wrap-break-word ${className}`}
    >
      {before}
      {blank ? (
        <span
          aria-label="空欄"
          className="mx-0.5 inline-block min-w-16 rounded border-b-2 border-accent text-center align-baseline text-accent"
        >
          ____
        </span>
      ) : (
        <mark className="lg-target">{target}</mark>
      )}
      {after}
    </p>
  );
}

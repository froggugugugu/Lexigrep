"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { LAYERS, type Layer } from "@/shared/content/schema";
import { Badge } from "@/shared/ui/Badge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { cn } from "@/shared/ui/cn";
import { LAYER_LABELS } from "@/shared/ui/labels";
import { searchDictionary, type DictionaryEntry } from "./search";

const SUGGESTION_LIMIT = 8;
const RESULT_LIMIT = 100;

const entryHref = (key: string) => `/dictionary/${encodeURIComponent(key)}`;

type Props = {
  entries: DictionaryEntry[];
  subjects: { id: string; name: string }[];
  initialQuery: string;
};

export function DictionarySearch({ entries, subjects, initialQuery }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [layer, setLayer] = useState<Layer | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const results = useMemo(
    () => searchDictionary(entries, query, { layer, subjectId }),
    [entries, query, layer, subjectId],
  );
  const suggestions =
    query.trim() === "" ? [] : results.slice(0, SUGGESTION_LIMIT);
  const showSuggestions = open && suggestions.length > 0;

  // 詳細から戻ったときに検索語を復元できるよう URL に残す
  useEffect(() => {
    const url =
      query.trim() === ""
        ? "/dictionary"
        : `/dictionary?q=${encodeURIComponent(query)}`;
    window.history.replaceState(null, "", url);
  }, [query]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      const chosen = suggestions[active];
      if (showSuggestions && chosen) {
        event.preventDefault();
        router.push(entryHref(chosen.key));
      } else {
        setOpen(false);
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="search"
          role="combobox"
          aria-label="語句や意味で検索"
          aria-expanded={showSuggestions}
          aria-controls="dictionary-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={
            active >= 0 ? `suggestion-${active}` : undefined
          }
          autoComplete="off"
          value={query}
          placeholder="例: deprecated / 非推奨"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-accent"
          data-testid="dictionary-input"
        />
        {showSuggestions ? (
          <ul
            id="dictionary-suggestions"
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          >
            {suggestions.map((entry, i) => (
              <li
                key={entry.key}
                id={`suggestion-${i}`}
                role="option"
                aria-selected={i === active}
                // blur より先に確定させる
                onMouseDown={(e) => {
                  e.preventDefault();
                  router.push(entryHref(entry.key));
                }}
                className={cn(
                  "flex min-h-tap cursor-pointer items-center justify-between gap-3 px-3 py-2",
                  i === active && "bg-surface-2",
                )}
                data-testid="dictionary-suggestion"
              >
                <span className="truncate text-sm">{entry.term}</span>
                <span className="truncate text-xs text-muted">
                  {entry.meaning_ja}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div
        className="flex gap-1 overflow-x-auto pb-1"
        role="group"
        aria-label="層で絞り込む"
      >
        <Chip active={layer === null} onClick={() => setLayer(null)}>
          すべて
        </Chip>
        {LAYERS.map((l) => (
          <Chip key={l} active={layer === l} onClick={() => setLayer(l)}>
            {LAYER_LABELS[l]}
          </Chip>
        ))}
      </div>
      <div
        className="flex gap-1 overflow-x-auto pb-1"
        role="group"
        aria-label="題材で絞り込む"
      >
        <Chip active={subjectId === null} onClick={() => setSubjectId(null)}>
          全題材
        </Chip>
        {subjects.map((s) => (
          <Chip
            key={s.id}
            active={subjectId === s.id}
            onClick={() => setSubjectId(s.id)}
          >
            {s.name}
          </Chip>
        ))}
      </div>

      <p className="text-xs text-muted" data-testid="dictionary-count">
        {results.length} 語
        {results.length > RESULT_LIMIT ? `(先頭 ${RESULT_LIMIT} 語を表示)` : ""}
      </p>
      {results.length === 0 ? (
        <EmptyState title="該当する語句がありません">
          語句の一部や日本語の意味でも検索できます。
        </EmptyState>
      ) : (
        <ul
          className="divide-y divide-border rounded-xl border border-border"
          data-testid="dictionary-results"
        >
          {results.slice(0, RESULT_LIMIT).map((entry) => (
            <li key={entry.key}>
              <Link
                href={entryHref(entry.key)}
                className="flex min-h-tap items-center justify-between gap-3 px-3 py-2 hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{entry.term}</span>
                  <span className="block truncate text-xs text-muted">
                    {entry.meaning_ja}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {entry.subjectIds.length > 1 ? (
                    <Badge tone="accent">{entry.subjectIds.length} 題材</Badge>
                  ) : null}
                  <Badge>
                    {entry.layers[0] ? LAYER_LABELS[entry.layers[0]] : ""}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-tap shrink-0 rounded-full border px-3 text-xs whitespace-nowrap",
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-border bg-surface text-muted",
      )}
    >
      {children}
    </button>
  );
}

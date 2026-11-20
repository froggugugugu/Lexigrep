import type { Metadata } from "next";
import { requireUser } from "@/features/auth/require-user";
import { DictionarySearch } from "@/features/dictionary/DictionarySearch";
import { buildDictionary } from "@/features/dictionary/search";
import { PageHeader } from "@/shared/ui/PageHeader";

export const metadata: Metadata = { title: "辞書" };
export const dynamic = "force-dynamic";

export default async function DictionaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { repos } = await requireUser();
  const [cards, subjects, params] = await Promise.all([
    repos.content.listCards(),
    repos.content.listSubjects(),
    searchParams,
  ]);
  return (
    <div>
      <PageHeader
        title="辞書"
        description="頻出単語・表現パターンを語句や日本語の意味で引けます"
      />
      <DictionarySearch
        entries={buildDictionary(cards)}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        initialQuery={params.q ?? ""}
      />
    </div>
  );
}

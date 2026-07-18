import { CommanderQueryCenter } from "@/components/commander/query/commander_query_center";
import { TranslatedPageHeader } from "@/components/common/translated_page_header";
import { getCommanderQueryDataset } from "@/lib/server/commander_query_service";
import { filtersFromSearchParams } from "@/lib/commander_query/search_params";

export const dynamic = "force-dynamic";

export default async function CommanderSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [dataset, resolvedSearchParams] = await Promise.all([getCommanderQueryDataset(), searchParams]);
  const initialFilters = filtersFromSearchParams(resolvedSearchParams);

  return (
    <div className="space-y-6">
      {/* Phase 43: title/description are translated client-side; the language
          switch is the single global one in the app shell (no page toggle). */}
      <TranslatedPageHeader titleKey="commander.title" descriptionKey="commander.subtitle" />
      <CommanderQueryCenter dataset={dataset} initialFilters={initialFilters} />
    </div>
  );
}

import { CommanderQueryCenter } from "@/components/commander/query/commander_query_center";
import { PageHeader } from "@/components/common/page_header";
import { getCommanderQueryDataset } from "@/lib/server/commander_query_service";

export const dynamic = "force-dynamic";

export default async function CommanderSearchPage() {
  const dataset = await getCommanderQueryDataset();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commander Search Center"
        description="Advanced personnel query workspace for promotion, retirement, service, training, document, and profile readiness decisions."
      />
      <CommanderQueryCenter dataset={dataset} />
    </div>
  );
}

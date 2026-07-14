import { CommanderQueryCenter } from "@/components/commander/query/commander_query_center";
import { PageHeader } from "@/components/common/page_header";
import { LanguageToggle } from "@/components/ui/language_toggle";
import { getCommanderQueryDataset } from "@/lib/server/commander_query_service";

export const dynamic = "force-dynamic";

export default async function CommanderSearchPage() {
  const dataset = await getCommanderQueryDataset();

  return (
    <div className="space-y-6">
      <PageHeader
        title="ศูนย์ค้นหากำลังพล / Commander Search Center"
        description="ศูนย์ช่วยตัดสินใจด้านกำลังพลสำหรับผู้บังคับบัญชา — การเลื่อนตำแหน่ง เกษียณอายุ อายุราชการ หลักสูตร เอกสาร และความพร้อมของข้อมูล / Advanced personnel decision-support workspace."
        actions={<LanguageToggle />}
      />
      <CommanderQueryCenter dataset={dataset} />
    </div>
  );
}
